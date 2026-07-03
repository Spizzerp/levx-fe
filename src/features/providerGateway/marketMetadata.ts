import { apiFetch } from '@/api/client'
import { env } from '@/env'
import type { Market, MarketSeasonMetadata } from '@/types/market'

import type {
  ProviderMarketContext,
  ProviderMarketContextsResponse,
  ProviderSeasonMetadata,
} from './types'

function hasPipelineApiBase(): boolean {
  return env.APP_API_BASE_URL.trim().length > 0
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /API request failed:\s+404\b/.test(error.message)
}

function providerSeasonFromContext(context: ProviderMarketContext): ProviderSeasonMetadata {
  return (
    context.season ?? {
      season_key: context.season_key,
      season_id: context.season_id ?? null,
      asset_season_address: null,
      parent_status: null,
      group_key_hash: context.group_key_hash ?? null,
      group_kind: context.group_kind ?? null,
      parent_group: context.parent_group ?? null,
      pair: context.pair,
      product_season: context.season_key.split(':')[1] ?? '',
      horizon: context.season_key.split(':')[2] ?? `${context.timeframe_seconds}s`,
      timeframe_seconds: context.timeframe_seconds,
      start_time: context.start_time,
      end_time: context.end_time,
    }
  )
}

export function providerSeasonMetadataToMarketSeasonMetadata(
  season: ProviderSeasonMetadata,
): MarketSeasonMetadata {
  return {
    seasonKey: season.season_key,
    seasonId: season.season_id ?? null,
    assetSeasonAddress: season.asset_season_address ?? null,
    parentStatus: season.parent_status ?? null,
    groupKeyHash: season.group_key_hash ?? null,
    groupKind: season.group_kind ?? null,
    parentGroup: season.parent_group ?? null,
    pair: season.pair,
    productSeason: season.product_season,
    horizon: season.horizon,
    timeframeSeconds: season.timeframe_seconds,
    startTime: season.start_time * 1000,
    endTime: season.end_time * 1000,
    displayName: season.display_name ?? null,
    description: season.description ?? null,
  }
}

export function providerMarketContextToSeasonMetadata(
  context: ProviderMarketContext,
): MarketSeasonMetadata {
  return providerSeasonMetadataToMarketSeasonMetadata(providerSeasonFromContext(context))
}

export function attachProviderSeasonMetadata(
  markets: readonly Market[],
  contexts: readonly ProviderMarketContext[],
): Market[] {
  if (markets.length === 0 || contexts.length === 0) return [...markets]

  const metadataByMarketId = new Map<number, MarketSeasonMetadata>()
  for (const context of contexts) {
    metadataByMarketId.set(context.market_id, providerMarketContextToSeasonMetadata(context))
  }

  return markets.map((market) => {
    const seasonMetadata = metadataByMarketId.get(market.marketId)
    if (!seasonMetadata) return market
    return { ...market, seasonMetadata }
  })
}

export async function fetchProviderMarketContexts(): Promise<ProviderMarketContext[]> {
  if (!hasPipelineApiBase()) return []
  const response = await apiFetch<ProviderMarketContextsResponse>(
    '/api/v1/provider-markets/contexts',
  )
  return Array.isArray(response.markets) ? response.markets : []
}

export async function enrichMarketsWithProviderSeasonMetadata(
  markets: Market[],
): Promise<Market[]> {
  if (markets.length === 0 || !hasPipelineApiBase()) return markets

  try {
    const contexts = await fetchProviderMarketContexts()
    return attachProviderSeasonMetadata(markets, contexts)
  } catch (error) {
    if (isNotFoundError(error)) return markets
    console.warn(
      '[providerGateway] Failed to fetch provider market contexts:',
      error instanceof Error ? error.message : error,
    )
    return markets
  }
}

export async function enrichMarketWithProviderSeasonMetadata(market: Market): Promise<Market> {
  if (!hasPipelineApiBase()) return market

  try {
    const context = await apiFetch<ProviderMarketContext>(
      `/api/v1/provider-markets/${market.marketId}/context`,
    )
    return attachProviderSeasonMetadata([market], [context])[0] ?? market
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.warn(
        '[providerGateway] Failed to fetch provider market context:',
        error instanceof Error ? error.message : error,
      )
    }
    return market
  }
}
