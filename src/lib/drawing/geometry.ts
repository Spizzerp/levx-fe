import type { Market } from '@/types/market'

/**
 * Precompute checkpoint column timestamps (domain time in ms) from market schedule.
 *
 * Returns a number[] of length market.totalCheckpoints where each entry is:
 *   market.startTime + i * (market.checkpointInterval * 1000)
 *
 * These values are the X-axis "trip wires" that crossingDetector sweeps against.
 * Pure — no DOM, no side effects.
 */
export function buildCheckpointXs(market: Market): number[] {
  const intervalMs = market.checkpointInterval * 1000
  return Array.from({ length: market.totalCheckpoints }, (_, i) => market.startTime + i * intervalMs)
}

/**
 * Nearest checkpoint index at a domain timestamp, or null if out of range.
 *
 * Returns null when domainTimeMs is before market.startTime or past the
 * last checkpoint's timestamp. Uses Math.round for nearest-checkpoint snap.
 *
 * This is used by consumers that need "which checkpoint is the cursor nearest to"
 * (e.g., label display). The crossing-detection algorithm does NOT use this —
 * it iterates the full checkpointXs array directly.
 *
 * Pure — no DOM, no side effects.
 */
export function checkpointIndexAtX(domainTimeMs: number, market: Market): number | null {
  const intervalMs = market.checkpointInterval * 1000
  const offset = domainTimeMs - market.startTime

  if (offset < 0) return null

  const lastValid = (market.totalCheckpoints - 1) * intervalMs
  if (offset > lastValid) return null

  return Math.round(offset / intervalMs)
}
