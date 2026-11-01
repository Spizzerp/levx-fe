/**
 * The entry window: whether a market's leverage entry is open, waiting for the paths or closed,
 * from the checks `admit_batch` runs before it reads an order (admission.rs).
 */
import { EPOCH_ACTIVE, GROUP_OPEN } from '@spizzerp/levx-mode2-client'
import type { MarketState } from '@/types/market'
import type { Mode2MarketView } from './types'

/** Entry closes this long before the program's close: the time a signature takes. */
export const CLOSE_MARGIN_MS = 10_000

export type EntryState =
  | { kind: 'none' }
  | { kind: 'waiting-bind' }
  | { kind: 'open'; closesAtMs: number }
  | { kind: 'closed' }

const MS_PER_SECOND = 1000
const msOf = (seconds: bigint): number => Number(seconds) * MS_PER_SECOND

/**
 * `none` without a group. `waiting-bind` while the group is unbound, the market pending and the
 * start ahead. `open` while the program admits (the group bound and open, the epoch active, the
 * program not paused, the market pending) until `CLOSE_MARGIN_MS` before `closesAtMs`: the earliest
 * of the start, the admission cutoff and the last offer's expiry. An offer that expires earlier
 * only loses its own steps (`openOffers`). Otherwise `closed`.
 */
export function entryState(
  view: Mode2MarketView | null,
  marketState: MarketState,
  nowMs: number,
): EntryState {
  if (view === null || view.group === null) return { kind: 'none' }
  const group = view.group.data
  const startMs = msOf(view.cohort.data.startTime)
  if (group.bound === 0) {
    return marketState === 'pending' && nowMs < startMs
      ? { kind: 'waiting-bind' }
      : { kind: 'closed' }
  }
  const epoch = view.epoch?.data
  if (epoch === undefined) return { kind: 'closed' }
  const lastExpiry = group.offers
    .slice(0, group.offerCount)
    .reduce((last, offer) => (offer.expiresAt > last ? offer.expiresAt : last), 0n)
  const closesAtMs = Math.min(startMs, msOf(epoch.admissionCutoff), msOf(lastExpiry))
  const admits =
    group.bound === 1 &&
    group.state === GROUP_OPEN &&
    epoch.phase === EPOCH_ACTIVE &&
    !view.paused &&
    marketState === 'pending'
  return admits && nowMs < closesAtMs - CLOSE_MARGIN_MS
    ? { kind: 'open', closesAtMs }
    : { kind: 'closed' }
}
