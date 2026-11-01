// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  PRINCIPAL_STEP_MICRO,
  ladderValues,
  openOffers,
  roundPrincipal,
  splitPrincipal,
  unitCollateral,
} from '../ladder'
import type { OrderPart } from '../ladder'
import { FIXTURE_START_MS, dollarOffers, makeGroup, todayOffers } from './fixtures'

/** Two minutes before the start: every fixture offer is still open. */
const NOW_MS = FIXTURE_START_MS - 120_000
const NOW_SECONDS = BigInt(NOW_MS / 1000)

const todayRefs = openOffers(makeGroup({ offers: todayOffers() }), 0, NOW_MS)
const dollarRefs = openOffers(makeGroup({ offers: dollarOffers() }), 0, NOW_MS)

/** The parts' leverage weighted by units, in tenths: equals `units × t` when the split is exact. */
const weightedTenths = (parts: readonly OrderPart[]): number =>
  parts.reduce((sum, part) => sum + part.units * part.leverage * 10, 0)

describe('openOffers', () => {
  it('lists the open offers on the path by leverage', () => {
    const refs = openOffers(makeGroup({ offers: todayOffers().reverse() }), 0, NOW_MS)
    expect(refs).toEqual([
      { slot: 1, leverage: 2, collateral: 10_000_000n },
      { slot: 0, leverage: 3, collateral: 10_000_000n },
    ])
  })

  it('drops expired and unpermitted offers', () => {
    const [two, three] = todayOffers()
    const group = makeGroup({
      offers: [
        { ...two, expiresAt: NOW_SECONDS },
        { ...three, permittedPaths: 0b11011 },
      ],
    })
    // The program admits only while now < expires_at: the 2× offer is gone at its expiry second.
    expect(openOffers(group, 0, NOW_MS).map((ref) => ref.leverage)).toEqual([3])
    expect(openOffers(group, 0, NOW_MS - 1).map((ref) => ref.leverage)).toEqual([2, 3])
    // The 3× offer does not permit cohort slot 2.
    expect(openOffers(group, 2, NOW_MS - 1).map((ref) => ref.leverage)).toEqual([2])
    expect(openOffers(makeGroup(), 0, FIXTURE_START_MS)).toEqual([])
  })

  it('reads only the offers within the offer count', () => {
    const group = makeGroup({ offers: todayOffers(), offerCount: 1 })
    expect(openOffers(group, 0, NOW_MS).map((ref) => ref.leverage)).toEqual([2])
  })
})

describe('unitCollateral', () => {
  it('returns the collateral the offers share', () => {
    expect(unitCollateral(todayRefs)).toBe(10_000_000n)
    expect(unitCollateral(dollarRefs)).toBe(1_000_000n)
  })

  it('returns no unit when offers disagree on collateral', () => {
    const mixed = openOffers(
      makeGroup({ offers: [...todayOffers(), ...dollarOffers()] }),
      0,
      NOW_MS,
    )
    expect(mixed).toHaveLength(6)
    expect(unitCollateral(mixed)).toBeNull()
    expect(unitCollateral([])).toBeNull()
  })
})

describe('ladderValues', () => {
  it("runs 2.0 to 3.0 in tenths on today's offers", () => {
    const values = ladderValues(todayRefs)
    expect(values).toHaveLength(11)
    expect(values[0]).toBe(2)
    expect(values[10]).toBe(3)
    expect(values[4]).toBe(2.4)
    expect(values).toEqual([2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3])
  })

  it('runs 1.0 to 4.0 on the 1 USDC offers', () => {
    const values = ladderValues(dollarRefs)
    expect(values).toHaveLength(31)
    expect(values[0]).toBe(1)
    expect(values[30]).toBe(4)
  })

  it('is empty without offers', () => {
    expect(ladderValues([])).toEqual([])
  })
})

describe('splitPrincipal', () => {
  it('splits 50 units at 2.4x into 30 at 2x and 20 at 3x', () => {
    expect(splitPrincipal(2.4, 50, todayRefs)).toEqual([
      { offerSlot: 0, leverage: 2, units: 30 },
      { offerSlot: 1, leverage: 3, units: 20 },
    ])
  })

  it('fills every tenth exactly when the principal is a multiple of 10 units', () => {
    for (const units of [10, 20, 50]) {
      for (const leverage of ladderValues(dollarRefs)) {
        const parts = splitPrincipal(leverage, units, dollarRefs)
        expect(parts, `${units} units at ${leverage}×`).not.toBeNull()
        const split = parts ?? []
        expect(split.reduce((sum, part) => sum + part.units, 0)).toBe(units)
        expect(weightedTenths(split)).toBe(units * Math.round(leverage * 10))
      }
    }
  })

  it('refuses a tenth a small principal cannot fill', () => {
    expect(splitPrincipal(2, 2, todayRefs)).toEqual([{ offerSlot: 0, leverage: 2, units: 2 }])
    expect(splitPrincipal(2.5, 2, todayRefs)).toEqual([
      { offerSlot: 0, leverage: 2, units: 1 },
      { offerSlot: 1, leverage: 3, units: 1 },
    ])
    expect(splitPrincipal(3, 2, todayRefs)).toEqual([{ offerSlot: 1, leverage: 3, units: 2 }])
    expect(splitPrincipal(2.4, 2, todayRefs)).toBeNull()
  })

  it('uses one offer for a whole number', () => {
    expect(splitPrincipal(3, 7, todayRefs)).toEqual([{ offerSlot: 1, leverage: 3, units: 7 }])
  })

  it('refuses a leverage outside the offers', () => {
    expect(splitPrincipal(1.9, 10, todayRefs)).toBeNull()
    expect(splitPrincipal(3.1, 10, todayRefs)).toBeNull()
    expect(splitPrincipal(2, 10, [])).toBeNull()
  })
})

describe('roundPrincipal', () => {
  it('rounds the principal down to the 10 USDC step', () => {
    expect(PRINCIPAL_STEP_MICRO).toBe(10_000_000n)
    expect(roundPrincipal('25')).toBe(20_000_000n)
    expect(roundPrincipal('10.99')).toBe(10_000_000n)
    expect(roundPrincipal('9.99')).toBe(0n)
    for (const text of ['abc', '-10', '', '1e3']) expect(roundPrincipal(text), text).toBe(0n)
  })
})
