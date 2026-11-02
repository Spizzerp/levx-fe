/**
 * The trader's leverage order: the leverage and principal they chose, the slider's ladder with the
 * steps that cannot be taken, each cohort path's breakdown and the pre-check of the orders.
 */
import { useMemo, useState } from 'react'
import type { NettingGroup } from '@spizzerp/levx-mode2-client'
import type { MarketState, PredictionPath } from '@/types/market'
import { positionCount } from './admission'
import { pathBreakdown, totalsOf } from './breakdown'
import type { BreakdownTotals, PathBreakdown } from './breakdown'
import { CLOSE_MARGIN_MS } from './entryWindow'
import { formatLeverage, formatUsdc } from './format'
import {
  PRINCIPAL_STEP_MICRO,
  ladderValues,
  openOffers,
  roundPrincipal,
  splitPrincipal,
  unitCollateral,
} from './ladder'
import type { OfferRef } from './ladder'
import { precheckOrders } from './precheck'
import type { PathOrder, PrecheckContext, PrecheckReason, PrecheckResult } from './precheck'
import type { Mode2Forecasts, Mode2MarketView } from './types'

export interface LeverageOrderState {
  /** The leverage on the slider: always an enabled step while one exists. */
  leverage: number
  setLeverage(v: number): void
  principalText: string
  setPrincipalText(t: string): void
  /** Rounds the typed principal down to the 10 USDC step. */
  commitPrincipal(): void
  values: number[]
  disabledValues: number[]
  /** Why the leverage the trader chose cannot be taken; null when it can. */
  disabledReason: string | null
  rows: PathBreakdown[]
  /** The selected paths the cohort does not hold. */
  unavailable: PredictionPath[]
  totals: BreakdownTotals
  /** The cohort paths' orders with at least one unit. */
  orders: PathOrder[]
  /** The orders' pre-check, after the 4-path cap. */
  precheck: PrecheckResult
}

/** The refusals a step's own size causes: they disable its tick. */
const STEP_REASONS: ReadonlySet<PrecheckReason> = new Set<PrecheckReason>([
  'offer-full',
  'group-full',
  'path-cap',
  'cluster-cap',
  'market-cap',
  'pair-cap',
  'group-reserve',
  'epoch-reserve',
  'lp-cash',
])

/** Two steps: on today's 2× and 3× offers at 10 USDC that also reaches 2.5×. */
const DEFAULT_PRINCIPAL_TEXT = formatUsdc(2n * PRINCIPAL_STEP_MICRO)

/** Why a chosen step left the ladder: its offer is past expiry, as the pre-check says. */
const STEP_CLOSED = 'That leverage step has closed'

/** An order takes up to 4 paths as today's bet does (spec §4.3); non-cohort paths do not count. */
const MAX_ORDER_PATHS = 4
const TOO_MANY_PATHS: PrecheckResult = {
  ok: false,
  reason: 'too-many-paths',
  message: `Max ${MAX_ORDER_PATHS} paths per order`,
}

/** A selected path the cohort holds: its slot and the offers open on it. */
interface CohortPath {
  path: PredictionPath
  slot: number
  offers: OfferRef[]
}

const tenths = (leverage: number): number => Math.round(leverage * 10)

/** The value of `values` (ascending) nearest `target`; the lower one on a tie. */
function nearest(values: readonly number[], target: number): number | undefined {
  const distance = (v: number) => Math.abs(tenths(v) - tenths(target))
  return values.reduce<number | undefined>(
    (best, v) => (best === undefined || distance(v) < distance(best) ? v : best),
    undefined,
  )
}

/**
 * The offers open on any of `slots`, by leverage. An offer leaves the ladder `CLOSE_MARGIN_MS`
 * before its expiry, when the pre-check starts refusing it.
 */
function ladderOf(group: NettingGroup, slots: readonly number[], nowMs: number): OfferRef[] {
  const bySlot = new Map<number, OfferRef>()
  for (const slot of slots) {
    for (const offer of openOffers(group, slot, nowMs + CLOSE_MARGIN_MS)) {
      bySlot.set(offer.slot, offer)
    }
  }
  return [...bySlot.values()].sort((a, b) => a.leverage - b.leverage)
}

/**
 * The leverage on the slider: the one the trader chose (the lowest step until they choose) while
 * it is enabled, else the nearest enabled step with the reason the chosen one is not (or that it
 * closed, when its offer left the ladder). When every step is blocked the thumb stays on the
 * ladder and the reason is its own.
 */
