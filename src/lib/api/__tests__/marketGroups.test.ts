import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { describe, expect, it, vi } from 'vitest'

import { attachMarketGroups } from '@/lib/api/onchain'
import { bytes32HexToArray, isBytes32Hex } from '@/lib/marketGroups'
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
})
