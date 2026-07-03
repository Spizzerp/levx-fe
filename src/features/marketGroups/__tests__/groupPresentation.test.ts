import { describe, expect, it } from 'vitest'

import {
  buildMarketGroupSummaries,
  formatMarketGroupLabel,
  getMarketsForGroup,
} from '@/features/marketGroups/groupPresentation'
import { MARKET_GROUP_CONSTRAINT_FLAGS } from '@/lib/marketGroups'
import type { Market } from '@/types/market'

function market(overrides: Partial<Market>): Market {
  return {
    id: overrides.id ?? '1',
    marketId: overrides.marketId ?? 1,
    pair: overrides.pair ?? 'BTC/USDC',
    base: overrides.base ?? 'BTC',
    quote: overrides.quote ?? 'USDC',
    vault: '',
    state: overrides.state ?? 'active',
    pool: overrides.pool ?? 100,
    traders: overrides.traders ?? 10,
    startTime: overrides.startTime ?? Date.UTC(2026, 0, 1),
    endTime: overrides.endTime ?? Date.UTC(2026, 0, 2),
    checkpointInterval: 3600,
    completedCheckpoints: 0,
    totalCheckpoints: 24,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 150,
    history: [],
    paths: [],
    numPaths: 0,
    targetNumPaths: 3,
    amplitudes: [],
    lmsrShareQuantities: [],
    pricingActiveMask: 0,
    lmsrAlpha: 100_000,
    lambda: 0,
    decoherenceRate: 500_000,
    minimumProbability: 10_000,
    nudgeRate: 50_000,
    pathMaxAge: 3600,
    pathsScored: 0,
    pathsDissolved: 0,
    ...overrides,
    baseMint: overrides.baseMint ?? 'BTC-mint',
    quoteMint: overrides.quoteMint ?? 'USDC-mint',
  }
}

