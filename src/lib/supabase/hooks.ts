import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  useMutation, useQuery, useQueryClient,
  type UseQueryResult, type UseMutationResult,
} from '@tanstack/react-query'

import { SupabaseAuthContext, type AuthContextValue } from './provider'
import { getSupabase } from './client'
import { acquireChannel, releaseChannel } from './channels'
import type { Comment, DrawFrame } from './types'

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
