import { useContext, useEffect } from 'react'
import {
  useMutation, useQuery, useQueryClient,
  type UseQueryResult, type UseMutationResult,
} from '@tanstack/react-query'

import { SupabaseAuthContext, type AuthContextValue } from './provider'
import { getSupabase } from './client'
import { acquireChannel, releaseChannel } from './channels'
import type { Comment } from './types'

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
    const channel = acquireChannel(supabase, name, { config: {} })
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
