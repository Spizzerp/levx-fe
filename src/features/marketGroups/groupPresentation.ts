import { getMarketDisplayState } from '@/lib/market/status'
import { MARKET_GROUP_CONSTRAINT_FLAGS } from '@/lib/marketGroups'
import type { Market, MarketGroupKind, MarketState } from '@/types/market'

export type MarketGroupSummary = {
  groupKeyHash: string
  label: string
  totalMarkets: number
  activeMarkets: number
  pendingMarkets: number
  settledMarkets: number
  endTime?: number
  totalPool: number
  totalTraders: number
}

const MARKET_GROUP_KIND_LABELS: Partial<Record<MarketGroupKind, string>> = {
  root: 'Root',
  league: 'League',
  season: 'Season',
  game: 'Game',
  event: 'Event',
  assetSeason: 'Asset season',
  horizon: 'Horizon',
  custom: 'Custom',
}

function countState(
  state: MarketState,
): 'activeMarkets' | 'pendingMarkets' | 'settledMarkets' | null {
  if (state === 'pending') return 'pendingMarkets'
  if (state === 'settled') return 'settledMarkets'
  if (state === 'active' || state === 'sampling') return 'activeMarkets'
  return null
}

export function formatMarketGroupLabel(args: {
  groupKind?: MarketGroupKind
  groupKeyHash?: string
}): string {
  if (!args.groupKeyHash) return 'Ungrouped'
  const kind = args.groupKind ? MARKET_GROUP_KIND_LABELS[args.groupKind] : undefined
  return `${kind ?? 'Group'} ${args.groupKeyHash.slice(0, 8)}`
}

export function getMarketsForGroup(
  markets: readonly Market[] | undefined,
  groupKeyHash: string,
): Market[] {
  return (markets ?? []).filter((market) => market.groupKeyHash === groupKeyHash)
}

export function buildMarketGroupSummaries(
  markets: readonly Market[] | undefined,
): MarketGroupSummary[] {
  const summaries = new Map<string, MarketGroupSummary>()

  for (const market of markets ?? []) {
    if (!market.groupKeyHash) continue

    const existing = summaries.get(market.groupKeyHash)
    const summary =
      existing ??
      ({
        groupKeyHash: market.groupKeyHash,
        label: formatMarketGroupLabel({
          groupKind: market.groupKind,
          groupKeyHash: market.groupKeyHash,
        }),
        totalMarkets: 0,
        activeMarkets: 0,
        pendingMarkets: 0,
        settledMarkets: 0,
        endTime:
          market.group &&
          (market.group.constraintFlags & MARKET_GROUP_CONSTRAINT_FLAGS.timeWindow) !== 0
            ? market.group.endTime
            : undefined,
        totalPool: 0,
        totalTraders: 0,
      } satisfies MarketGroupSummary)

    const stateBucket = countState(getMarketDisplayState(market))
    summary.totalMarkets += 1
    summary.totalPool += market.pool
    summary.totalTraders += market.traders
    if (stateBucket) summary[stateBucket] += 1

    summaries.set(market.groupKeyHash, summary)
  }

  return Array.from(summaries.values()).sort((a, b) => a.label.localeCompare(b.label))
}
