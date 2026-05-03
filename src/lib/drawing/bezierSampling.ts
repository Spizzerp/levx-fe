import type { CheckpointCrossing } from '@/lib/drawing/types'

/**
 * Bezier authoring anchor — stored in domain coords so pan/zoom between
 * clicks doesn't shift it visually.
 *
 * `outHandle` is the outgoing control point. The incoming control point is
 * mirrored across the anchor (symmetric / smooth handle, v1 simplification).
 * `null` = corner anchor (no curvature; control points collapse to anchor).
 */
export interface BezierAnchor {
  domainX: number
  domainY: number
  outHandle: { domainX: number; domainY: number } | null
}

/** Evaluate a 1-D cubic Bezier at parameter t ∈ [0,1]. */
function bezierEval(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/**
 * Bisect t ∈ [0,1] so bezierX(t) ≈ target. Assumes the segment is monotonic
 * in x (the typical case for a left-to-right authored path); for non-monotonic
 * segments the result is one of the roots, not necessarily the geometrically
 * "correct" one. v1 accepts this — see PR notes on S-curve limitation.
 */
function bisectBezierT(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  target: number,
): number {
  const ascending = p3 >= p0
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    const x = bezierEval(p0, p1, p2, p3, mid)
    if (ascending ? x < target : x > target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Sample a multi-segment cubic Bezier path at every checkpoint x in range,
 * returning crossings ready for `setCheckpointValues`.
 *
 * Empty result when fewer than two anchors are placed.
 *
 * Each segment between anchor[i] and anchor[i+1] uses:
 * - Control 1 = anchor[i].outHandle (or anchor[i] if corner)
 * - Control 2 = mirrored incoming handle of anchor[i+1] (= 2·anchor − outHandle)
 *               or anchor[i+1] if corner
 */
export function sampleBezierAtCheckpoints(
  anchors: readonly BezierAnchor[],
  checkpointXs: readonly number[],
  yMin: number,
  yMax: number,
): CheckpointCrossing[] {
  if (anchors.length < 2) return []

  const out: CheckpointCrossing[] = []
  const seen = new Set<number>()

  for (let segIdx = 0; segIdx < anchors.length - 1; segIdx++) {
    const a = anchors[segIdx]
    const b = anchors[segIdx + 1]

    const c1x = a.outHandle ? a.outHandle.domainX : a.domainX
    const c1y = a.outHandle ? a.outHandle.domainY : a.domainY
    // Mirror b.outHandle across b to get b's incoming handle.
    const c2x = b.outHandle ? 2 * b.domainX - b.outHandle.domainX : b.domainX
    const c2y = b.outHandle ? 2 * b.domainY - b.outHandle.domainY : b.domainY

    const segMinX = Math.min(a.domainX, b.domainX)
    const segMaxX = Math.max(a.domainX, b.domainX)
    if (segMinX === segMaxX) continue // zero-width segment, nothing to sample

    for (let i = 0; i < checkpointXs.length; i++) {
      if (seen.has(i)) continue
      const xi = checkpointXs[i]
      if (xi < segMinX || xi > segMaxX) continue

      const t = bisectBezierT(a.domainX, c1x, c2x, b.domainX, xi)
      const y = bezierEval(a.domainY, c1y, c2y, b.domainY, t)
      const yClamped = Math.max(yMin, Math.min(yMax, y))
      out.push({ index: i, y: yClamped })
      seen.add(i)
    }
  }

  return out
}
