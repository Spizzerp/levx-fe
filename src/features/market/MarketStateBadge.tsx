import { StatusDot } from '@/ui/StatusDot'
import { getMarketDisplayState } from '@/lib/market/status'
import type { Market, MarketState } from '@/types/market'

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
 * Prose map is defined in marketStateProse.ts per RESEARCH.md.
 */
export function MarketStateBadge({ market }: MarketStateBadgeProps) {
  const displayState = getMarketDisplayState(market)

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <StatusDot status={displayState}>{STATE_LABELS[displayState]}</StatusDot>
    </div>
  )
}
