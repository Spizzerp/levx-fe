import { getMarketDisplayState } from '@/lib/market/status'
import { MARKET_GROUP_CONSTRAINT_FLAGS } from '@/lib/marketGroups'
import type {
  Market,
  MarketGroupProductMetadata,
  MarketGroupKind,
  MarketGroupStatus,
  MarketSeasonMetadata,
  MarketState,
} from '@/types/market'

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
  groupMetadata?: MarketGroupProductMetadata
  slug?: string
  metadataSource: 'indexed' | 'inferred'
  seasonMetadata?: MarketSeasonMetadata
  seasonKey?: string
  seasonId?: string | null
  productSeason?: string
  horizonLabel?: string
  description?: string | null
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
  sortOrder: number
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

function formatHorizonLabel(horizon?: string, timeframeSeconds?: number): string | undefined {
  if (!horizon) return formatTimeframeLabel(timeframeSeconds)
  const match = horizon.match(/^(\d+)([a-zA-Z]+)$/)
  if (!match) return horizon.toUpperCase()
  return `${match[1]}${match[2].toUpperCase()}`
}

function productSeasonFromTime(startTime: number): string {
  return String(new Date(startTime).getUTCFullYear())
}

function parseProviderSeasonKey(market: Market): MarketSeasonMetadata | undefined {
  if (!market.seasonKey) return undefined
  const parts = market.seasonKey.split(':')
  if (parts.length !== 3) return undefined
  const [pair, productSeason, horizon] = parts
  if (pair !== market.pair || !productSeason || !horizon) return undefined

  return {
    seasonKey: market.seasonKey,
    groupKeyHash: market.groupKeyHash ?? null,
    groupKind: market.groupKind ?? null,
    parentGroup: market.parentGroup ?? market.group?.parentGroup ?? null,
    pair,
    productSeason,
    horizon,
    timeframeSeconds:
      market.timeframeSeconds ?? Math.round((market.endTime - market.startTime) / 1000),
    startTime: market.startTime,
    endTime: market.endTime,
  }
}

function inferSeasonMetadata(market: Market): MarketSeasonMetadata | undefined {
  if (!market.groupKeyHash || !market.timeframeSeconds) return undefined
  if (
    market.groupKind !== 'season' &&
    market.groupKind !== 'assetSeason' &&
    market.groupKind !== 'horizon'
  ) {
    return undefined
  }

  const horizon = formatTimeframeLabel(market.timeframeSeconds)?.toLowerCase()
  if (!horizon) return undefined

  return {
    seasonKey: `${market.pair}:${productSeasonFromTime(market.startTime)}:${horizon}`,
    groupKeyHash: market.groupKeyHash,
    groupKind: market.groupKind,
    parentGroup: market.parentGroup ?? market.group?.parentGroup ?? null,
    pair: market.pair,
    productSeason: productSeasonFromTime(market.startTime),
    horizon,
    timeframeSeconds: market.timeframeSeconds,
    startTime: market.startTime,
    endTime: market.endTime,
  }
}

export function getMarketSeasonMetadata(market: Market): MarketSeasonMetadata | undefined {
  return market.seasonMetadata ?? parseProviderSeasonKey(market) ?? inferSeasonMetadata(market)
}

function preferSeasonMetadata(
  current: MarketSeasonMetadata | undefined,
  next: MarketSeasonMetadata | undefined,
): MarketSeasonMetadata | undefined {
  if (!current) return next
  if (!next) return current
  if (next.displayName && !current.displayName) return next
  if (next.description && !current.description) return { ...current, description: next.description }
  return current
}

export function formatMarketGroupLabel(args: {
  groupKind?: MarketGroupKind
  groupKeyHash?: string
  groupMetadata?: MarketGroupProductMetadata
  pair?: string
  pairCount?: number
  seasonMetadata?: MarketSeasonMetadata
  timeframeSeconds?: number
}): string {
  if (!args.groupKeyHash) return 'Ungrouped'
  if (args.groupMetadata?.displayName) return args.groupMetadata.displayName
  if (args.seasonMetadata?.displayName) return args.seasonMetadata.displayName

  const kind = args.groupKind ? MARKET_GROUP_KIND_LABELS[args.groupKind] : undefined
  const timeframe = formatTimeframeLabel(args.timeframeSeconds)
  const scope = args.pairCount && args.pairCount > 1 ? `${args.pairCount} pairs` : args.pair
  const season = args.seasonMetadata?.productSeason
  const horizon = formatHorizonLabel(
    args.seasonMetadata?.horizon,
    args.seasonMetadata?.timeframeSeconds,
  )

  if (scope && season && horizon) return `${scope} ${season} ${horizon} ${kind ?? 'Group'}`
  if (scope && timeframe) return `${scope} ${timeframe} ${kind ?? 'Group'}`
  if (scope) return `${scope} ${kind ?? 'Group'}`
  if (season && horizon) return `${season} ${horizon} ${kind ?? 'Group'}`
  if (timeframe) return `${timeframe} ${kind ?? 'Group'}`
  return `${kind ?? 'Group'} ${args.groupKeyHash.slice(0, 8)}`
}

