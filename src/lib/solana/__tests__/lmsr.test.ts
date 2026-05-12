import { describe, it, expect } from 'vitest'

import {
  applySlippageTolerance,
  estimateLmsrExitPayout,
  estimateLmsrSharesOut,
  estimateQuadraticExitPayout,
  estimateQuadraticSharesOut,
} from '../lmsr'

describe('estimateLmsrSharesOut', () => {
  it('matches the program quote for a fresh alpha-floor market', () => {
    // Regression for SlippageExceeded on normal first wagers: the program uses
    // adaptive LS-LMSR liquidity (b = alpha * sum(abs(q)), floored at 0.01),
    // not b = alpha. Rust levx-math returns 533426 fixed-point shares here.
    const shares = estimateLmsrSharesOut({
      shareQuantities: [0, 0, 0, 0, 0],
      numPaths: 5,
      lmsrAlpha: 1,
      pathIndex: 0,
      amountScaled: 1,
    })
    expect(shares).toBeCloseTo(0.533426, 5)
  })

  it('penalizes path that already has heavy long quantity (worse fill)', () => {
    const heavyShares = estimateLmsrSharesOut({
      shareQuantities: [10, 0, 0, 0],
      numPaths: 4,
      lmsrAlpha: 100,
      pathIndex: 0,
      amountScaled: 10,
    })
    const balancedShares = estimateLmsrSharesOut({
      shareQuantities: [0, 0, 0, 0],
      numPaths: 4,
      lmsrAlpha: 100,
      pathIndex: 0,
      amountScaled: 10,
    })
    expect(heavyShares).toBeLessThan(balancedShares)
  })

  it('returns 0 for inactive (dissolved) target path', () => {
    const shares = estimateLmsrSharesOut({
      shareQuantities: [0, 0, 0, 0],
      numPaths: 4,
      lmsrAlpha: 100,
      pathIndex: 1,
      amountScaled: 5,
      activeMask: [true, false, true, true],
    })
    expect(shares).toBe(0)
  })

  it('returns 0 for degenerate inputs', () => {
    expect(
      estimateLmsrSharesOut({
        shareQuantities: [0, 0],
        numPaths: 2,
        lmsrAlpha: 0,
        pathIndex: 0,
        amountScaled: 1,
      }),
    ).toBe(0)
    expect(
      estimateLmsrSharesOut({
        shareQuantities: [0, 0],
        numPaths: 2,
        lmsrAlpha: 100,
        pathIndex: 0,
        amountScaled: 0,
      }),
    ).toBe(0)
  })

  it('is numerically stable for large quantity magnitudes', () => {
    // q values that would overflow exp() without log-sum-exp shifting.
    const shares = estimateLmsrSharesOut({
      shareQuantities: [10_000, 9_999, 9_998],
      numPaths: 3,
      lmsrAlpha: 100,
      pathIndex: 0,
      amountScaled: 1,
    })
    expect(Number.isFinite(shares)).toBe(true)
    expect(shares).toBeGreaterThan(0)
  })
})

describe('estimateLmsrExitPayout', () => {
  it('round-trips: buying then selling the same shares returns ~the input amount', () => {
    const q = [0, 0, 0, 0]
    const amount = 5
    const sharesOut = estimateLmsrSharesOut({
      shareQuantities: q,
      numPaths: 4,
      lmsrAlpha: 100,
      pathIndex: 0,
      amountScaled: amount,
    })
    // Re-evaluate exit at the post-buy state.
    const qAfter = [...q]
    qAfter[0] += sharesOut
    const payout = estimateLmsrExitPayout({
      shareQuantities: qAfter,
      numPaths: 4,
      lmsrAlpha: 100,
      pathIndex: 0,
      sharesScaled: sharesOut,
    })
    // Floating-point drift is tiny (well under 0.01 USDC for a $5 trade).
    expect(Math.abs(payout - amount)).toBeLessThan(0.01)
  })

  it('returns 0 if shares to sell is zero or negative', () => {
    expect(
      estimateLmsrExitPayout({
        shareQuantities: [10, 0],
        numPaths: 2,
        lmsrAlpha: 100,
        pathIndex: 0,
        sharesScaled: 0,
      }),
    ).toBe(0)
  })
})

describe('EigenCache quadratic estimators', () => {
  it('matches the on-chain quadratic buy formula in fixed-point units', () => {
    const shares = estimateQuadraticSharesOut({
      shareQuantities: [0, 0, 0],
      checkpointQuantities: [0, 0, 0],
      cachedPrices: [0.2, 0.5, 0.3],
      lipschitz: 100,
      pathIndex: 0,
      amountScaled: 1,
    })

    expect(shares).toBeCloseTo(0.139435, 6)
  })

  it('clamps quadratic sell value at zero when curvature dominates', () => {
    const payout = estimateQuadraticExitPayout({
      shareQuantities: [10, 0, 0],
      checkpointQuantities: [0, 0, 0],
      cachedPrices: [0.1, 0.45, 0.45],
      lipschitz: 100,
      pathIndex: 0,
      sharesScaled: 10,
    })

    expect(payout).toBe(0)
  })
})

describe('applySlippageTolerance', () => {
  it('applies tolerance without dropping fixed-point precision', () => {
    expect(applySlippageTolerance(100, 0.005)).toBe(99.5)
    expect(applySlippageTolerance(100, 0.01)).toBe(99)
    expect(applySlippageTolerance(100, 0)).toBe(100)
    expect(applySlippageTolerance(0.533426, 0.005)).toBeCloseTo(0.53075887)
  })

  it('clamps tolerance to [0, 0.99] and floors at 0', () => {
    expect(applySlippageTolerance(100, -1)).toBe(100)
    expect(applySlippageTolerance(100, 5)).toBeCloseTo(1)
    expect(applySlippageTolerance(0, 0.5)).toBe(0)
    expect(applySlippageTolerance(-5, 0.5)).toBe(0)
  })
})
