import { bisector } from 'd3-array'
import type { PricePoint, PredictionPath } from '@/types/market'

const bisectTime = bisector<PricePoint, number>((d) => d.time).left

/**
 * Compute the price domain [min, max] for data visible within a time window.
 *
 * Uses binary search on sorted history and iterates prediction paths to find
 * the envelope of visible values, then applies padding (default 0.9× low, 1.05× high).
 *
 * Falls back to `fallback` (or [0, 1]) when no data points fall in the window.
 */
export function computeVisiblePriceDomain(
  history: PricePoint[],
  predictions: PredictionPath[],
  viewportTime: [number, number],
  fallback?: [number, number],
): [number, number] {
  const [tMin, tMax] = viewportTime
  let lo = Infinity
  let hi = -Infinity

  // Binary search the sorted history for the visible slice.
  if (history.length > 0) {
    const startIdx = Math.max(0, bisectTime(history, tMin, 0) - 1)
    const endIdx = Math.min(history.length, bisectTime(history, tMax, startIdx) + 1)
    for (let i = startIdx; i < endIdx; i++) {
      const v = history[i].value
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }

  // Iterate prediction paths — typically short arrays, linear scan is fine.
  for (const path of predictions) {
    for (const pt of path.data) {
      if (pt.time >= tMin && pt.time <= tMax) {
        if (pt.value < lo) lo = pt.value
        if (pt.value > hi) hi = pt.value
      }
    }
  }

  if (!isFinite(lo) || !isFinite(hi)) {
    return fallback ?? [0, 1]
  }

  return [lo * 0.9, hi * 1.05]
}
