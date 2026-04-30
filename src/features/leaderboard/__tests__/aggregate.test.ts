import { describe, it, expect } from 'vitest'

import { aggregatePositions } from '@/features/leaderboard/aggregate'

const W1 = '8ZFozhni5F3RkPXMRCvQevVcHYRXYr7VwYmwRDjrfZG3'
const W2 = '11111111111111111111111111111111'

function pos(opts: {
  user: string
  marketId: string
  collateral: number
  finalPayout?: number
  claimed?: boolean
  dissolved?: boolean
}) {
  return {
    user: opts.user,
    marketId: opts.marketId,
    collateral: opts.collateral,
    finalPayout: opts.finalPayout ?? 0,
    claimed: opts.claimed ?? false,
    dissolved: opts.dissolved ?? false,
  }
}

describe('aggregatePositions', () => {
  it('returns an empty list when no positions exist', () => {
    expect(aggregatePositions([])).toEqual([])
  })

  it('groups by user and counts distinct markets touched', () => {
    const out = aggregatePositions([
      pos({ user: W1, marketId: 'm1', collateral: 25 }),
      pos({ user: W1, marketId: 'm2', collateral: 50 }),
      pos({ user: W2, marketId: 'm1', collateral: 100 }),
    ])
    expect(out).toHaveLength(2)
    const w1 = out.find((e) => e.user.startsWith(W1.slice(0, 4)))!
    expect(w1.markets).toBe(2)
  })

  it('computes accuracy as settled-wins / settled-count, ignoring unclaimed positions', () => {
    const out = aggregatePositions([
      pos({ user: W1, marketId: 'm1', collateral: 10, finalPayout: 30, claimed: true }),
      pos({ user: W1, marketId: 'm2', collateral: 10, finalPayout: 25, claimed: true }),
      pos({ user: W1, marketId: 'm3', collateral: 10, finalPayout: 5, claimed: true }),
      pos({ user: W1, marketId: 'm4', collateral: 10 }), // unclaimed; ignored
    ])
    expect(out).toHaveLength(1)
    expect(out[0].accuracy).toBeCloseTo((2 / 3) * 100, 1)
  })

  it('returns 0 accuracy when a wallet has no settled positions yet', () => {
    const out = aggregatePositions([pos({ user: W1, marketId: 'm1', collateral: 10 })])
    expect(out[0].accuracy).toBe(0)
  })

  it('sorts by realized P&L descending and assigns ranks', () => {
    const out = aggregatePositions([
      pos({ user: W1, marketId: 'm1', collateral: 10, finalPayout: 40, claimed: true }),
      pos({ user: W2, marketId: 'm1', collateral: 100, finalPayout: 50, claimed: true }),
    ])
    expect(out[0].rank).toBe(1)
    expect(out[0].score).toBe(30)
    expect(out[1].rank).toBe(2)
    expect(out[1].score).toBe(-50)
  })

  it('truncates pubkeys to a stable display form', () => {
    const out = aggregatePositions([pos({ user: W1, marketId: 'm1', collateral: 1 })])
    expect(out[0].user).toMatch(/^[A-Za-z0-9]{4}…[A-Za-z0-9]{4}$/)
  })

  it('stably maps a pubkey to the same avatar slot across runs', () => {
    const a = aggregatePositions([pos({ user: W1, marketId: 'm1', collateral: 1 })])
    const b = aggregatePositions([pos({ user: W1, marketId: 'm2', collateral: 1 })])
    expect(a[0].avatarIdx).toBe(b[0].avatarIdx)
    expect(a[0].avatarIdx).toBeGreaterThanOrEqual(0)
    expect(a[0].avatarIdx).toBeLessThan(9)
  })
})
