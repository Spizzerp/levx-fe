import { describe, it, expect } from 'vitest'
import { BN } from '@coral-xyz/anchor'

import { anchorPathToFE, anchorPositionToFE } from '@/lib/api/adapters'
import { SCALE } from '@/lib/constants'

function rawPosition(overrides: Record<string, unknown> = {}) {
  return {
    pathIndex: 2,
    collateral: new BN(25 * SCALE),
    leverage: 1,
    notionalExposure: new BN(25 * SCALE),
    costBasis: new BN(25 * SCALE),
    lmsrShares: new BN(45 * SCALE),
    finalPayout: new BN(40 * SCALE),
    claimed: false,
    ...overrides,
  }
}

function rawPath(overrides: Record<string, unknown> = {}) {
  return {
    pathIndex: 1,
    predictedPrices: [100 * SCALE, 101 * SCALE].map((v) => new BN(v)),
    numCheckpoints: 2,
    generationTimestamp: new BN(1_700_000_000),
    creator: { toBase58: () => '11111111111111111111111111111111' },
    generationMethod: { ai: {} },
    cumulativeAction: new BN(0),
    compositeScore: new BN(0),
    peakAmplitude: new BN(SCALE),
    amplitudeAtDecoherence: new BN(0),
    dissolved: false,
    dissolvedAtCheckpoint: 0,
    checkpointsProcessed: 0,
    createdAtCheckpoint: 0,
    firstActiveCheckpoint: 0,
    totalWagered: new BN(0),
    totalLeveragedExposure: new BN(0),
    lmsrSharesOutstanding: new BN(0),
    totalTimeWeightedExposure: new BN(0),
    currentImpliedProbability: 2500,
    initialAmplitude: new BN(SCALE),
    ...overrides,
  }
}

describe('anchorPathToFE', () => {
  it('derives the display multiplier from implied probability bps', () => {
    const path = anchorPathToFE(rawPath(), 1_700_000_000_000, 60)

    expect(path.multiplier).toBe(4)
  })
})

describe('anchorPositionToFE', () => {
  it('produces a stable id of `${marketIdNum}-${pathIndex}` for use as a React key', () => {
    const pos = anchorPositionToFE(rawPosition({ pathIndex: 3 }), {
      marketIdNum: 7,
      marketState: 'active',
      pair: 'BTC/USDC',
      base: 'BTC',
      quote: 'USDC',
      pathLabel: 'Path D',
      pathTone: 'bull',
      pathDissolved: false,
      estimatedPayout: 0,
    })
    expect(pos.id).toBe('7-3')
    expect(pos.marketIdNum).toBe(7)
    expect(pos.pathIndex).toBe(3)
  })

  it('threads market context (state, pair) through to the position row', () => {
    const pos = anchorPositionToFE(rawPosition(), {
      marketIdNum: 1,
      marketState: 'settled',
      pair: 'ETH/USDC',
      base: 'ETH',
      quote: 'USDC',
      pathLabel: 'Path C',
      pathTone: 'neutral',
      pathDissolved: false,
      estimatedPayout: 0,
    })
    expect(pos.marketState).toBe('settled')
    expect(pos.pair).toBe('ETH/USDC')
    expect(pos.base).toBe('ETH')
    expect(pos.quote).toBe('USDC')
    expect(pos.pathLabel).toBe('Path C')
  })

  it('computes entryMultiplier as lmsrShares/costBasis (post-SCALE) and floors at 0 when costBasis is 0', () => {
    const live = anchorPositionToFE(rawPosition(), {
      marketIdNum: 0,
      marketState: 'active',
      pair: 'SOL/USDC',
      base: 'SOL',
      quote: 'USDC',
      pathLabel: 'Path A',
      pathTone: 'bull',
      pathDissolved: false,
      estimatedPayout: 0,
    })
    expect(live.entryMultiplier).toBeCloseTo(1.8, 3)

    const empty = anchorPositionToFE(rawPosition({ costBasis: new BN(0), lmsrShares: new BN(0) }), {
      marketIdNum: 0,
      marketState: 'active',
      pair: 'SOL/USDC',
      base: 'SOL',
      quote: 'USDC',
      pathLabel: 'Path A',
      pathTone: 'bull',
      pathDissolved: false,
      estimatedPayout: 0,
    })
    expect(empty.entryMultiplier).toBe(0)
  })

  it('uses ctx.estimatedPayout verbatim — does NOT read raw.finalPayout', () => {
    // raw.finalPayout=0 (the realistic state for a fresh wager). The caller
    // is responsible for computing a sensible estimate per market state.
    const pos = anchorPositionToFE(rawPosition({ finalPayout: new BN(0) }), {
      marketIdNum: 1,
      marketState: 'active',
      pair: 'BTC/USDC',
      base: 'BTC',
      quote: 'USDC',
      pathLabel: 'Path B',
      pathTone: 'bull',
      pathDissolved: false,
      estimatedPayout: 42.5,
    })
    expect(pos.estimatedPayout).toBe(42.5)
  })
})
