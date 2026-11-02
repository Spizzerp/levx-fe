// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { SCALE, payoffAt } from '@spizzerp/levx-mode2-client'
import { pathBreakdown, totalsOf } from '../breakdown'
import type { OrderPart } from '../ladder'
import { makeGroup, todayOffers } from './fixtures'

/** 20 USDC at 2.5×: one 10 USDC unit at 2× and one at 3×. */
const ORDER: OrderPart[] = [
  { offerSlot: 0, leverage: 2, units: 1 },
  { offerSlot: 1, leverage: 3, units: 1 },
]
/** Slot 0 is the favoured path of the k = 5 rank row (entry level 210600), slot 4 the least. */
const FAVOURED = 0
const UNDERDOG = 4

/**
 * Today's offers with a 1000 USDC profit cap, far above the natural cap at every level of the row,
 * so the entry level sets the max win. Today's own caps bind on every path (19.9 and 9.8 USDC).
 */
const uncappedGroup = () =>
  makeGroup({ offers: todayOffers().map((offer) => ({ ...offer, profitCap: 1_000_000_000n })) })

describe('pathBreakdown', () => {
  it('prices 20 USDC at 2.5x on a path at the even level', () => {
    const group = makeGroup({ offers: todayOffers(), entryLevels: [200_000n] })
    expect(pathBreakdown(group, 0, 7, 2.5, ORDER)).toEqual({
      slot: 0,
      pathIndex: 7,
      leverage: 2.5,
      parts: ORDER,
      principal: 20_000_000n,
      valueWithLeverage: 50_000_000n,
      maxWin: 29_700_000n,
      fee: 300_000n,
      maxLoss: 20_000_000n,
    })
  })

  it('holds the max win at the profit caps when they bind', () => {
    const group = makeGroup({ offers: todayOffers() })
    for (const slot of [0, 1, 2, 3, 4]) {
      expect(pathBreakdown(group, slot, slot, 2.5, ORDER).maxWin).toBe(29_700_000n)
    }
  })

  it('gives a favoured path a smaller max win', () => {
    const group = uncappedGroup()
    const favoured = pathBreakdown(group, FAVOURED, FAVOURED, 2.5, ORDER)
    const underdog = pathBreakdown(group, UNDERDOG, UNDERDOG, 2.5, ORDER)
    expect(favoured.maxWin).toBeLessThan(underdog.maxWin)
    expect(favoured.principal).toBe(underdog.principal)
    expect(favoured.fee).toBe(underdog.fee)
  })

  it('equals the client payoff at the top index', () => {
    for (const group of [makeGroup({ offers: todayOffers() }), uncappedGroup()]) {
      for (const slot of [0, 1, 2, 3, 4]) {
        const entryLevel = group.entryLevels[slot]
        for (const part of [
          { offerSlot: 0, leverage: 2, units: 3 },
          { offerSlot: 1, leverage: 3, units: 2 },
        ]) {
          const offer = group.offers[part.offerSlot]
          const perUnit = payoffAt(offer, entryLevel, SCALE).userClaim - offer.collateral
          const row = pathBreakdown(group, slot, slot, part.leverage, [part])
          expect(row.maxWin).toBe(BigInt(part.units) * perUnit)
        }
      }
    }
  })
})

describe('totalsOf', () => {
  it('adds up totals', () => {
    const group = makeGroup({ offers: todayOffers() })
    const rows = [
      pathBreakdown(group, FAVOURED, 3, 2.5, ORDER),
      pathBreakdown(group, UNDERDOG, 9, 3, [{ offerSlot: 1, leverage: 3, units: 2 }]),
    ]
    expect(totalsOf(rows)).toEqual({
      principal: 40_000_000n,
      valueWithLeverage: 110_000_000n,
      maxWin: 49_300_000n,
      fee: 700_000n,
      maxLoss: 40_000_000n,
    })
    expect(totalsOf([])).toEqual({
      principal: 0n,
      valueWithLeverage: 0n,
      maxWin: 0n,
      fee: 0n,
      maxLoss: 0n,
    })
  })
})
