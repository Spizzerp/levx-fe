import { apiFetch } from '@/api/client'
import { env } from '@/env'
import type { Market, MarketGroupProductMetadata, MarketSeasonMetadata } from '@/types/market'

import type {
  ProviderMarketGroupProductMetadata,
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

export function providerGroupMetadataToMarketGroupProductMetadata(
  metadata: ProviderMarketGroupProductMetadata,
): MarketGroupProductMetadata {
  return {
    schemaVersion: metadata.schema_version,
    groupKeyHash: metadata.group_key_hash,
    groupKind: metadata.group_kind,
    parentGroupKeyHash: metadata.parent_group_key_hash ?? null,
    slug: metadata.slug,
    displayName: metadata.display_name,
    shortName: metadata.short_name ?? null,
    description: metadata.description,
    category: metadata.category,
    pair: metadata.pair ?? null,
    baseAsset: metadata.base_asset ?? null,
    quoteAsset: metadata.quote_asset ?? null,
    productSeason: metadata.product_season ?? null,
    horizon: metadata.horizon ?? null,
    timeframeSeconds: metadata.timeframe_seconds ?? null,
    startTime: metadata.start_time == null ? null : metadata.start_time * 1000,
    endTime: metadata.end_time == null ? null : metadata.end_time * 1000,
    status: metadata.status,
    iconKey: metadata.icon_key ?? null,
    tags: metadata.tags ?? [],
    sortOrder: metadata.sort_order ?? 0,
    metadataHash: metadata.metadata_hash,
    createdAt: metadata.created_at ?? null,
    updatedAt: metadata.updated_at ?? null,
  }
}

export function providerMarketContextToSeasonMetadata(
  context: ProviderMarketContext,
): MarketSeasonMetadata {
  const seasonMetadata = providerSeasonMetadataToMarketSeasonMetadata(
    providerSeasonFromContext(context),
  )
  if (!context.group_metadata) return seasonMetadata
  const groupMetadata = providerGroupMetadataToMarketGroupProductMetadata(context.group_metadata)
  return {
    ...seasonMetadata,
    groupKeyHash: groupMetadata.groupKeyHash,
    groupKind: groupMetadata.groupKind,
    parentGroup: groupMetadata.parentGroupKeyHash ?? seasonMetadata.parentGroup,
    pair: groupMetadata.pair ?? seasonMetadata.pair,
    productSeason: groupMetadata.productSeason ?? seasonMetadata.productSeason,
    horizon: groupMetadata.horizon ?? seasonMetadata.horizon,
    timeframeSeconds: groupMetadata.timeframeSeconds ?? seasonMetadata.timeframeSeconds,
    startTime: groupMetadata.startTime ?? seasonMetadata.startTime,
    endTime: groupMetadata.endTime ?? seasonMetadata.endTime,
    displayName: groupMetadata.displayName,
    description: groupMetadata.description,
  }
}

export function attachProviderSeasonMetadata(
  markets: readonly Market[],
  contexts: readonly ProviderMarketContext[],
): Market[] {
  if (markets.length === 0 || contexts.length === 0) return [...markets]

  const metadataByMarketId = new Map<number, MarketSeasonMetadata>()
  const contextByMarketId = new Map<number, ProviderMarketContext>()
  for (const context of contexts) {
    contextByMarketId.set(context.market_id, context)
    metadataByMarketId.set(context.market_id, providerMarketContextToSeasonMetadata(context))
  }

  return markets.map((market) => {
    const context = contextByMarketId.get(market.marketId)
    const seasonMetadata = metadataByMarketId.get(market.marketId)
    if (!seasonMetadata) return market
    const groupMetadata = context?.group_metadata
      ? providerGroupMetadataToMarketGroupProductMetadata(context.group_metadata)
      : undefined
    return { ...market, seasonMetadata, groupMetadata }
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
