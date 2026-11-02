/**
 * The trader's leveraged positions in a market (spec §6.2): the status, the principal, the payout
 * once it is known, and one row per path with that path's buckets as one position at their combined
 * leverage. While the receipt is open it is the source; once the keeper has paid and closed it, the
 * receipt's history is.
 */
import {
  GROUP_FUNDED_NORMAL,
  GROUP_FUNDED_VOID,
  RESULT_STAGED,
  payoffAt,
} from '@spizzerp/levx-mode2-client'
import type { Cohort, NettingGroup, PositionReceipt } from '@spizzerp/levx-mode2-client'
import { pathBreakdown } from './breakdown'
import type { ReceiptHistory } from './history'
import type { OrderPart } from './ladder'
import type { Mode2Forecasts, Mode2MarketView } from './types'

export type PositionStatus = 'waiting' | 'running' | 'result-in' | 'paid' | 'voided'

/** One path's positions in micro-USDC; `finalPayout` once the result is in. */
export interface PathPosition {
  slot: number
  pathIndex: number
  leverage: number
  principal: bigint
  valueWithLeverage: bigint
  maxWin: bigint
  fee: bigint
  maxLoss: bigint
  finalPayout: bigint | null
}

export interface PositionSummary {
  status: PositionStatus
  principal: bigint
  /** The observations the cohort has recorded. */
  checkpoint: number
  totalCheckpoints: number
  /** What the receipt will be paid, once the result is in. */
  finalPayout: bigint | null
  /** What the claim paid, once the receipt is closed. */
  paid: bigint | null
  paths: PathPosition[]
}

/** The receipt's positions on one cohort slot, and their payout once the result is in. */
interface SlotPositions {
  slot: number
  parts: OrderPart[]
  payout: bigint | null
}

function openReceiptStatus(group: NettingGroup, cohort: Cohort, nowMs: number): PositionStatus {
  if (group.state === GROUP_FUNDED_VOID) return 'voided'
  if (group.state === GROUP_FUNDED_NORMAL) return 'result-in'
  if (nowMs < Number(cohort.startTime) * 1000) return 'waiting'
  // Staged with the group not funded yet: open, or the reserved closed state.
  return cohort.resultState === RESULT_STAGED ? 'result-in' : 'running'
}

/** One position's payout in bucket `i`: the claim `fund_group` wrote, else the payoff at the staged index. */
function claimOf(group: NettingGroup, cohort: Cohort, i: number): bigint {
  const bucket = group.buckets[i]
  if (group.state === GROUP_FUNDED_NORMAL) return bucket.claim
  const offer = group.offers[bucket.offerSlot]
  return payoffAt(offer, group.entryLevels[bucket.path], cohort.indices[bucket.path]).userClaim
}

/** The receipt's buckets grouped by cohort slot, in slot order. */
function positionsBySlot(
  group: NettingGroup,
  cohort: Cohort,
  receipt: PositionReceipt,
  resultIn: boolean,
): SlotPositions[] {
  const bySlot = new Map<number, SlotPositions>()
  for (let i = 0; i < group.bucketCount; i++) {
    const units = receipt.counts[i]
    if (units === 0) continue
    const { path: slot, offerSlot } = group.buckets[i]
    const positions = bySlot.get(slot) ?? { slot, parts: [], payout: resultIn ? 0n : null }
    positions.parts.push({ offerSlot, leverage: group.offers[offerSlot].leverage, units })
    if (positions.payout !== null) positions.payout += BigInt(units) * claimOf(group, cohort, i)
    bySlot.set(slot, positions)
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot)
}

/** `Σ count × L / Σ count`, to one decimal. */
function combinedLeverage(parts: readonly OrderPart[]): number {
  const units = parts.reduce((sum, part) => sum + part.units, 0)
  const weighted = parts.reduce((sum, part) => sum + part.units * part.leverage, 0)
  return Math.round((10 * weighted) / units) / 10
}

/**
 * The trader's positions in the view's group; null when they hold none, or the receipt is closed
 * and its history does not show the payment yet. A closed receipt has no buckets left to show, and
 * without the forecasts a slot's Mode 1 path is unknown: both leave the path rows out.
 *
 * The keeper closes the group and the epoch right after paying, and later the cohort (a null
 * view): the paid or voided summary then comes from the history alone, with `checkpoint` and
 * `totalCheckpoints` 0 once the cohort is gone (the paid and voided chips do not read them).
 */
export function summarizePosition(
  view: Mode2MarketView | null,
  forecasts: Mode2Forecasts | null,
  history: ReceiptHistory | null,
  nowMs: number,
): PositionSummary | null {
  const progress = {
    checkpoint: view?.cohort.data.observationsRecorded ?? 0,
    totalCheckpoints: view?.cohort.data.totalCheckpoints ?? 0,
  }

  if (view === null || view.receipt === null) {
    if (history === null || history.paid === null) return null
    // A void claim pays back exactly what was put in, whether Mode 1 voided the market or the
    // group voided on its own (Ruling 25).
    const voided = history.paid === history.principal
    return {
      status: voided ? 'voided' : 'paid',
      principal: history.principal,
      ...progress,
      finalPayout: null,
      paid: history.paid,
      paths: [],
    }
  }

  const cohort = view.cohort.data
  const group = view.group?.data
  if (group === undefined) return null
  const receipt = view.receipt.data
  const status = openReceiptStatus(group, cohort, nowMs)
  const slots = positionsBySlot(group, cohort, receipt, status === 'result-in')
  // `pathBreakdown` prices at the slot's entry level, which only a bound group has.
  const paths: PathPosition[] =
    forecasts === null || group.bound !== 1
      ? []
      : slots.map(({ slot, parts, payout }) => {
          const pathIndex = forecasts.slotToPathIndex[slot]
          const leverage = combinedLeverage(parts)
          const { parts: _parts, ...row } = pathBreakdown(group, slot, pathIndex, leverage, parts)
          return { ...row, finalPayout: payout }
        })

  return {
    status,
    principal: receipt.collateral,
    ...progress,
    finalPayout:
      status === 'result-in' ? slots.reduce((sum, { payout }) => sum + (payout ?? 0n), 0n) : null,
    paid: null,
    paths,
  }
}
