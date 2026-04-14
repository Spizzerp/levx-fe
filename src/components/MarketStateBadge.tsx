import { StatusDot } from '@/components/StatusDot'
import { formatCountdown } from '@/lib/format'
import type { Market, MarketState } from '@/types/market'

type ProseFn = (m: Market) => string

/**
 * Compact date/time formatter for Pending / Active prose.
 * Local-time, month + day + time. Example: "Apr 13, 2:30 PM".
 */
function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const STATE_PROSE: Record<MarketState, ProseFn> = {
  pending: (m) => `Wagering opens ${formatDateTime(m.startTime)}`,
  active: (m) => `Wager open until ${formatDateTime(m.endTime)}`,
  sampling: () => 'Final wagers; checkpoint scoring underway',
  settling: () => 'Final score being computed; no new wagers',
  maturing: (m) =>
    `Review window; claims open in ${formatCountdown(Math.max(0, m.endTime - Date.now()))}`,
  settled: () => 'Claim available',
  void: () => 'Market cancelled',
}

const STATE_LABELS: Record<MarketState, string> = {
  pending: 'Pending',
  active: 'Active',
  sampling: 'Sampling',
  settling: 'Settling',
  maturing: 'Maturing',
  settled: 'Settled',
  void: 'Void',
}

interface MarketStateBadgeProps {
  market: Market
}

/**
 * 7-state lifecycle badge: StatusDot (color-coded per state) + label + prose.
 * Prose map is locked per RESEARCH.md — phrasing captured in STATE_PROSE.
 */
export function MarketStateBadge({ market }: MarketStateBadgeProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <StatusDot status={market.state}>{STATE_LABELS[market.state]}</StatusDot>
      <span className="text-ink-dim font-mono text-label tracking-wide uppercase">
        {STATE_PROSE[market.state](market)}
      </span>
    </div>
  )
}
