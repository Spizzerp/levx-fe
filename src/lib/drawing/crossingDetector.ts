import type { CheckpointCrossing } from './types'

/**
 * Pure crossing-detection function.
 *
 * Given two consecutive cursor positions in domain space (time ms on X,
 * price on Y), returns the list of checkpoint columns crossed between those
 * two positions, each with a linearly-interpolated price value.
 *
 * Algorithm:
 * 1. Compute [lo, hi] = [min(prevX, currX), max(prevX, currX)].
 * 2. For every checkpoint whose X falls within [lo, hi], compute
 *    t = (ckX - prevX) / (currX - prevX)  and  y = prevY + t*(currY - prevY).
 * 3. Return results in ascending checkpoint-index order (matching checkpointXs).
 *
 * Edge cases:
 * - Forward stroke (prevX < currX): naturally handled by lo/hi swap.
 * - Backward stroke (prevX > currX): lo/hi swap; t is still computed from prevX.
 * - Vertical stroke (prevX === currX): t = 0.5 → y = midpoint; avoids divide-by-zero.
 * - Start-boundary (ckX === prevX): included (lo is inclusive).
 * - End-boundary (ckX === currX): included (hi is inclusive).
 * - No crossings: returns [].
 *
 * This function is pure — no DOM, no React, no side effects.
 */
export function crossingDetector(
  prevX: number,
  currX: number,
  prevY: number,
  currY: number,
  checkpointXs: readonly number[],
): CheckpointCrossing[] {
  const lo = Math.min(prevX, currX)
  const hi = Math.max(prevX, currX)
  const results: CheckpointCrossing[] = []

  for (let k = 0; k < checkpointXs.length; k++) {
    const ckX = checkpointXs[k]
    if (ckX >= lo && ckX <= hi) {
      const t = prevX === currX ? 0.5 : (ckX - prevX) / (currX - prevX)
      results.push({ index: k, y: prevY + t * (currY - prevY) })
    }
  }

  return results
}
