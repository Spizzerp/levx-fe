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
    // Model a reachable post-buy state: a 1 USDC fresh-market wager at
    // lmsr_alpha=1 mints 533426 fixed-point shares on path 0, and the
    // market's aggregate q includes those shares before exit.
    const result = computeEstimatedPayout({
      positionRaw: rawPosition({ collateral: new BN(SCALE), lmsrShares: new BN(533_426) }),
      pathDissolved: false,
      pathIndex: 0,
      marketState: 'active',
      ...baseMarket,
      marketShareQuantitiesScaled: [0.533426, 0, 0, 0, 0],
      marketLmsrAlphaScaled: 1,
      marketAmplitudesScaled: [1, 1, 1, 1, 1],
      marketNumPaths: 5,
    })
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(0.99)
    expect(result).toBeLessThanOrEqual(1)
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
