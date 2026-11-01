/**
 * One path's order priced with the client's payoff functions at the path's entry level: the
 * principal (also the max loss), the value with leverage (the notional), the max win (the claim at
 * the top index less the principal, after the fee) and the fee; and the totals over the paths.
 */
import { SCALE, payoffAt, quantitiesAt } from '@spizzerp/levx-mode2-client'
import type { NettingGroup, Quote } from '@spizzerp/levx-mode2-client'
import type { OrderPart } from './ladder'

/** Micro-USDC amounts summed over an order's parts or over the paths. */
export interface BreakdownTotals {
  principal: bigint
  valueWithLeverage: bigint
  maxWin: bigint
  fee: bigint
  maxLoss: bigint
}

/** One path's order: cohort slot `slot`, Mode 1 path `pathIndex`, at the slider's `leverage`. */
export interface PathBreakdown extends BreakdownTotals {
  slot: number
  pathIndex: number
  leverage: number
  parts: OrderPart[]
}

const zero = (): BreakdownTotals => ({
  principal: 0n,
  valueWithLeverage: 0n,
  maxWin: 0n,
  fee: 0n,
  maxLoss: 0n,
})

function add(a: BreakdownTotals, b: BreakdownTotals): BreakdownTotals {
  return {
    principal: a.principal + b.principal,
    valueWithLeverage: a.valueWithLeverage + b.valueWithLeverage,
    maxWin: a.maxWin + b.maxWin,
    fee: a.fee + b.fee,
    maxLoss: a.maxLoss + b.maxLoss,
  }
}

/** `part.units` positions of the offer in `part.offerSlot`, entered at `entryLevel`. */
function partTotals(group: NettingGroup, entryLevel: bigint, part: OrderPart): BreakdownTotals {
  const q: Quote = group.offers[part.offerSlot]
  const units = BigInt(part.units)
  const principal = units * q.collateral
  return {
    principal,
    valueWithLeverage: units * quantitiesAt(q, entryLevel).notional,
    maxWin: units * (payoffAt(q, entryLevel, SCALE).userClaim - q.collateral),
    fee: units * q.capacityFee,
    maxLoss: principal,
  }
}

export function pathBreakdown(
  group: NettingGroup,
  slot: number,
  pathIndex: number,
  leverage: number,
  parts: readonly OrderPart[],
): PathBreakdown {
  const entryLevel = group.entryLevels[slot]
  const totals = parts.reduce((sum, part) => add(sum, partTotals(group, entryLevel, part)), zero())
  return { slot, pathIndex, leverage, parts: [...parts], ...totals }
}

export function totalsOf(rows: readonly PathBreakdown[]): BreakdownTotals {
  return rows.reduce<BreakdownTotals>(add, zero())
}
