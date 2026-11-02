/**
 * The pre-check: every refusal `admit_batch` can give the trader's order, checked in the browser
 * in the program's order (admission.rs), so an order is never refused after the wallet prompt. A
 * balance that could not be read skips its check and leaves it to the program.
 */
import { bookAfter, leU128, reserveFor } from '@spizzerp/levx-mode2-client'
import type { BookOrder, Quote } from '@spizzerp/levx-mode2-client'
import type { MarketState } from '@/types/market'
import { CLOSE_MARGIN_MS, entryState } from './entryWindow'
import type { OrderPart } from './ladder'
import type { Mode2MarketView } from './types'

export type PrecheckReason =
  | 'closed'
  | 'no-orders'
  | 'offer-full'
  | 'group-full'
  | 'path-cap'
  | 'cluster-cap'
  | 'market-cap'
  | 'pair-cap'
  | 'group-reserve'
  | 'epoch-reserve'
  | 'lp-cash'
  | 'usdc'
  | 'sol'
  /** The order's own cap (spec §4.3), checked by `useLeverageOrder`: not a program refusal. */
  | 'too-many-paths'

export type PrecheckResult = { ok: true } | { ok: false; reason: PrecheckReason; message: string }

export interface PrecheckContext {
  nowMs: number
  marketState: MarketState
  /** The trader's USDC in micro-USDC; null when it could not be read. */
  usdcMicro: bigint | null
  /** The trader's SOL; null when it could not be read. */
  lamports: number | null
  /** The rent of a new position receipt, paid by the trader. */
  rentLamports: number
  feeLamports: number
}

/** One path's order: cohort slot `slot` and the offers its principal is split across. */
export interface PathOrder {
  slot: number
  parts: OrderPart[]
}

const MS_PER_SECOND = 1000
const MICRO_PER_CENT = 10_000n
const LAMPORTS_PER_TEN_THOUSANDTH_SOL = 100_000

const refuse = (reason: PrecheckReason, message: string): PrecheckResult => ({
  ok: false,
  reason,
  message,
})

/** Micro-USDC as USDC to the cent, rounded up so the amount named covers the shortfall. */
function usdcUp(micro: bigint): string {
  const cents = (micro + MICRO_PER_CENT - 1n) / MICRO_PER_CENT
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}

/** Lamports as SOL to four decimals, rounded up so the amount named covers the shortfall. */
function solUp(lamports: number): string {
  return (Math.ceil(lamports / LAMPORTS_PER_TEN_THOUSANDTH_SOL) / 10_000).toFixed(4)
}

/** The value with leverage of `count` positions of `quote`: `count × C × L`. */
const notional = (quote: Quote, count: number): bigint =>
  BigInt(count) * quote.collateral * BigInt(quote.leverage)

function addTo(totals: Map<number, bigint>, key: number, value: bigint): void {
  totals.set(key, (totals.get(key) ?? 0n) + value)
}

const anyOver = (totals: Map<number, bigint>, cap: bigint): boolean =>
  [...totals.values()].some((total) => total > cap)

export function precheckOrders(
  view: Mode2MarketView,
  orders: readonly PathOrder[],
  ctx: PrecheckContext,
): PrecheckResult {
  const group = view.group?.data
  const epoch = view.epoch?.data
  const entry = entryState(view, ctx.marketState, ctx.nowMs)
  if (group === undefined || epoch === undefined || entry.kind !== 'open') {
    return refuse('closed', 'Leverage entry has closed')
  }

  // The program's orders: one per part with positions, path by path.
  const batch: BookOrder[] = orders.flatMap((order) =>
    order.parts
      .filter((part) => part.units > 0)
      .map((part) => ({ offerSlot: part.offerSlot, selectedPath: order.slot, count: part.units })),
  )
  if (batch.length === 0) return refuse('no-orders', 'Choose a path and a principal')

  // Each order: its offer's expiry, with the signature margin, then the offer's admissions with the
  // batch's orders on that offer so far.
  const perSlot = new Map<number, number>()
  for (const order of batch) {
    const offer = group.offers[order.offerSlot]
    if (ctx.nowMs >= Number(offer.expiresAt) * MS_PER_SECOND - CLOSE_MARGIN_MS) {
      return refuse('closed', 'That leverage step has closed')
    }
    const count = (perSlot.get(order.offerSlot) ?? 0) + order.count
    perSlot.set(order.offerSlot, count)
    if (offer.admitted + count > offer.maxAdmissions) {
      return refuse('offer-full', 'That leverage step is full')
    }
  }

  // The caps, over the group's whole book after the batch.
  const { caps } = epoch
  const book = bookAfter(group, batch)
  if (book.reduce((sum, bucket) => sum + bucket.count, 0) > caps.maxGroupPositions) {
    return refuse('group-full', 'This market has no room for that many leveraged positions')
  }
  const byPath = new Map<number, bigint>()
  const byCluster = new Map<number, bigint>()
  for (const bucket of book) {
    const value = notional(bucket.quote, bucket.count)
    addTo(byPath, bucket.path, value)
    addTo(byCluster, view.cohort.data.clusterMap[bucket.path], value)
  }
  if (anyOver(byPath, caps.maxPathNotional)) {
    return refuse('path-cap', 'That path has no room for that much value with leverage')
  }
  if (anyOver(byCluster, caps.maxClusterNotional)) {
    return refuse(
      'cluster-cap',
      'Paths like this one have no room for that much value with leverage',
    )
  }
  const added = batch.reduce(
    (sum, order) => sum + notional(group.offers[order.offerSlot], order.count),
    0n,
  )
  if (view.cohort.data.notionalTotal + added > caps.maxMarketNotional) {
    return refuse('market-cap', 'This market has no room for that much value with leverage')
  }
  if ((view.pair?.data.notionalTotal ?? 0n) + added > caps.maxPairNotional) {
    return refuse('pair-cap', 'This pair has no room for that much value with leverage')
  }

  // The reserve the group's policy books for that book, then the epoch's reservation with it in
  // place of the group's current reserve.
  const reserve = reserveFor(book, group.k, group.policy, leU128(group.lambdaFp))
  if (reserve > caps.maxGroupReserve) {
    return refuse('group-reserve', "This market's liquidity cannot cover that max win")
  }
  const reserved = epoch.reserved - group.groupReserve + reserve
  if (reserved > epoch.lp) return refuse('lp-cash', 'The liquidity pool cannot cover that max win')
  if (reserved > caps.maxEpochReservation) {
    return refuse('epoch-reserve', "The liquidity pool's limit cannot cover that max win")
  }

  // The trader's balances: the principal, and the fees with a new receipt's rent (a returning
  // trader's receipt exists, so only the fees).
  const principal = batch.reduce(
    (sum, order) => sum + BigInt(order.count) * group.offers[order.offerSlot].collateral,
    0n,
  )
  if (ctx.usdcMicro !== null && ctx.usdcMicro < principal) {
    return refuse('usdc', `You need ${usdcUp(principal - ctx.usdcMicro)} USDC more`)
  }
  const lamportsNeeded = (view.receipt === null ? ctx.rentLamports : 0) + ctx.feeLamports
  if (ctx.lamports !== null && ctx.lamports < lamportsNeeded) {
    return refuse('sol', `You need ${solUp(lamportsNeeded - ctx.lamports)} SOL more`)
  }
  return { ok: true }
}
