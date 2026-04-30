import { describe, it, expect, vi } from 'vitest'
import { BN } from '@coral-xyz/anchor'

import {
  EVENT_INVALIDATION_MAP,
  dispatchEventInvalidation,
  marketKey,
} from '@/lib/api/eventInvalidation'

describe('marketKey', () => {
  it('handles BN, number, and string inputs uniformly', () => {
    expect(marketKey(7)).toBe('7')
    expect(marketKey('7')).toBe('7')
    expect(marketKey(new BN(7))).toBe('7')
  })

  it('returns empty string for unrecognized inputs', () => {
    expect(marketKey(undefined)).toBe('')
    expect(marketKey(null)).toBe('')
    expect(marketKey({})).toBe('')
  })
})

describe('EVENT_INVALIDATION_MAP', () => {
  it('covers every user-affecting event in the IDL surface', () => {
    const expected = [
      'MarketCreated',
      'MarketActivated',
      'MarketSettled',
      'MarketFinalized',
      'MarketVoided',
      'DisputedMarketFinalized',
      'WagerPlaced',
      'PositionExited',
      'ClaimPaid',
      'PathAdded',
      'PathScored',
      'PathDissolved',
      'CheckpointSampled',
      'DisputeRaised',
      'DisputeResolved',
    ]
    for (const name of expected) {
      expect(EVENT_INVALIDATION_MAP[name]).toBeDefined()
    }
  })

  it('user-driven events invalidate market, userPosition[market], userPositions, and markets', () => {
    const keys = EVENT_INVALIDATION_MAP.WagerPlaced({ marketId: new BN(7) })
    const flat = keys.map((k) => JSON.stringify(k))
    expect(flat).toContain(JSON.stringify(['market', '7']))
    expect(flat).toContain(JSON.stringify(['userPosition', '7']))
    expect(flat).toContain(JSON.stringify(['userPositions']))
    expect(flat).toContain(JSON.stringify(['markets']))
  })

  it('CheckpointSampled invalidates only the specific market (high-frequency event)', () => {
    const keys = EVENT_INVALIDATION_MAP.CheckpointSampled({ marketId: new BN(3) })
    expect(keys).toHaveLength(1)
    expect(keys[0]).toEqual(['market', '3'])
  })

  it('terminal-state transitions invalidate userPositions so PortfolioPage refreshes', () => {
    for (const ev of ['MarketSettled', 'MarketVoided', 'MarketFinalized', 'DisputedMarketFinalized']) {
      const keys = EVENT_INVALIDATION_MAP[ev]({ marketId: new BN(1) })
      const flat = keys.map((k) => JSON.stringify(k))
      expect(flat, `${ev} should invalidate ['userPositions']`).toContain(
        JSON.stringify(['userPositions']),
      )
    }
  })
})

describe('dispatchEventInvalidation', () => {
  function makeQueryClient() {
    return { invalidateQueries: vi.fn() }
  }

  it('calls invalidateQueries once per key produced by the factory', () => {
    const qc = makeQueryClient()
    dispatchEventInvalidation(qc as never, {
      name: 'WagerPlaced',
      data: { marketId: 7 },
    })
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(4)
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['market', '7'] })
  })

  it('is a no-op for unrecognized event names', () => {
    const qc = makeQueryClient()
    dispatchEventInvalidation(qc as never, {
      name: 'TotallyMadeUpEvent',
      data: { marketId: 7 },
    })
    expect(qc.invalidateQueries).not.toHaveBeenCalled()
  })

  it('tolerates events with empty / missing data without throwing', () => {
    const qc = makeQueryClient()
    expect(() =>
      dispatchEventInvalidation(qc as never, { name: 'MarketCreated', data: undefined }),
    ).not.toThrow()
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['markets'] })
  })
})
