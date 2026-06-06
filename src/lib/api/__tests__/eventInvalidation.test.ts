import { describe, it, expect, vi } from 'vitest'
import { BN, BorshEventCoder } from '@coral-xyz/anchor'

import {
  EVENT_INVALIDATION_MAP,
  dispatchEventInvalidation,
  marketKey,
  readField,
} from '@/lib/api/eventInvalidation'
import idlJson from '@/idl/levx.json'

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

describe('readField', () => {
  it('prefers the IDL snake_case key (the BorshEventCoder native form)', () => {
    expect(readField({ market_id: 7, marketId: 99 }, 'market_id')).toBe(7)
  })

  it('falls back to camelCase if a payload only has the camelCase key', () => {
    expect(readField({ marketId: 11 }, 'market_id')).toBe(11)
  })

  it('returns undefined when neither shape is present', () => {
    expect(readField({}, 'market_id')).toBeUndefined()
  })
})

describe('EVENT_INVALIDATION_MAP — payload shape from BorshEventCoder', () => {
  // Anchor's `BorshEventCoder.decode` returns IDL field names verbatim
  // (snake_case). Construct a real WagerPlaced payload and decode it to
  // pin the contract — if Anchor flips this convention in the future,
  // this test fails before users see broken cache invalidation.
  it('decodes WagerPlaced with snake_case keys and the map handles them correctly', () => {
    const evDef = idlJson.events!.find((e: { name: string }) => e.name === 'WagerPlaced')!
    const buf = Buffer.alloc(8 + 8 + 32 + 1 + 8 + 8)
    let o = 0
    Buffer.from(evDef.discriminator).copy(buf, o)
    o += 8
    buf.writeBigUInt64LE(7n, o)
    o += 8
    Buffer.alloc(32).copy(buf, o)
    o += 32
    buf.writeUInt8(2, o)
    o += 1
    buf.writeBigUInt64LE(25_000_000n, o)
    o += 8
    buf.writeBigUInt64LE(45_000_000n, o)

    const coder = new BorshEventCoder(idlJson as never)
    const decoded = coder.decode(buf.toString('base64'))!
    expect(decoded.name).toBe('WagerPlaced')
    expect(Object.keys(decoded.data as object)).toContain('market_id')

    const keys = EVENT_INVALIDATION_MAP.WagerPlaced(decoded.data as Record<string, unknown>)
    const flat = keys.map((k) => JSON.stringify(k))
    expect(flat).toContain(JSON.stringify(['market', '7']))
    expect(flat).toContain(JSON.stringify(['userPosition', '7']))
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
      'MarketGroupCreated',
      'MarketGroupStatusUpdated',
      'MarketGroupClosed',
      'MarketLinkedToGroup',
      'MarketUnlinkedFromGroup',
    ]
    for (const name of expected) {
      expect(EVENT_INVALIDATION_MAP[name]).toBeDefined()
    }
  })

  it('user-driven events invalidate market, userPosition[market], userPositions, and markets', () => {
    const keys = EVENT_INVALIDATION_MAP.WagerPlaced({ market_id: new BN(7) })
    const flat = keys.map((k) => JSON.stringify(k))
    expect(flat).toContain(JSON.stringify(['market', '7']))
    expect(flat).toContain(JSON.stringify(['userPosition', '7']))
    expect(flat).toContain(JSON.stringify(['userPositions']))
    expect(flat).toContain(JSON.stringify(['markets']))
  })

  it('accepts both snake_case and camelCase market id fields', () => {
    const snake = EVENT_INVALIDATION_MAP.WagerPlaced({ market_id: 5 })
    const camel = EVENT_INVALIDATION_MAP.WagerPlaced({ marketId: 5 })
    expect(snake).toEqual(camel)
  })

  it('CheckpointSampled invalidates only the specific market (high-frequency event)', () => {
    const keys = EVENT_INVALIDATION_MAP.CheckpointSampled({ market_id: new BN(3) })
    expect(keys).toHaveLength(1)
    expect(keys[0]).toEqual(['market', '3'])
  })

  it('market group link changes invalidate the affected market and market list', () => {
    for (const ev of ['MarketLinkedToGroup', 'MarketUnlinkedFromGroup']) {
      const keys = EVENT_INVALIDATION_MAP[ev]({ market_id: new BN(4) })
      const flat = keys.map((k) => JSON.stringify(k))
      expect(flat, `${ev} should invalidate ['market', '4']`).toContain(
        JSON.stringify(['market', '4']),
      )
      expect(flat, `${ev} should invalidate ['markets']`).toContain(JSON.stringify(['markets']))
    }
  })

  it('market group lifecycle changes invalidate the market list', () => {
    for (const ev of ['MarketGroupCreated', 'MarketGroupStatusUpdated', 'MarketGroupClosed']) {
      expect(EVENT_INVALIDATION_MAP[ev]({})).toEqual([['markets']])
    }
  })

  it('terminal-state transitions invalidate userPositions so PortfolioPage refreshes', () => {
    for (const ev of [
      'MarketSettled',
      'MarketVoided',
      'MarketFinalized',
      'DisputedMarketFinalized',
    ]) {
      const keys = EVENT_INVALIDATION_MAP[ev]({ market_id: new BN(1) })
      const flat = keys.map((k) => JSON.stringify(k))
      expect(flat, `${ev} should invalidate ['userPositions']`).toContain(
        JSON.stringify(['userPositions']),
      )
    }
  })

  it('events without a resolvable market_id fall back to a markets-only invalidation (never ["market",""])', () => {
    const keys = EVENT_INVALIDATION_MAP.WagerPlaced({})
    const flat = keys.map((k) => JSON.stringify(k))
    expect(flat).not.toContain(JSON.stringify(['market', '']))
    expect(flat).not.toContain(JSON.stringify(['userPosition', '']))
    expect(flat).toEqual([JSON.stringify(['markets'])])
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
      data: { market_id: 7 },
    })
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(4)
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['market', '7'] })
  })

  it('is a no-op for unrecognized event names', () => {
    const qc = makeQueryClient()
    dispatchEventInvalidation(qc as never, {
      name: 'TotallyMadeUpEvent',
      data: { market_id: 7 },
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
