import { describe, it, expect } from 'vitest'
import { BN } from '@coral-xyz/anchor'

import { computeEstimatedPayout } from '@/lib/api/onchain'
import { SCALE } from '@/lib/constants'

function rawPosition(overrides: Partial<{
  collateral: BN
  lmsrShares: BN
  finalPayout: BN
  claimed: boolean
}> = {}) {
  return {
    collateral: overrides.collateral ?? new BN(25 * SCALE),
    lmsrShares: overrides.lmsrShares ?? new BN(45 * SCALE),
    finalPayout: overrides.finalPayout ?? new BN(0),
    claimed: overrides.claimed ?? false,
  }
}

const baseMarket = {
  marketShareQuantitiesScaled: [0, 0, 0, 0],
  marketLmsrAlphaScaled: 100,
  marketAmplitudesScaled: [1, 1, 1, 1],
  marketNumPaths: 4,
}

describe('computeEstimatedPayout', () => {
  it('returns realized final_payout when the position is claimed', () => {
    const result = computeEstimatedPayout({
      positionRaw: rawPosition({
        claimed: true,
        finalPayout: new BN(72 * SCALE),
      }),
      pathDissolved: false,
      pathIndex: 1,
      marketState: 'settled',
      ...baseMarket,
    })
    expect(result).toBe(72)
  })

  it('returns 0 for dissolved paths regardless of position state', () => {
    const result = computeEstimatedPayout({
      positionRaw: rawPosition(),
      pathDissolved: true,
      pathIndex: 0,
      marketState: 'sampling',
      ...baseMarket,
    })
    expect(result).toBe(0)
  })

  it('returns full collateral as the refund estimate for void markets pre-claim', () => {
    const result = computeEstimatedPayout({
      positionRaw: rawPosition({ collateral: new BN(15 * SCALE) }),
      pathDissolved: false,
      pathIndex: 2,
      marketState: 'void',
      ...baseMarket,
    })
    expect(result).toBe(15)
  })

  it('falls through to the LMSR mark-to-market estimate for active positions', () => {
    // Balanced 4-path market, q=0 across the board → marginal price for
    // path 0 is 1/4 = 0.25/share. Selling 45 shares pulls the price
    // down as it executes (LMSR convexity), so the realized payout sits
    // somewhere below the linear 45 × 0.25 = 11.25 estimate. Bound the
    // estimator without pinning a magic number — the contract is
    // "non-zero, finite, less than the linear marginal-price estimate."
    const result = computeEstimatedPayout({
      positionRaw: rawPosition({ lmsrShares: new BN(45 * SCALE) }),
      pathDissolved: false,
      pathIndex: 0,
      marketState: 'active',
      ...baseMarket,
    })
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(11.25)
  })

  it('returns 0 when LMSR shares are zero (e.g. fully exited but not yet swept)', () => {
    const result = computeEstimatedPayout({
      positionRaw: rawPosition({ lmsrShares: new BN(0) }),
      pathDissolved: false,
      pathIndex: 0,
      marketState: 'active',
      ...baseMarket,
    })
    expect(result).toBe(0)
  })
})
