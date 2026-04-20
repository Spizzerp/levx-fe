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
