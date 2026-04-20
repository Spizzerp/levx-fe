import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  useMutation, useQuery, useQueryClient,
  type UseQueryResult, type UseMutationResult,
} from '@tanstack/react-query'

import { SupabaseAuthContext, type AuthContextValue } from './provider'
import { getSupabase } from './client'
import { acquireChannel, releaseChannel } from './channels'
import type { Comment, DrawFrame, Profile, ProfileAvatarKind } from './types'

const PROFILE_BUCKET = 'profile-images'
const PROFILE_COLUMNS = [
  'user_id',
  'wallet_address',
  'wallet_name',
  'username',
  'display_name',
  'bio',
  'x_id',
  'avatar_kind',
  'avatar_sigil_idx',
  'avatar_image_path',
  'created_at',
  'updated_at',
].join(', ')

export function useSupabaseAuth(): AuthContextValue {
  const ctx = useContext(SupabaseAuthContext)
  if (!ctx) throw new Error('useSupabaseAuth must be used inside <SupabaseAuthProvider>')
  return ctx
}

export function useComments(marketId: string): UseQueryResult<Comment[]> {
  const qc = useQueryClient()
  const query = useQuery<Comment[]>({
    queryKey: ['supabase', 'comments', marketId],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('comments')
        .select('*')
        .eq('market_id', marketId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw new Error(error.message)
      return (data ?? []) as Comment[]
    },
  })

  useEffect(() => {
    const supabase = getSupabase()
    const name = `comments:${marketId}`
    const { channel, isFirstAcquire } = acquireChannel(supabase, name, { config: {} })
    // Attach the listener exactly once per channel lifetime — TanStack Query's
    // cache is a singleton per QueryClient, so a single listener writing into
    // the cache is observed by every consumer of `useComments(marketId)`.
    // Without this guard, two simultaneous mounts for the same marketId would
    // attach two identical handlers and double the work per emitted event.
    if (isFirstAcquire) {
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'comments', filter: `market_id=eq.${marketId}` },
          (payload: { new: Comment }) => {
            qc.setQueryData<Comment[]>(['supabase', 'comments', marketId], (prev) => {
              const curr = prev ?? []
              if (curr.some((c) => c.id === payload.new.id)) return curr
              return [payload.new, ...curr]
            })
          },
        )
        .subscribe()
    }
    return () => { releaseChannel(supabase, name) }
  }, [marketId, qc])

  return query
}

export function usePostComment(
  marketId: string,
  wallet: string | null,
): UseMutationResult<Comment, Error, { body: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ body }) => {
      if (!wallet) throw new Error('not_connected')
      const { data, error } = await getSupabase()
        .from('comments')
        .insert({ market_id: marketId, wallet, body })
        .select()
        .single()
      if (error) {
        const code = (error as { code?: string }).code
        if (code === 'P0001') throw new Error(`rate_limit: ${error.message}`)
        if (code === '42501') throw new Error(`permission_denied: ${error.message}`)
        throw new Error(error.message)
      }
      return data as Comment
    },
    onSuccess: (row) => {
      qc.setQueryData<Comment[]>(['supabase', 'comments', marketId], (prev) => {
        const curr = prev ?? []
        if (curr.some((c) => c.id === row.id)) return curr
        return [row, ...curr]
      })
    },
  })
}

const STALE_MS = 5000
const THROTTLE_MS = 100

export function useDrawBroadcast(
  marketId: string,
  selfWallet: string | null,
): { liveDraws: Record<string, DrawFrame> } {
  const [liveDraws, setLiveDraws] = useState<Record<string, DrawFrame>>({})

  useEffect(() => {
    const supabase = getSupabase()
    const name = `path-draw:${marketId}`
    const { channel, isFirstAcquire } = acquireChannel(supabase, name, { config: { private: true } })
    // Each consumer attaches its own listener so it can populate its own
    // `liveDraws` state. This is intentionally per-instance — DrawingLayer is
    // currently the sole consumer per market, so multi-mount does not arise.
    // If multi-mount ever becomes a real use case, refactor `liveDraws` into a
    // Zustand store keyed by marketId and gate listener attach on
    // `isFirstAcquire` like `useComments` does.
    void isFirstAcquire
    channel
      .on('broadcast', { event: 'draw_frame' }, ({ payload }: { payload: DrawFrame }) => {
        if (payload.wallet === selfWallet) return
        setLiveDraws((prev) => ({ ...prev, [payload.wallet]: payload }))
      })
      .subscribe()

    const sweep = setInterval(() => {
      const cutoff = Date.now() - STALE_MS
      setLiveDraws((prev) => {
        let changed = false
        const next: Record<string, DrawFrame> = {}
        for (const [k, v] of Object.entries(prev)) {
          if (v.timestamp >= cutoff) next[k] = v
          else changed = true
        }
        return changed ? next : prev
      })
    }, 1000)

    return () => {
      clearInterval(sweep)
      releaseChannel(supabase, name)
    }
  }, [marketId, selfWallet])

  return { liveDraws }
}