function chooseLeverage(
  values: readonly number[],
  blocked: ReadonlyMap<number, string | null>,
  requested: number | null,
): { leverage: number; reason: string | null } {
  if (values.length === 0) return { leverage: requested ?? 0, reason: null }
  const enabled = values.filter((v) => blocked.get(v) === null)
  const wanted = requested ?? values[0]
  const reason = values.includes(wanted) ? (blocked.get(wanted) ?? null) : STEP_CLOSED
  if (reason === null) return { leverage: wanted, reason: null }
  const fallback = nearest(enabled, wanted)
  if (fallback !== undefined) return { leverage: fallback, reason }
  const leverage = values.includes(wanted) ? wanted : values[0]
  return { leverage, reason: blocked.get(leverage) ?? null }
}

export function useLeverageOrder(
  view: Mode2MarketView,
  forecasts: Mode2Forecasts | null,
  selectedPaths: readonly PredictionPath[],
  ctx: Omit<PrecheckContext, 'nowMs' | 'marketState'>,
  nowMs: number,
  marketState: MarketState,
): LeverageOrderState {
  const [requested, setLeverage] = useState<number | null>(null)
  const [principalText, setPrincipalText] = useState(DEFAULT_PRINCIPAL_TEXT)
  const principal = roundPrincipal(principalText)

  const ladder = useMemo(() => {
    const group = view.group?.data
    const slotOf = (path: PredictionPath) =>
      forecasts?.slotToPathIndex.indexOf(path.pathIndex) ?? -1
    const cohort: CohortPath[] = selectedPaths.flatMap((path) => {
      const slot = slotOf(path)
      if (slot < 0) return []
      return [{ path, slot, offers: group ? openOffers(group, slot, nowMs + CLOSE_MARGIN_MS) : [] }]
    })
    // Until a cohort path is chosen the slider shows every step the cohort offers.
    const ladderSlots =
      cohort.length > 0
        ? cohort.map((c) => c.slot)
        : Array.from({ length: group?.k ?? 0 }, (_, slot) => slot)
    const offers = group ? ladderOf(group, ladderSlots, nowMs) : []
    const values = ladderValues(offers)
    const unit = unitCollateral(offers)
    const units = unit === null ? 0 : Number(principal / unit)

    /** Each cohort path's order at `leverage`, in selection order; null when one cannot be filled. */
    const ordersAt = (leverage: number): PathOrder[] | null => {
      const orders: PathOrder[] = []
      for (const { slot, offers: pathOffers } of cohort) {
        const parts = splitPrincipal(leverage, units, pathOffers)
        if (parts === null) return null
        orders.push({ slot, parts })
      }
      return orders
    }

    // A step's room does not depend on the trader's balances, so their checks are skipped here.
    const stepCtx: PrecheckContext = {
      nowMs,
      marketState,
      usdcMicro: null,
      lamports: null,
      rentLamports: 0,
      feeLamports: 0,
    }
    const blocked = new Map<number, string | null>(
      values.map((value) => {
        const orders = ordersAt(value)
        if (orders === null) {
          return [
            value,
            `${formatLeverage(value)} cannot be made from ${formatUsdc(principal)} USDC`,
          ]
        }
        const result = precheckOrders(view, orders, stepCtx)
        return [value, !result.ok && STEP_REASONS.has(result.reason) ? result.message : null]
      }),
    )
    const unavailable = forecasts === null ? [] : selectedPaths.filter((path) => slotOf(path) < 0)
    return { cohort, unavailable, values, blocked, ordersAt }
  }, [view, forecasts, selectedPaths, principal, nowMs, marketState])

  const { cohort, unavailable, values, blocked, ordersAt } = ladder
  const { leverage, reason } = chooseLeverage(values, blocked, requested)
  const pathOrders = ordersAt(leverage)
  const group = view.group?.data
  const rows =
    group !== undefined && group.bound === 1
      ? cohort.map((c, i) =>
          pathBreakdown(group, c.slot, c.path.pathIndex, leverage, pathOrders?.[i].parts ?? []),
        )
      : []
  const orders = (pathOrders ?? []).filter((order) => order.parts.length > 0)

  return {
    leverage,
    setLeverage,
    principalText,
    setPrincipalText,
    commitPrincipal: () => setPrincipalText(formatUsdc(roundPrincipal(principalText))),
    values,
    disabledValues: values.filter((v) => blocked.get(v) !== null),
    disabledReason: reason,
    rows,
    unavailable,
    totals: totalsOf(rows),
    orders,
    precheck:
      positionCount(orders) > MAX_ORDER_PATHS
        ? TOO_MANY_PATHS
        : precheckOrders(view, orders, { ...ctx, nowMs, marketState }),
  }
}
