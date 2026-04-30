import { useQuery } from '@tanstack/react-query'

import { cn } from '@/lib/cn'
import { getSupabase } from '@/lib/supabase/client'

/**
 * Liveness dot for the keeper poll loop.
 *
 * Reads `public.keeper_heartbeat` once per minute via the anon
 * Supabase client. The keeper writes `updated_at = now()` once per
 * poll cycle (~15s by default), so a healthy keeper's `updated_at`
 * is always ≤ ~30s in the past. We bucket the staleness into:
 *
 *   green  — fresh (`<= GREEN_THRESHOLD_S` since last update)
 *   amber  — stale but recent (`<= AMBER_THRESHOLD_S`)
 *   red    — likely dead (`> AMBER_THRESHOLD_S`)
 *
 * Renders a 6×6px dot in the footer with a tooltip naming the
 * exact age. Renders nothing on initial fetch / network failure
 * rather than mis-signaling — operators can check the keeper
 * health directly via Railway logs in those cases.
 */

const GREEN_THRESHOLD_S = 60
const AMBER_THRESHOLD_S = 5 * 60
const REFETCH_MS = 60_000

interface HeartbeatRow {
  updated_at: string
}

export function KeeperHealthDot({ className }: { className?: string }) {
  const { data } = useQuery<HeartbeatRow | null>({
    queryKey: ['keeperHeartbeat'],
    queryFn: async () => {
      const sb = getSupabase()
      const { data: row, error } = await sb
        .from('keeper_heartbeat')
        .select('updated_at')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      return row as HeartbeatRow | null
    },
    refetchInterval: REFETCH_MS,
    staleTime: 30_000,
  })

  if (!data) return null

  // Date.now() is intentionally read at render time so the staleness
  // bucket re-evaluates each tick (the query auto-refetches every 60s
  // and React re-renders on the new data; in between, the dot stays
  // accurate enough). Memoizing wouldn't gain anything since the data
  // dep already triggers a fresh render.
  // eslint-disable-next-line react-hooks/purity
  const ageMs = Date.now() - Date.parse(data.updated_at)
  const ageS = Math.max(0, Math.round(ageMs / 1000))
  const status: 'green' | 'amber' | 'red' =
    ageS <= GREEN_THRESHOLD_S ? 'green' : ageS <= AMBER_THRESHOLD_S ? 'amber' : 'red'

  const colors = {
    green: 'bg-success',
    amber: 'bg-[color:var(--color-warning,#FBBF24)]',
    red: 'bg-accent',
  } as const

  const labels = {
    green: 'Keeper online',
    amber: 'Keeper stale',
    red: 'Keeper offline',
  } as const

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-mono text-caption uppercase',
        'text-ink-dim',
        className,
      )}
      title={`${labels[status]} — last heartbeat ${formatAge(ageS)} ago`}
      aria-label={`${labels[status]}, last heartbeat ${formatAge(ageS)} ago`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', colors[status])} aria-hidden />
      {labels[status]}
    </span>
  )
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h`
}
