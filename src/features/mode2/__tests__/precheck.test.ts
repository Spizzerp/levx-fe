// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  POLICY_CERTIFIED,
  cohortPda,
  concatBytes,
  groupBook,
  groupPda,
  leU128,
  mode1MarketPda,
  positionPda,
  reserveFor,
  u64Le,
} from '@spizzerp/levx-mode2-client'
import type {
  Bucket,
  Cohort,
  FundingEpoch,
  NettingGroup,
  PairExposure,
  PositionReceipt,
  RiskCaps,
} from '@spizzerp/levx-mode2-client'
import { CLOSE_MARGIN_MS } from '../entryWindow'
import { openOffers, splitPrincipal } from '../ladder'
import type { OrderPart } from '../ladder'
import { precheckOrders } from '../precheck'
import type { PathOrder, PrecheckContext, PrecheckReason, PrecheckResult } from '../precheck'
import type { Mode2MarketView } from '../types'
import {
  FIXTURE_MARKET_ID,
  FIXTURE_OWNER,
  FIXTURE_START_MS,
  makeCohort,
  makeEpoch,
  makeGroup,
  makePair,
  makeReceipt,
  makeView,
  todayOffers,
} from './fixtures'

/** Two minutes before the start: entry is open. */
const NOW_MS = FIXTURE_START_MS - 120_000
const USDC = 1_000_000n
const RENT_LAMPORTS = 2_449_920
const FEE_LAMPORTS = 10_000
const GROUP_0 = groupPda(cohortPda(mode1MarketPda(BigInt(FIXTURE_MARKET_ID))), 0)

/** A trader with 1000 USDC and 1 SOL, two minutes before the start. */
const CTX: PrecheckContext = {
  nowMs: NOW_MS,
  marketState: 'pending',
  usdcMicro: 1000n * USDC,
  lamports: 1_000_000_000,
  rentLamports: RENT_LAMPORTS,
  feeLamports: FEE_LAMPORTS,
}

/**
 * `units` 10 USDC positions of today's 2× offer (slot 0) or 3× offer (slot 1). Under today's
 * profit caps each 2× position reserves 20 USDC and each 3× position 10 USDC; their values with
 * leverage are 20 and 30 USDC.
 */
const twoX = (units: number): OrderPart => ({ offerSlot: 0, leverage: 2, units })
const threeX = (units: number): OrderPart => ({ offerSlot: 1, leverage: 3, units })
const onPath = (slot: number, ...parts: OrderPart[]): PathOrder => ({ slot, parts })

/** `count` positions of offer `offerSlot` held on cohort slot `path`. */
const bucket = (offerSlot: number, path: number, count: number): Bucket => ({
  claim: 0n,
  count,
  offerSlot,
  path,
  pad: new Uint8Array(2),
})

/**
 * Group 0 holding `buckets` of today's offers: each offer's `admitted` counts its positions and the
 * group's reserve is the one its book books.
 */
function groupHolding(buckets: Bucket[]): NettingGroup {
  const offers = todayOffers().map((offer, slot) => ({
    ...offer,
    admitted: buckets.filter((b) => b.offerSlot === slot).reduce((sum, b) => sum + b.count, 0),
  }))
  const group = makeGroup({ offers, buckets })
  const groupReserve = reserveFor(groupBook(group), group.k, group.policy, leU128(group.lambdaFp))
  return { ...group, groupReserve }
}

const caps = (o: Partial<RiskCaps>): RiskCaps => ({ ...makeEpoch().caps, ...o })

/**
 * Market 142's view with `o`'s accounts in place of the fixture's, at the same addresses. The
 * epoch's `reserved` defaults to the group's reserve: no other group reserves anything.
 */
function viewWith(o: {
  cohort?: Partial<Cohort>
  group?: NettingGroup
  epoch?: Partial<FundingEpoch>
  pair?: Partial<PairExposure> | null
  receipt?: PositionReceipt
}): Mode2MarketView {
  const view = makeView()
  const group = o.group ?? makeGroup()
  return {
    ...view,
    cohort: { ...view.cohort, data: makeCohort(o.cohort) },
    group: { address: GROUP_0, data: group },
    epoch: view.epoch && {
      ...view.epoch,
      data: makeEpoch({ reserved: group.groupReserve, ...o.epoch }),
    },
    pair: o.pair === null ? null : view.pair && { ...view.pair, data: makePair(o.pair) },
    receipt: o.receipt ? { address: positionPda(GROUP_0, FIXTURE_OWNER), data: o.receipt } : null,
  }
}

