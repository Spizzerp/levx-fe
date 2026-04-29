import { describe, it, expect } from 'vitest'

import {
  applySlippageFloor,
  estimateLmsrExitPayout,
  estimateLmsrSharesOut,
} from '../lmsr'

describe('estimateLmsrSharesOut', () => {
  it('returns ~amount/marginalPrice for small wagers in a balanced market', () => {
    // 4 paths, all q=0 → uniform p=0.25. Buying $1 should net ~$1/0.25 = 4 shares
    // (approximately — small deviation from convexity).
    const shares = estimateLmsrSharesOut({
      shareQuantities: [0, 0, 0, 0],
      numPaths: 4,
      lmsrAlpha: 100,
      pathIndex: 0,
      amountScaled: 1,
    })
    expect(shares).toBeGreaterThan(3.9)
    expect(shares).toBeLessThan(4.1)
  })

  it('penalizes path that already has heavy long quantity (worse fill)', () => {
    // q=[10, 0, 0, 0] → p_0 ≈ 0.31, so 10 USDC into path 0 yields ~32 shares
    // (less than the 40 you'd get if path 0 had q=0 like the others).
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

describe('applySlippageFloor', () => {
  it('returns floor(expected * (1 - tolerance))', () => {
    expect(applySlippageFloor(100, 0.005)).toBe(99)
    expect(applySlippageFloor(100, 0.01)).toBe(99)
    expect(applySlippageFloor(100, 0)).toBe(100)
  })

  it('clamps tolerance to [0, 0.99] and floors at 0', () => {
    expect(applySlippageFloor(100, -1)).toBe(100)
    expect(applySlippageFloor(100, 5)).toBe(1)
    expect(applySlippageFloor(0, 0.5)).toBe(0)
    expect(applySlippageFloor(-5, 0.5)).toBe(0)
  })
})
