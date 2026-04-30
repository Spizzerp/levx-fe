import { describe, it, expect } from 'vitest'
import { BN } from '@coral-xyz/anchor'

import { anchorPositionToFE } from '@/lib/api/adapters'
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
    })
    expect(live.entryMultiplier).toBeCloseTo(1.8, 3)

    const empty = anchorPositionToFE(
      rawPosition({ costBasis: new BN(0), lmsrShares: new BN(0) }),
      {
        marketIdNum: 0,
        marketState: 'active',
        pair: 'SOL/USDC',
        base: 'SOL',
        quote: 'USDC',
        pathLabel: 'Path A',
        pathTone: 'bull',
        pathDissolved: false,
      },
    )
    expect(empty.entryMultiplier).toBe(0)
  })
})
