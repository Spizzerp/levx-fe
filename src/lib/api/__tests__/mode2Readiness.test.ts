// @vitest-environment node

import { BN } from '@coral-xyz/anchor'
import { describe, expect, it, vi } from 'vitest'

import { SCALE } from '@/lib/constants'

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

const getReadOnlyProgram = vi.fn()

vi.mock('@/lib/solana/program', () => ({
  getReadOnlyProgram: () => getReadOnlyProgram(),
}))

function rawRiskParams(overrides: Record<string, unknown> = {}) {
  return {
    maxLeverage: 5,
    maxMarketLeveragedOi: new BN(40_000 * SCALE),
    maxPairLeveragedOi: new BN(100_000 * SCALE),
    maxPathLeveragedOi: new BN(10_000 * SCALE),
    maxPathClusterLeveragedOi: new BN(25_000 * SCALE),
    vaultUtilizationCeilingBps: 7500,
    borrowBaseRateBps: 100,
    borrowKinkUtilizationBps: 6000,
    borrowKinkRateBps: 800,
    borrowMaxRateBps: 2000,
    liquidationThreshold: new BN(Math.round(1.15 * SCALE)),
    keeperRewardBps: 50,
    profitWarmupCheckpoints: 4,
    minPairBufferBps: 2500,
    ...overrides,
  }
}

describe('getMode2Readiness', () => {
  it('falls back to inactive readiness when sidecar clients are unavailable', async () => {
    getReadOnlyProgram.mockReturnValueOnce({ account: {} })
    const { getMode2Readiness } = await import('@/lib/api/onchain')

    await expect(getMode2Readiness()).resolves.toEqual({
      leverageEnabled: false,
      leverageConfig: null,
      pairRiskStates: [],
    })
  })

  it('fetches dormant config and pair risk sidecars when available', async () => {
    getReadOnlyProgram.mockReturnValueOnce({
      account: {
        leverageConfig: {
          fetchNullable: vi.fn().mockResolvedValue({
            authority: { toBase58: () => 'authority' },
            status: { accepted: {} },
            currentParams: rawRiskParams(),
            pendingParams: rawRiskParams({ maxLeverage: 3 }),
            simulatorOutputHash: Array(32).fill(1),
            pendingSimulatorOutputHash: Array(32).fill(2),
            activationDelaySeconds: new BN(86_400),
            stagedAt: new BN(1_700_000_000),
            acceptedAt: new BN(1_700_086_400),
          }),
        },
        pairRiskState: {
          all: vi.fn().mockResolvedValue([
            {
              publicKey: { toBase58: () => 'pair-risk-pda' },
              account: {
                authority: { toBase58: () => 'authority' },
                baseMint: { toBase58: () => 'base' },
                quoteMint: { toBase58: () => 'quote' },
                status: { active: {} },
                maxPairLeveragedOi: new BN(100_000 * SCALE),
                maxLeverage: 5,
                bufferTargetBps: 2500,
                bufferDrainThresholdBps: 1500,
                bufferReopenThresholdBps: 3000,
                lastStatusChange: new BN(1_700_000_000),
                configHash: Array(32).fill(3),
              },
            },
          ]),
        },
      },
    })
    const { getMode2Readiness } = await import('@/lib/api/onchain')

    const readiness = await getMode2Readiness()

    expect(readiness.leverageEnabled).toBe(false)
    expect(readiness.leverageConfig?.status).toBe('accepted')
    expect(readiness.leverageConfig?.currentParams.maxPairLeveragedOi).toBe(100_000)
    expect(readiness.pairRiskStates).toHaveLength(1)
    expect(readiness.pairRiskStates[0].status).toBe('active')
  })
})
