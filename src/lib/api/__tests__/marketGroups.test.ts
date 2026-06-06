// @vitest-environment node

import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { describe, expect, it, vi } from 'vitest'

import { attachMarketGroup, attachMarketGroups } from '@/lib/api/onchain'
import {
  MARKET_GROUP_CONSTRAINT_FLAGS,
  MARKET_GROUP_TIMEFRAME_BITS,
  buildMarketGroupConstraintParams,
  bytes32HexToArray,
  isBytes32Hex,
} from '@/lib/marketGroups'
import type { Market } from '@/types/market'

vi.mock('@/env/env.config', () => ({
  env: {
    APP_PROGRAM_ID: 'LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV',
    APP_RPC_URL: 'http://localhost:8899',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_NETWORK: 'devnet',
    APP_SUPABASE_URL: 'http://localhost:54321',
    APP_SUPABASE_ANON_KEY: 'anon',
    APP_ADMIN_WALLETS: [],
    APP_PATH_UPLOAD_RELAY_FEE_LAMPORTS: 50_000,
    APP_EIGENCACHE_QUOTES_ENABLED: false,
  },
}))

const KEY = new PublicKey('11111111111111111111111111111111')

describe('market group helpers', () => {
  it('validates and decodes 32-byte hex values', () => {
    expect(isBytes32Hex(`0x${'ab'.repeat(32)}`)).toBe(true)
    expect(isBytes32Hex('ab')).toBe(false)
    expect(bytes32HexToArray('ab'.repeat(32))).toHaveLength(32)
  })

  it('builds unconstrained group params with default sidecar values', () => {
    const params = buildMarketGroupConstraintParams({
      pairEnabled: false,
      feedEnabled: false,
      timeWindowEnabled: false,
      timeframeMaskEnabled: false,
      baseMint: '',
      quoteMint: '',
      pythFeedId: '',
      startTime: '',
      endTime: '',
      timeframeSeconds: [],
    })

    expect(params.constraintFlags).toBe(0)
    expect(params.baseMint.toBase58()).toBe(KEY.toBase58())
    expect(params.quoteMint.toBase58()).toBe(KEY.toBase58())
    expect(params.pythFeedId).toEqual(Array(32).fill(0))
    expect(params.startTime.toNumber()).toBe(0)
    expect(params.endTime.toNumber()).toBe(0)
    expect(params.allowedTimeframesMask).toBe(0)
  })

  it('builds constrained group params from admin form values', () => {
    const baseMint = 'So11111111111111111111111111111111111111112'
    const quoteMint = 'BPFLoader1111111111111111111111111111111111'
    const pythFeedId = 'ab'.repeat(32)
    const params = buildMarketGroupConstraintParams({
      pairEnabled: true,
      feedEnabled: true,
      timeWindowEnabled: true,
      timeframeMaskEnabled: true,
      baseMint,
      quoteMint,
      pythFeedId,
      startTime: '2026-06-01T00:00',
      endTime: '2026-06-02T00:00',
      timeframeSeconds: [3_600, 86_400],
    })

    expect(params.constraintFlags).toBe(
      MARKET_GROUP_CONSTRAINT_FLAGS.pair |
        MARKET_GROUP_CONSTRAINT_FLAGS.feed |
        MARKET_GROUP_CONSTRAINT_FLAGS.timeWindow |
        MARKET_GROUP_CONSTRAINT_FLAGS.timeframeMask,
    )
    expect(params.baseMint.toBase58()).toBe(baseMint)
    expect(params.quoteMint.toBase58()).toBe(quoteMint)
    expect(params.pythFeedId).toEqual(bytes32HexToArray(pythFeedId))
    expect(params.startTime.toNumber()).toBe(Date.parse('2026-06-01T00:00') / 1000)
    expect(params.endTime.toNumber()).toBe(Date.parse('2026-06-02T00:00') / 1000)
    expect(params.allowedTimeframesMask).toBe(
      MARKET_GROUP_TIMEFRAME_BITS[3_600] | MARKET_GROUP_TIMEFRAME_BITS[86_400],
    )
  })

  it('rejects incomplete constrained group form values before transaction build', () => {
    expect(() =>
      buildMarketGroupConstraintParams({
        pairEnabled: true,
        feedEnabled: false,
        timeWindowEnabled: false,
        timeframeMaskEnabled: false,
        baseMint: '',
        quoteMint: '',
        pythFeedId: '',
        startTime: '',
        endTime: '',
        timeframeSeconds: [],
      }),
    ).toThrow('Base and quote mints are required')

    expect(() =>
      buildMarketGroupConstraintParams({
        pairEnabled: false,
        feedEnabled: false,
        timeWindowEnabled: true,
        timeframeMaskEnabled: false,
        baseMint: '',
        quoteMint: '',
        pythFeedId: '',
        startTime: '2026-06-02T00:00',
        endTime: '2026-06-01T00:00',
        timeframeSeconds: [],
      }),
    ).toThrow('End time must be after start time')

    expect(() =>
      buildMarketGroupConstraintParams({
        pairEnabled: false,
        feedEnabled: false,
        timeWindowEnabled: false,
        timeframeMaskEnabled: true,
        baseMint: '',
        quoteMint: '',
        pythFeedId: '',
        startTime: '',
        endTime: '',
        timeframeSeconds: [],
      }),
    ).toThrow('Select at least one timeframe')
  })

  it('keeps flat markets unchanged when group sidecars are unavailable', async () => {
    const markets = [{ id: '7', marketId: 7 } as Market]
    await expect(attachMarketGroups({ account: {} }, markets)).resolves.toBe(markets)
  })

  it('joins MarketGroupLink and MarketGroup accounts by market id', async () => {
    const market = { id: '7', marketId: 7 } as Market
    const groupAddress = new PublicKey('So11111111111111111111111111111111111111112')
    const linkAddress = new PublicKey('BPFLoader1111111111111111111111111111111111')
    const program = {
      account: {
        marketGroup: {
          all: vi.fn().mockResolvedValue([
            {
              publicKey: groupAddress,
              account: {
                authority: KEY,
                groupKeyHash: Array(32).fill(0xab),
                parentGroup: KEY,
                hasParent: false,
                kind: { season: {} },
                status: { active: {} },
                baseMint: KEY,
                quoteMint: KEY,
                pythFeedId: Array(32).fill(0),
                constraintFlags: 0,
                startTime: new BN(1),
                endTime: new BN(2),
                allowedTimeframesMask: 0,
                metadataHash: Array(32).fill(0xcd),
                childMarketCount: 1,
              },
            },
          ]),
        },
        marketGroupLink: {
          all: vi.fn().mockResolvedValue([
            {
              publicKey: linkAddress,
              account: {
                group: groupAddress,
                market: KEY,
                marketId: new BN(7),
                timeframeSeconds: 86_400,
                linkedAt: new BN(3),
                groupKind: { season: {} },
              },
            },
          ]),
        },
      },
    }

    const [joined] = await attachMarketGroups(program, [market])

    expect(joined.groupKeyHash).toBe('ab'.repeat(32))
    expect(joined.groupKind).toBe('season')
    expect(joined.group?.childMarketCount).toBe(1)
    expect(joined.groupLink?.timeframeSeconds).toBe(86_400)
    expect(joined.seasonKey).toBe(`season:${'ab'.repeat(32)}:86400`)
  })

  it('fetches a single market group join without scanning all sidecars', async () => {
    const market = { id: '7', marketId: 7 } as Market
    const groupAddress = new PublicKey('So11111111111111111111111111111111111111112')
    const program = {
      account: {
        marketGroup: {
          all: vi.fn(),
          fetchNullable: vi.fn().mockResolvedValue({
            authority: KEY,
            groupKeyHash: Array(32).fill(0xab),
            parentGroup: KEY,
            hasParent: false,
            kind: { season: {} },
            status: { active: {} },
            baseMint: KEY,
            quoteMint: KEY,
            pythFeedId: Array(32).fill(0),
            constraintFlags: 0,
            startTime: new BN(1),
            endTime: new BN(2),
            allowedTimeframesMask: 0,
            metadataHash: Array(32).fill(0xcd),
            childMarketCount: 1,
          }),
        },
        marketGroupLink: {
          all: vi.fn(),
          fetchNullable: vi.fn().mockResolvedValue({
            group: groupAddress,
            market: KEY,
            marketId: new BN(7),
            timeframeSeconds: 86_400,
            linkedAt: new BN(3),
            groupKind: { season: {} },
          }),
        },
      },
    }

    const joined = await attachMarketGroup(program, market)

    expect(program.account.marketGroupLink.all).not.toHaveBeenCalled()
    expect(program.account.marketGroup.all).not.toHaveBeenCalled()
    expect(program.account.marketGroupLink.fetchNullable).toHaveBeenCalledOnce()
    expect(program.account.marketGroup.fetchNullable).toHaveBeenCalledWith(groupAddress)
    expect(joined.groupKeyHash).toBe('ab'.repeat(32))
    expect(joined.groupLink?.timeframeSeconds).toBe(86_400)
  })
})
