import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'

import { activeMaskFromPricingMask, evaluateEigenCachePolicy } from '../eigenCache'

const marketPda = PublicKey.unique()
const cachePda = PublicKey.unique()

function market(overrides: Partial<{ lambda: BN; eigendecompVersion: BN; numPaths: number }> = {}) {
  return {
    lambda: overrides.lambda ?? new BN(1_000_000),
    eigendecompVersion: overrides.eigendecompVersion ?? new BN(7),
    numPaths: overrides.numPaths ?? 3,
  }
}

function cache(
  overrides: Partial<{
    market: PublicKey
    version: BN
    numPaths: number
    cachedPrices: BN[]
    lipschitzConstant: BN
    checkpointQuantities: BN[]
  }> = {},
) {
  return {
    market: overrides.market ?? marketPda,
    version: overrides.version ?? new BN(7),
    numPaths: overrides.numPaths ?? 3,
    cachedPrices: overrides.cachedPrices ?? [new BN(200_000), new BN(500_000), new BN(300_000)],
    lipschitzConstant: overrides.lipschitzConstant ?? new BN(100_000_000),
    checkpointQuantities: overrides.checkpointQuantities ?? [new BN(0), new BN(0), new BN(0)],
  }
}

describe('EigenCache quote policy', () => {
  it('marks a matching cache fresh and exposes a quote snapshot', () => {
    const policy = evaluateEigenCachePolicy({
      enabled: true,
      marketPda,
      marketAcc: market(),
      cachePda,
      cacheAcc: cache(),
    })

    expect(policy.status).toBe('fresh')
    expect(policy.snapshot?.cachedPrices).toEqual([0.2, 0.5, 0.3])
    expect(policy.snapshot?.lipschitz).toBe(100)
  })

  it('falls back when disabled, lambda is zero, missing, stale, or RPC errors', () => {
    expect(
      evaluateEigenCachePolicy({
        enabled: false,
        marketPda,
        marketAcc: market(),
        cachePda,
        cacheAcc: cache(),
      }).status,
    ).toBe('disabled')

    expect(
      evaluateEigenCachePolicy({
        enabled: true,
        marketPda,
        marketAcc: market({ lambda: new BN(0) }),
        cachePda,
        cacheAcc: cache(),
      }).status,
    ).toBe('lambda_zero')

    expect(
      evaluateEigenCachePolicy({
        enabled: true,
        marketPda,
        marketAcc: market(),
        cachePda,
        cacheAcc: null,
      }).status,
    ).toBe('missing')

    expect(
      evaluateEigenCachePolicy({
        enabled: true,
        marketPda,
        marketAcc: market(),
        cachePda,
        cacheAcc: cache({ version: new BN(6) }),
      }).status,
    ).toBe('stale')

    expect(
      evaluateEigenCachePolicy({
        enabled: true,
        marketPda,
        marketAcc: market(),
        cachePda,
        cacheAcc: null,
        readError: new Error('rpc unavailable'),
      }).status,
    ).toBe('rpc_error')
  })

  it('rejects wrong-market caches but accepts padded value vectors', () => {
    expect(
      evaluateEigenCachePolicy({
        enabled: true,
        marketPda,
        marketAcc: market(),
        cachePda,
        cacheAcc: cache({ market: PublicKey.unique() }),
      }).status,
    ).toBe('unusable')

    const policy = evaluateEigenCachePolicy({
      enabled: true,
      marketPda,
      marketAcc: market(),
      cachePda,
      cacheAcc: cache({
        cachedPrices: [new BN(200_000), new BN(500_000), new BN(300_000), new BN(1)],
        checkpointQuantities: [new BN(0), new BN(0), new BN(0), new BN(99)],
      }),
    })

    expect(policy.status).toBe('fresh')
    expect(policy.snapshot?.cachedPrices).toEqual([0.2, 0.5, 0.3])
  })

  it('decodes pricingActiveMask by bit index', () => {
    expect(activeMaskFromPricingMask(new BN(0b1011), 4)).toEqual([true, true, false, true])
  })
})
