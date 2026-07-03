import { getMarketDisplayState } from '@/lib/market/status'
import { MARKET_GROUP_CONSTRAINT_FLAGS } from '@/lib/marketGroups'
import type { Market, MarketGroupKind, MarketGroupStatus, MarketState } from '@/types/market'

export type MarketGroupSummary = {
  groupKeyHash: string
  label: string
  subtitle: string
  shortHash: string
  kind?: MarketGroupKind
  status?: MarketGroupStatus
  parentGroup?: string | null
  primaryPair?: string
  pairs: string[]
  timeframeSeconds?: number
  timeframeLabel?: string
  childMarketCount?: number
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
  assetSeason: 'Season',
  horizon: 'Horizon',
  custom: 'Custom',
}

const MARKET_GROUP_KIND_CONTEXT: Partial<Record<MarketGroupKind, string>> = {
  root: 'Root group',
  league: 'League',
  season: 'Season',
  game: 'Game slate',
  event: 'Event',
  assetSeason: 'Asset season',
  horizon: 'Horizon',
  custom: 'Group',
}

function countState(
  state: MarketState,
): 'activeMarkets' | 'pendingMarkets' | 'settledMarkets' | null {
  if (state === 'pending') return 'pendingMarkets'
  if (state === 'settled') return 'settledMarkets'
  if (state === 'active' || state === 'sampling') return 'activeMarkets'
  return null
}

function getGroupWindowEndTime(market: Market): number | undefined {
  return market.group &&
    (market.group.constraintFlags & MARKET_GROUP_CONSTRAINT_FLAGS.timeWindow) !== 0
    ? market.group.endTime
    : undefined
}

export function formatMarketGroupHash(groupKeyHash: string): string {
  return `${groupKeyHash.slice(0, 8)}...${groupKeyHash.slice(-6)}`
}

export function formatTimeframeLabel(timeframeSeconds?: number): string | undefined {
  if (!timeframeSeconds || timeframeSeconds <= 0) return undefined
  if (timeframeSeconds % 604_800 === 0) return `${timeframeSeconds / 604_800}W`
  if (timeframeSeconds % 86_400 === 0) return `${timeframeSeconds / 86_400}D`
  if (timeframeSeconds % 3_600 === 0) return `${timeframeSeconds / 3_600}H`
  if (timeframeSeconds % 60 === 0) return `${timeframeSeconds / 60}M`
  return `${timeframeSeconds}S`
}

export function formatMarketGroupLabel(args: {
  groupKind?: MarketGroupKind
  groupKeyHash?: string
  pair?: string
  pairCount?: number
  timeframeSeconds?: number
}): string {
  if (!args.groupKeyHash) return 'Ungrouped'
  const kind = args.groupKind ? MARKET_GROUP_KIND_LABELS[args.groupKind] : undefined
  const timeframe = formatTimeframeLabel(args.timeframeSeconds)
  const scope = args.pairCount && args.pairCount > 1 ? `${args.pairCount} pairs` : args.pair

  if (scope && timeframe) return `${scope} ${timeframe} ${kind ?? 'Group'}`
  if (scope) return `${scope} ${kind ?? 'Group'}`
  if (timeframe) return `${timeframe} ${kind ?? 'Group'}`
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
        shortHash: formatMarketGroupHash(market.groupKeyHash),
        kind: market.groupKind,
        status: market.group?.status,
        parentGroup: market.parentGroup ?? market.group?.parentGroup,
        primaryPair: market.pair,
        pairs: [],
        timeframeSeconds: market.timeframeSeconds,
        timeframeLabel: formatTimeframeLabel(market.timeframeSeconds),
        childMarketCount: market.group?.childMarketCount,
        label: formatMarketGroupLabel({
          groupKind: market.groupKind,
          groupKeyHash: market.groupKeyHash,
          pair: market.pair,
          timeframeSeconds: market.timeframeSeconds,
        }),
        subtitle: '',
        totalMarkets: 0,
        activeMarkets: 0,
        pendingMarkets: 0,
        settledMarkets: 0,
        endTime: getGroupWindowEndTime(market),
        totalPool: 0,
        totalTraders: 0,
      } satisfies MarketGroupSummary)

    const stateBucket = countState(getMarketDisplayState(market))
    if (!summary.kind && market.groupKind) summary.kind = market.groupKind
    if (!summary.status && market.group?.status) summary.status = market.group.status
    summary.parentGroup ??= market.parentGroup ?? market.group?.parentGroup
    summary.primaryPair ??= market.pair
    if (!summary.pairs.includes(market.pair)) summary.pairs.push(market.pair)
    summary.timeframeSeconds ??= market.timeframeSeconds
    summary.timeframeLabel ??= formatTimeframeLabel(market.timeframeSeconds)
    summary.childMarketCount ??= market.group?.childMarketCount
    summary.endTime ??= getGroupWindowEndTime(market)
    summary.totalMarkets += 1
    summary.totalPool += market.pool
    summary.totalTraders += market.traders
    if (stateBucket) summary[stateBucket] += 1
    summary.label = formatMarketGroupLabel({
      groupKind: summary.kind,
      groupKeyHash: summary.groupKeyHash,
      pair: summary.primaryPair,
      pairCount: summary.pairs.length,
      timeframeSeconds: summary.timeframeSeconds,
    })
    summary.subtitle = formatMarketGroupSubtitle(summary)

    summaries.set(market.groupKeyHash, summary)
  }

  return Array.from(summaries.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function formatMarketGroupSubtitle(summary: MarketGroupSummary): string {
  const scope =
    summary.pairs.length > 1
      ? `${summary.pairs.length} pairs`
      : (summary.primaryPair ?? 'Market group')
  const context = summary.kind ? MARKET_GROUP_KIND_CONTEXT[summary.kind] : 'Group'
  const timeframe = summary.timeframeLabel ? ` · ${summary.timeframeLabel}` : ''
  const children = `${summary.totalMarkets} ${summary.totalMarkets === 1 ? 'market' : 'markets'}`
  return `${scope}${timeframe} · ${context ?? 'Group'} · ${children}`
}