const OK: PrecheckResult = { ok: true }
const refused = (reason: PrecheckReason, message: string): PrecheckResult => ({
  ok: false,
  reason,
  message,
})

describe('precheckOrders', () => {
  it("passes a 20 USDC 2.5x order on two paths on today's fixture", () => {
    const orders = [0, 1].map((slot) =>
      onPath(slot, ...(splitPrincipal(2.5, 2, openOffers(makeGroup(), slot, NOW_MS)) ?? [])),
    )
    expect(orders).toEqual([onPath(0, twoX(1), threeX(1)), onPath(1, twoX(1), threeX(1))])
    // 40 USDC of principal and a new receipt: the balances are exactly enough.
    const ctx = { ...CTX, usdcMicro: 40n * USDC, lamports: RENT_LAMPORTS + FEE_LAMPORTS }
    expect(precheckOrders(makeView(), orders, ctx)).toEqual(OK)
  })

  it('refuses outside the entry window', () => {
    const orders = [onPath(0, twoX(1))]
    const closed = refused('closed', 'Leverage entry has closed')
    expect(precheckOrders(makeView(), orders, { ...CTX, nowMs: FIXTURE_START_MS - 9_000 })).toEqual(
      closed,
    )
    expect(precheckOrders(makeView(), orders, { ...CTX, marketState: 'active' })).toEqual(closed)
    expect(precheckOrders(makeView({ paused: true }), orders, CTX)).toEqual(closed)
    expect(precheckOrders(makeView({ group: null }), orders, CTX)).toEqual(closed)
  })

  it('refuses a step whose offer closes within the margin', () => {
    const [two, three] = todayOffers()
    const expiringAt = (ms: number) =>
      viewWith({ group: makeGroup({ offers: [{ ...two, expiresAt: BigInt(ms / 1000) }, three] }) })
    // The 2× offer expires 10 s from now: a signature could land after it; the 3× offer is open.
    const expiring = expiringAt(NOW_MS + CLOSE_MARGIN_MS)
    expect(precheckOrders(expiring, [onPath(0, twoX(1), threeX(1))], CTX)).toEqual(
      refused('closed', 'That leverage step has closed'),
    )
    expect(precheckOrders(expiring, [onPath(0, threeX(2))], CTX)).toEqual(OK)
    expect(precheckOrders(expiringAt(NOW_MS + 11_000), [onPath(0, twoX(1))], CTX)).toEqual(OK)
  })

  it('refuses an order with no positions', () => {
    const none = refused('no-orders', 'Choose a path and a principal')
    expect(precheckOrders(makeView(), [], CTX)).toEqual(none)
    expect(precheckOrders(makeView(), [onPath(0, twoX(0)), onPath(1)], CTX)).toEqual(none)
    // An empty part beside a filled one is left out of the batch.
    expect(precheckOrders(makeView(), [onPath(0, twoX(0), threeX(1))], CTX)).toEqual(OK)
  })

  it("refuses an order over an offer's admissions, counting its parts on every path", () => {
    // The 3× offer has admitted 14 of its 16.
    const view = viewWith({ group: groupHolding([bucket(1, 2, 7), bucket(1, 3, 7)]) })
    expect(precheckOrders(view, [onPath(0, threeX(1)), onPath(1, threeX(1))], CTX)).toEqual(OK)
    expect(precheckOrders(view, [onPath(0, threeX(1)), onPath(1, threeX(2))], CTX)).toEqual(
      refused('offer-full', 'That leverage step is full'),
    )
  })

  it('refuses only the step whose offer is full', () => {
    // Today's 2× offer has admitted all of its 2 positions; the 3× offer has room.
    const held = groupHolding([bucket(0, 0, 2)])
    const group = {
      ...held,
      offers: held.offers.map((offer, slot) =>
        slot === 0 ? { ...offer, maxAdmissions: 2 } : offer,
      ),
    }
    expect(group.offers[0].admitted).toBe(group.offers[0].maxAdmissions)
    const view = viewWith({ group })
    expect(precheckOrders(view, [onPath(0, threeX(1))], CTX)).toEqual(OK)
    expect(precheckOrders(view, [onPath(0, twoX(1))], CTX)).toEqual(
      refused('offer-full', 'That leverage step is full'),
    )
  })

  it("refuses an order over the group's positions", () => {
    const view = viewWith({
      group: groupHolding([bucket(0, 2, 2)]),
      epoch: { caps: caps({ maxGroupPositions: 5 }) },
    })
    expect(precheckOrders(view, [onPath(0, twoX(1), threeX(1)), onPath(1, twoX(1))], CTX)).toEqual(
      OK,
    )
    expect(precheckOrders(view, [onPath(0, twoX(1), threeX(1)), onPath(1, twoX(2))], CTX)).toEqual(
      refused('group-full', 'This market has no room for that many leveraged positions'),
    )
  })

  it("refuses an order over a path's notional, counting the path's whole book", () => {
    // Path 0 already holds 180 USDC of value with leverage; the cap is 250.
    const view = viewWith({ group: groupHolding([bucket(1, 0, 6)]) })
    expect(
      precheckOrders(view, [onPath(0, twoX(2), threeX(1)), onPath(1, threeX(1))], CTX),
    ).toEqual(OK)
    expect(precheckOrders(view, [onPath(0, twoX(1), threeX(2))], CTX)).toEqual(
      refused('path-cap', 'That path has no room for that much value with leverage'),
    )
  })

  it("refuses an order over a cluster's notional, by the cohort's cluster map", () => {
    // The cohort puts paths 0 and 1 in one cluster (the group's own map keeps them apart); path 0
    // already holds 150 USDC of value with leverage, and the cluster cap is 250.
    const clusterMap = Uint8Array.from({ length: 16 }, (_, i) => [0, 0, 2, 3, 4][i] ?? 0)
    const view = viewWith({ cohort: { clusterMap }, group: groupHolding([bucket(1, 0, 5)]) })
    expect(precheckOrders(view, [onPath(1, twoX(5))], CTX)).toEqual(OK)
    expect(precheckOrders(view, [onPath(1, twoX(4), threeX(1))], CTX)).toEqual(
      refused('cluster-cap', 'Paths like this one have no room for that much value with leverage'),
    )
  })

  it("refuses an order over the market's notional", () => {
    // The cohort's book already carries 950 USDC of value with leverage; the cap is 1000.
    const view = viewWith({ cohort: { notionalTotal: 950n * USDC } })
    expect(precheckOrders(view, [onPath(0, twoX(1), threeX(1))], CTX)).toEqual(OK)
    expect(precheckOrders(view, [onPath(0, threeX(2))], CTX)).toEqual(
      refused('market-cap', 'This market has no room for that much value with leverage'),
    )
  })

  it("refuses an order over the pair's notional, and reads a missing pair as empty", () => {
    // The epoch's SOL/USDC exposure already carries 950 USDC; the cap is 1000.
    const view = viewWith({ pair: { notionalTotal: 950n * USDC } })
    expect(precheckOrders(view, [onPath(0, twoX(1), threeX(1))], CTX)).toEqual(OK)
    expect(precheckOrders(view, [onPath(0, threeX(2))], CTX)).toEqual(
      refused('pair-cap', 'This pair has no room for that much value with leverage'),
    )
    expect(precheckOrders(viewWith({ pair: null }), [onPath(0, threeX(2))], CTX)).toEqual(OK)
  })

  it("refuses an order whose reserve is over the group's reserve cap", () => {
    // The group's 2 positions reserve 40 USDC; the cap is 100.
    const view = viewWith({
      group: groupHolding([bucket(0, 2, 2)]),
      epoch: { caps: caps({ maxGroupReserve: 100n * USDC }) },
    })
    expect(precheckOrders(view, [onPath(0, twoX(3))], CTX)).toEqual(OK)
    expect(precheckOrders(view, [onPath(0, twoX(3), threeX(1))], CTX)).toEqual(
      refused('group-reserve', "This market's liquidity cannot cover that max win"),
    )
  })

  it("books the reserve under the group's policy and lambda", () => {
    // One 2× position on each path: the control reserve is 100 USDC; the certified bound at the
    // book's best lambda (the client's `bestLambda`, 73237021) is about 27.87 USDC.
    const orders = [0, 1, 2, 3, 4].map((slot) => onPath(slot, twoX(1)))
    const lambdaFp = concatBytes(u64Le(73_237_021n), u64Le(0n))
    const epoch = { caps: caps({ maxGroupReserve: 50n * USDC }) }
    const certified = makeGroup({ policy: POLICY_CERTIFIED, lambdaFp })
    expect(precheckOrders(viewWith({ group: certified, epoch }), orders, CTX)).toEqual(OK)
    const overCap = refused('group-reserve', "This market's liquidity cannot cover that max win")
    expect(precheckOrders(viewWith({ group: makeGroup(), epoch }), orders, CTX)).toEqual(overCap)
    // At lambda 0 the certified bound is about 99.55 USDC.
    const atZero = makeGroup({ policy: POLICY_CERTIFIED })
    expect(precheckOrders(viewWith({ group: atZero, epoch }), orders, CTX)).toEqual(overCap)
  })

  it("refuses an order whose epoch reservation is over the LP's cash", () => {
    // 200 USDC of LP cash; the group reserves 40 of the 190 reserved, and its new reserve replaces it.
    const view = viewWith({
      group: groupHolding([bucket(0, 2, 2)]),
      epoch: { reserved: 190n * USDC, caps: caps({ maxEpochReservation: 1000n * USDC }) },
    })
    expect(precheckOrders(view, [onPath(0, threeX(1))], CTX)).toEqual(OK)
    expect(precheckOrders(view, [onPath(0, twoX(1))], CTX)).toEqual(
      refused('lp-cash', 'The liquidity pool cannot cover that max win'),
    )
  })

  it("refuses an order whose epoch reservation is over the epoch's cap", () => {
    // A 200 USDC reservation cap; the group reserves 40 of the 190 reserved.
    const view = viewWith({
      group: groupHolding([bucket(0, 2, 2)]),
      epoch: { reserved: 190n * USDC, lp: 1000n * USDC },
    })
    expect(precheckOrders(view, [onPath(0, threeX(1))], CTX)).toEqual(OK)
    expect(precheckOrders(view, [onPath(0, twoX(1))], CTX)).toEqual(
      refused('epoch-reserve', "The liquidity pool's limit cannot cover that max win"),
    )
  })

  it('refuses an order over the USDC balance, naming the shortfall', () => {
    const orders = [onPath(0, twoX(1), threeX(1))]
    expect(precheckOrders(makeView(), orders, { ...CTX, usdcMicro: 20n * USDC })).toEqual(OK)
    // 5000 micro-USDC short: rounded up to the cent.
    expect(precheckOrders(makeView(), orders, { ...CTX, usdcMicro: 19_995_000n })).toEqual(
      refused('usdc', 'You need 0.01 USDC more'),
    )
    // A balance that could not be read is left to the program.
    expect(precheckOrders(makeView(), orders, { ...CTX, usdcMicro: null })).toEqual(OK)
  })

  it('refuses an order the SOL balance cannot open a receipt for, naming the shortfall', () => {
    const orders = [onPath(0, twoX(1))]
    const enough = RENT_LAMPORTS + FEE_LAMPORTS
    expect(precheckOrders(makeView(), orders, { ...CTX, lamports: enough })).toEqual(OK)
    // 2,459,920 lamports short: rounded up to 0.0025 SOL.
    expect(precheckOrders(makeView(), orders, { ...CTX, lamports: 0 })).toEqual(
      refused('sol', 'You need 0.0025 SOL more'),
    )
    expect(precheckOrders(makeView(), orders, { ...CTX, lamports: null })).toEqual(OK)
  })

  it('asks a returning trader for the fees only, without the rent', () => {
    const view = viewWith({ group: groupHolding([bucket(0, 0, 2)]), receipt: makeReceipt([2]) })
    const orders = [onPath(0, twoX(1))]
    expect(precheckOrders(view, orders, { ...CTX, lamports: FEE_LAMPORTS })).toEqual(OK)
    // 1 lamport short: rounded up to 0.0001 SOL.
    expect(precheckOrders(view, orders, { ...CTX, lamports: FEE_LAMPORTS - 1 })).toEqual(
      refused('sol', 'You need 0.0001 SOL more'),
    )
  })

  it('reports the first check the program would fail', () => {
    const view = viewWith({
      group: groupHolding([bucket(1, 0, 6)]),
      epoch: { caps: caps({ maxGroupPositions: 7 }) },
    })
    // Over the group's positions, the path's notional and the USDC balance at once.
    expect(precheckOrders(view, [onPath(0, threeX(3))], { ...CTX, usdcMicro: 0n })).toEqual(
      refused('group-full', 'This market has no room for that many leveraged positions'),
    )
  })
})