export function usePublishDrawFrame(
  marketId: string,
  selfWallet: string | null,
): (frame: DrawFrame) => void {
  const lastSentRef = useRef<number>(0)
  const pendingRef  = useRef<DrawFrame | null>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    const frame = pendingRef.current
    pendingRef.current = null
    timerRef.current = null
    if (!frame) return
    const supabase = getSupabase()
    const name = `path-draw:${marketId}`
    const { channel } = acquireChannel(supabase, name, { config: { private: true } })
    void channel.send({ type: 'broadcast', event: 'draw_frame', payload: frame })
    lastSentRef.current = Date.now()
    releaseChannel(supabase, name)
  }, [marketId])

  // Cleanup any pending trailing-edge timer on unmount so we don't fire
  // `flush()` (which touches the channel registry) after the component is
  // gone. Without this, a fast unmount mid-throttle-window leaks a setTimeout
  // and a stray send.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      pendingRef.current = null
    }
  }, [])

  return useCallback((frame: DrawFrame) => {
    if (!selfWallet) return
    const now = Date.now()
    if (now - lastSentRef.current >= THROTTLE_MS) {
      pendingRef.current = frame
      flush()
    } else {
      pendingRef.current = frame
      if (!timerRef.current) {
        const wait = THROTTLE_MS - (now - lastSentRef.current)
        timerRef.current = setTimeout(flush, wait)
      }
    }
  }, [selfWallet, flush])
}

export type SaveProfileInput = {
  walletAddress: string
  walletName: string
  username: string
  displayName: string
  bio: string
  xId: string
  avatarSigilIdx: number
  avatarKind: ProfileAvatarKind
  avatarPreview: string | null
  existingProfile: Profile | null
}

export function useProfile(walletAddress: string | null): UseQueryResult<Profile | null> {
  return useQuery<Profile | null>({
    queryKey: ['supabase', 'profile', walletAddress],
    enabled: Boolean(walletAddress),
    queryFn: async () => {
      if (!walletAddress) return null
      const { data, error } = await getSupabase()
        .from('users')
        .select(PROFILE_COLUMNS)
        .eq('wallet_address', walletAddress)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data ?? null) as Profile | null
    },
  })
}

export async function checkUsernameAvailability(
  username: string,
  walletAddress: string | null,
): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('wallet_address')
    .eq('username', username)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return true
  return data.wallet_address === walletAddress
}

export function useSaveProfile(): UseMutationResult<Profile, Error, SaveProfileInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input) => {
      const {
        walletAddress,
        walletName,
        username,
        displayName,
        bio,
        xId,
        avatarSigilIdx,
        avatarKind,
        avatarPreview,
        existingProfile,
      } = input

      const supabase = getSupabase()
      let avatarImagePath = existingProfile?.avatar_image_path ?? null

      if (avatarKind === 'image') {
        if (!avatarPreview) throw new Error('Profile image is missing')
        if (avatarPreview.startsWith('data:')) {
          avatarImagePath = await uploadProfileAvatar(walletAddress, avatarPreview)
        } else if (!avatarImagePath) {
          throw new Error('Profile image path is missing')
        }
      } else if (avatarImagePath) {
        const { error: removeError } = await supabase.storage.from(PROFILE_BUCKET).remove([avatarImagePath])
        if (removeError) throw new Error(removeError.message)
        avatarImagePath = null
      }

      const payload = {
        wallet_address: walletAddress,
        wallet_name: walletName,
        username,
        display_name: displayName,
        bio,
        x_id: xId,
        avatar_kind: avatarKind,
        avatar_sigil_idx: avatarSigilIdx,
        avatar_image_path: avatarImagePath,
      }

      const { data, error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'wallet_address' })
        .select(PROFILE_COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      return data as unknown as Profile
    },
    onSuccess: (profile) => {
      qc.setQueryData(['supabase', 'profile', profile.wallet_address], profile)
    },
  })
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then(async (res) => {
    if (!res.ok) throw new Error('Could not read cropped image')
    return res.blob()
  })
}

async function uploadProfileAvatar(walletAddress: string, dataUrl: string): Promise<string> {
  const filePath = `${walletAddress}/avatar.png`
  const blob = await dataUrlToBlob(dataUrl)
  const { error } = await getSupabase()
    .storage
    .from(PROFILE_BUCKET)
    .upload(filePath, blob, {
      cacheControl: '3600',
      contentType: blob.type || 'image/png',
      upsert: true,
    })

  if (error) throw new Error(error.message)
  return filePath
}

export function getProfileImageUrl(path: string | null): string | null {
  if (!path) return null
  return getSupabase().storage.from(PROFILE_BUCKET).getPublicUrl(path).data.publicUrl
}