describe('market group presentation', () => {
  it('formats readable labels from group kind and hash prefix', () => {
    expect(
      formatMarketGroupLabel({ groupKind: 'assetSeason', groupKeyHash: 'ab'.repeat(32) }),
    ).toBe('Season abababab')
    expect(
      formatMarketGroupLabel({
        groupKind: 'assetSeason',
        groupKeyHash: 'ab'.repeat(32),
        pair: 'SOL/USDC',
        timeframeSeconds: 86_400,
      }),
    ).toBe('SOL/USDC 1D Season')
    expect(formatMarketGroupLabel({ groupKind: 'season', groupKeyHash: 'cd'.repeat(32) })).toBe(
      'Season cdcdcdcd',
    )
    expect(
      formatMarketGroupLabel({
        groupKind: 'league',
        groupKeyHash: 'ef'.repeat(32),
        pair: 'BTC/USDC',
        pairCount: 2,
      }),
    ).toBe('2 pairs League')
    expect(formatMarketGroupLabel({ groupKeyHash: undefined })).toBe('Ungrouped')
  })

  it('builds summaries with lifecycle counts and totals', () => {
    const groupKeyHash = 'ab'.repeat(32)
    const summaries = buildMarketGroupSummaries([
      market({
        id: 'a',
        marketId: 1,
        state: 'active',
        groupKeyHash,
        groupKind: 'season',
        group: {
          address: 'season-group',
          authority: 'group-authority',
          groupKeyHash,
          parentGroup: null,
          kind: 'season',
          status: 'active',
          baseMint: 'base-mint',
          quoteMint: 'quote-mint',
          pythFeedId: '00'.repeat(32),
          constraintFlags: MARKET_GROUP_CONSTRAINT_FLAGS.timeWindow,
          startTime: Date.UTC(2026, 0, 1),
          endTime: Date.UTC(2026, 0, 7),
          allowedTimeframesMask: 0,
          metadataHash: '11'.repeat(32),
          childMarketCount: 3,
        },
      }),
      market({ id: 'b', marketId: 2, state: 'pending', groupKeyHash, groupKind: 'season' }),
      market({ id: 'c', marketId: 3, state: 'settled', groupKeyHash, groupKind: 'season' }),
      market({ id: 'flat', marketId: 4, state: 'active' }),
    ])

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      groupKeyHash,
      label: 'BTC/USDC Season',
      subtitle: 'BTC/USDC · Season · 3 markets',
      shortHash: 'abababab...ababab',
      primaryPair: 'BTC/USDC',
      totalMarkets: 3,
      activeMarkets: 1,
      pendingMarkets: 1,
      settledMarkets: 1,
      endTime: Date.UTC(2026, 0, 7),
    })
  })

  it('treats groups without a time-window constraint as open-ended even when stored endTime is zero', () => {
    const groupKeyHash = 'ef'.repeat(32)
    const summaries = buildMarketGroupSummaries([
      market({
        id: 'open-ended',
        marketId: 5,
        state: 'active',
        groupKeyHash,
        groupKind: 'season',
        group: {
          address: 'open-season-group',
          authority: 'group-authority',
          groupKeyHash,
          parentGroup: null,
          kind: 'season',
          status: 'active',
          baseMint: 'base-mint',
          quoteMint: 'quote-mint',
          pythFeedId: '00'.repeat(32),
          constraintFlags: 0,
          startTime: 0,
          endTime: 0,
          allowedTimeframesMask: 0,
          metadataHash: '22'.repeat(32),
          childMarketCount: 1,
        },
      }),
    ])

    expect(summaries).toHaveLength(1)
    expect(summaries[0]?.endTime).toBeUndefined()
  })

  it('uses later group metadata when the first grouped market lacks a sidecar', () => {
    const groupKeyHash = '12'.repeat(32)
    const summaries = buildMarketGroupSummaries([
      market({
        id: 'missing-sidecar',
        marketId: 6,
        state: 'active',
        groupKeyHash,
        groupKind: 'season',
        group: undefined,
      }),
      market({
        id: 'with-sidecar',
        marketId: 7,
        state: 'pending',
        groupKeyHash,
        groupKind: 'season',
        group: {
          address: 'late-season-group',
          authority: 'group-authority',
          groupKeyHash,
          parentGroup: null,
          kind: 'season',
          status: 'active',
          baseMint: 'base-mint',
          quoteMint: 'quote-mint',
          pythFeedId: '00'.repeat(32),
          constraintFlags: MARKET_GROUP_CONSTRAINT_FLAGS.timeWindow,
          startTime: Date.UTC(2026, 0, 1),
          endTime: Date.UTC(2026, 0, 9),
          allowedTimeframesMask: 0,
          metadataHash: '33'.repeat(32),
          childMarketCount: 2,
        },
      }),
    ])

    expect(summaries).toHaveLength(1)
    expect(summaries[0]?.endTime).toBe(Date.UTC(2026, 0, 9))
  })

  it('labels multi-pair groups by pair count instead of the first child pair', () => {
    const groupKeyHash = '45'.repeat(32)
    const summaries = buildMarketGroupSummaries([
      market({ id: 'btc', pair: 'BTC/USDC', groupKeyHash, groupKind: 'league' }),
      market({ id: 'eth', pair: 'ETH/USDC', groupKeyHash, groupKind: 'league' }),
    ])

    expect(summaries[0]).toMatchObject({
      label: '2 pairs League',
      subtitle: '2 pairs · League · 2 markets',
      pairs: ['BTC/USDC', 'ETH/USDC'],
    })
  })

  it('returns only child markets for a selected group hash', () => {
    const target = 'ab'.repeat(32)
    const other = 'cd'.repeat(32)
    expect(
      getMarketsForGroup(
        [
          market({ id: 'target', groupKeyHash: target }),
          market({ id: 'other', groupKeyHash: other }),
          market({ id: 'flat' }),
        ],
        target,
      ).map((m) => m.id),
    ).toEqual(['target'])
  })
})