export function marketGroupRouteParams(
  summary: Pick<MarketGroupSummary, 'groupKeyHash' | 'slug'>,
):
  | { to: '/markets/groups/$slug'; params: { slug: string } }
  | { to: '/markets/group/$groupKeyHash'; params: { groupKeyHash: string } } {
  if (summary.slug) {
    return { to: '/markets/groups/$slug', params: { slug: summary.slug } }
  }
  return { to: '/markets/group/$groupKeyHash', params: { groupKeyHash: summary.groupKeyHash } }
}

export function getMarketsForGroup(
  markets: readonly Market[] | undefined,
  groupKeyHash: string,
): Market[] {
  return (markets ?? []).filter((market) => market.groupKeyHash === groupKeyHash)
}

export function getMarketsForGroupSlug(
  markets: readonly Market[] | undefined,
  slug: string,
): Market[] {
  return (markets ?? []).filter((market) => market.groupMetadata?.slug === slug)
}

export function buildMarketGroupSummaries(
  markets: readonly Market[] | undefined,
): MarketGroupSummary[] {
  const summaries = new Map<string, MarketGroupSummary>()

  for (const market of markets ?? []) {
    if (!market.groupKeyHash) continue

    const existing = summaries.get(market.groupKeyHash)
    const marketSeasonMetadata = getMarketSeasonMetadata(market)
    const marketGroupMetadata = market.groupMetadata
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
        groupMetadata: marketGroupMetadata,
        slug: marketGroupMetadata?.slug,
        metadataSource: marketGroupMetadata ? 'indexed' : 'inferred',
        seasonMetadata: marketSeasonMetadata,
        seasonKey: marketSeasonMetadata?.seasonKey ?? market.seasonKey,
        seasonId: marketSeasonMetadata?.seasonId,
        productSeason: marketSeasonMetadata?.productSeason,
        horizonLabel: formatHorizonLabel(
          marketSeasonMetadata?.horizon,
          marketSeasonMetadata?.timeframeSeconds,
        ),
        description: marketGroupMetadata?.description ?? marketSeasonMetadata?.description,
        timeframeSeconds: market.timeframeSeconds,
        timeframeLabel: formatTimeframeLabel(market.timeframeSeconds),
        childMarketCount: market.group?.childMarketCount,
        label: formatMarketGroupLabel({
          groupKind: market.groupKind,
          groupKeyHash: market.groupKeyHash,
          pair: market.pair,
          seasonMetadata: marketSeasonMetadata,
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
        sortOrder: marketGroupMetadata?.sortOrder ?? 0,
      } satisfies MarketGroupSummary)

    const stateBucket = countState(getMarketDisplayState(market))
    if (!summary.kind && market.groupKind) summary.kind = market.groupKind
    if (!summary.status && market.group?.status) summary.status = market.group.status
    summary.parentGroup ??= market.parentGroup ?? market.group?.parentGroup
    summary.primaryPair ??= market.pair
    if (!summary.pairs.includes(market.pair)) summary.pairs.push(market.pair)
    if (!summary.groupMetadata && marketGroupMetadata) {
      summary.groupMetadata = marketGroupMetadata
      summary.slug = marketGroupMetadata.slug
      summary.metadataSource = 'indexed'
      summary.sortOrder = marketGroupMetadata.sortOrder
    }
    summary.seasonMetadata = preferSeasonMetadata(summary.seasonMetadata, marketSeasonMetadata)
    summary.seasonKey ??= summary.seasonMetadata?.seasonKey ?? market.seasonKey
    summary.seasonId ??= summary.seasonMetadata?.seasonId
    summary.productSeason ??=
      summary.groupMetadata?.productSeason ?? summary.seasonMetadata?.productSeason
    summary.horizonLabel ??= formatHorizonLabel(
      summary.groupMetadata?.horizon ?? summary.seasonMetadata?.horizon,
      summary.groupMetadata?.timeframeSeconds ?? summary.seasonMetadata?.timeframeSeconds,
    )
    summary.description ??=
      summary.groupMetadata?.description ?? summary.seasonMetadata?.description
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
      groupMetadata: summary.groupMetadata,
      pair: summary.primaryPair,
      pairCount: summary.pairs.length,
      seasonMetadata: summary.seasonMetadata,
      timeframeSeconds: summary.timeframeSeconds,
    })
    summary.subtitle = formatMarketGroupSubtitle(summary)

    summaries.set(market.groupKeyHash, summary)
  }

  return Array.from(summaries.values()).sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      String(a.status ?? '').localeCompare(String(b.status ?? '')) ||
      a.label.localeCompare(b.label),
  )
}

function formatMarketGroupSubtitle(summary: MarketGroupSummary): string {
  if (summary.description) return summary.description

  const scope =
    summary.pairs.length > 1
      ? `${summary.pairs.length} pairs`
      : (summary.primaryPair ?? 'Market group')
  const context = summary.kind ? MARKET_GROUP_KIND_CONTEXT[summary.kind] : 'Group'
  const productSeason = summary.productSeason ? ` · ${summary.productSeason} season` : ''
  const horizon = summary.horizonLabel ? ` · ${summary.horizonLabel} horizon` : ''
  const timeframe =
    !summary.horizonLabel && summary.timeframeLabel ? ` · ${summary.timeframeLabel}` : ''
  const children = `${summary.totalMarkets} ${summary.totalMarkets === 1 ? 'market' : 'markets'}`
  return `${scope}${productSeason}${horizon}${timeframe} · ${context ?? 'Group'} · ${children}`
}
