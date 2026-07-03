import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProviderMarketContext } from '@/features/providerGateway/types'
import type { Market } from '@/types/market'

const mockApiFetch = vi.hoisted(() => vi.fn())
const mockEnv = vi.hoisted(() => ({ APP_API_BASE_URL: 'https://pipeline.example' }))

vi.mock('@/api/client', () => ({
  apiFetch: mockApiFetch,
}))

vi.mock('@/env', () => ({
  env: mockEnv,
}))

import {
  attachProviderSeasonMetadata,
  enrichMarketWithProviderSeasonMetadata,
  enrichMarketsWithProviderSeasonMetadata,
  providerGroupMetadataToMarketGroupProductMetadata,
  providerMarketContextToSeasonMetadata,
} from '../marketMetadata'

function market(overrides: Partial<Market> = {}): Market {
  return {
    id: '7',
    marketId: 7,
    pair: 'SOL/USDC',
    startTime: 1_779_010_000_000,
    endTime: 1_779_096_400_000,
    seasonKey: `season:${'ab'.repeat(32)}:86400`,
    ...overrides,
  } as Market
}

function providerContext(overrides: Partial<ProviderMarketContext> = {}): ProviderMarketContext {
  return {
    market_id: 7,
    season_key: 'SOL/USDC:2026:1d',
    season_id: 'sol-2026',
    group_key_hash: 'ab'.repeat(32),
    group_kind: 'season',
    parent_group: null,
    pair: 'SOL/USDC',
    start_time: 1_779_010_000,
    end_time: 1_779_096_400,
    checkpoint_interval: 3_600,
    timeframe_seconds: 86_400,
    checkpoint_timestamps: [1_779_013_600, 1_779_096_400],
    price_scale: 1_000_000,
    target_num_paths: 5,
    submission_deadline: 1_779_005_000,
    pyth_feed_id: 'ef'.repeat(32),
    season: {
      season_key: 'SOL/USDC:2026:1d',
      season_id: 'sol-2026',
      asset_season_address: 'AssetSeason111111111111111111111111111111',
      parent_status: 'active',
      group_key_hash: 'ab'.repeat(32),
      group_kind: 'season',
      parent_group: null,
      pair: 'SOL/USDC',
      product_season: '2026',
      horizon: '1d',
      timeframe_seconds: 86_400,
      start_time: 1_779_010_000,
      end_time: 1_779_096_400,
      display_name: 'SOL 2026 Daily Season',
      description: 'Provider-indexed daily SOL markets.',
    },
    ...overrides,
  }
}

describe('provider market metadata', () => {
  beforeEach(() => {
    mockApiFetch.mockReset()
    mockEnv.APP_API_BASE_URL = 'https://pipeline.example'
  })

  it('maps provider season metadata into MarketSeasonMetadata', () => {
    const metadata = providerMarketContextToSeasonMetadata(providerContext())

    expect(metadata).toMatchObject({
      seasonKey: 'SOL/USDC:2026:1d',
      seasonId: 'sol-2026',
      assetSeasonAddress: 'AssetSeason111111111111111111111111111111',
      parentStatus: 'active',
      groupKeyHash: 'ab'.repeat(32),
      groupKind: 'season',
      pair: 'SOL/USDC',
      productSeason: '2026',
      horizon: '1d',
      timeframeSeconds: 86_400,
      displayName: 'SOL 2026 Daily Season',
      description: 'Provider-indexed daily SOL markets.',
    })
    expect(metadata.startTime).toBe(1_779_010_000_000)
    expect(metadata.endTime).toBe(1_779_096_400_000)
  })

  it('attaches indexed metadata by market id without replacing the chain grouping key', () => {
    const [enriched] = attachProviderSeasonMetadata([market()], [providerContext()])

    expect(enriched.seasonMetadata?.displayName).toBe('SOL 2026 Daily Season')
    expect(enriched.seasonMetadata?.seasonKey).toBe('SOL/USDC:2026:1d')
    expect(enriched.seasonKey).toBe(`season:${'ab'.repeat(32)}:86400`)
  })

  it('prefers rich group metadata when provider contexts include it', () => {
    const context = providerContext({
      group_metadata: {
        schema_version: 1,
        group_key_hash: 'ab'.repeat(32),
        group_kind: 'Season',
        parent_group_key_hash: null,
        slug: 'sol-usdc-2026-1d-season',
        display_name: 'SOL/USDC 2026 1D Season',
        short_name: 'SOL 1D',
        description: 'Rich product metadata description.',
        category: 'crypto',
        pair: 'SOL/USDC',
        base_asset: 'SOL',
        quote_asset: 'USDC',
        product_season: '2026',
        horizon: '1d',
        timeframe_seconds: 86_400,
        start_time: 1_779_010_000,
        end_time: 1_779_096_400,
        status: 'active',
        icon_key: 'sol',
        tags: ['sol', 'daily'],
        sort_order: 10,
        metadata_hash: 'cd'.repeat(32),
      },
    })

    const [enriched] = attachProviderSeasonMetadata([market()], [context])

    expect(providerGroupMetadataToMarketGroupProductMetadata(context.group_metadata!).slug).toBe(
      'sol-usdc-2026-1d-season',
    )
    expect(enriched.groupMetadata?.slug).toBe('sol-usdc-2026-1d-season')
    expect(enriched.groupMetadata?.sortOrder).toBe(10)
    expect(enriched.seasonMetadata?.displayName).toBe('SOL/USDC 2026 1D Season')
    expect(enriched.seasonMetadata?.description).toBe('Rich product metadata description.')
  })

  it('enriches a market list from the all-context endpoint', async () => {
    mockApiFetch.mockResolvedValueOnce({ markets: [providerContext()] })

    const [enriched] = await enrichMarketsWithProviderSeasonMetadata([market()])

    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/provider-markets/contexts')
    expect(enriched.seasonMetadata?.description).toBe('Provider-indexed daily SOL markets.')
  })

  it('keeps markets unchanged when the pipeline API base is unset', async () => {
    mockEnv.APP_API_BASE_URL = ''
    const markets = [market()]

    await expect(enrichMarketsWithProviderSeasonMetadata(markets)).resolves.toBe(markets)
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('keeps markets unchanged when the all-context endpoint is not deployed yet', async () => {
    const markets = [market()]
    mockApiFetch.mockRejectedValueOnce(new Error('API request failed: 404 Not Found'))

    await expect(enrichMarketsWithProviderSeasonMetadata(markets)).resolves.toBe(markets)
  })

  it('keeps single markets unchanged when no provider context exists', async () => {
    const source = market()
    mockApiFetch.mockRejectedValueOnce(new Error('API request failed: 404 Not Found'))

    await expect(enrichMarketWithProviderSeasonMetadata(source)).resolves.toBe(source)
  })
})
