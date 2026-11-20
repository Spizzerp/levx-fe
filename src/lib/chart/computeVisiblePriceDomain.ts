import { bisector } from 'd3-array'
import type { PricePoint } from '@/types/market'

const bisectTime = bisector<PricePoint, number>((d) => d.time).left

/** Padding below and above the visible data, as a share of its spread (high minus low). */
export const PRICE_DOMAIN_PAD_BELOW = 0.5
export const PRICE_DOMAIN_PAD_ABOVE = 0.25
/** A flat or nearly flat series is shown as if it spread this share of its price. */
export const MIN_VISIBLE_SPAN_FRACTION = 0.005

/**
 * Compute the price domain [min, max] for data visible within a time window.
 *
 * Uses binary search on sorted history and iterates the path series to find
 * the envelope of visible values, then pads it by a share of its own spread. Padding by a share
 * of the price instead squeezes a narrow forecast fan into a sliver of the chart.
 *
 * `pathSeries` holds each path's points as the chart draws them, so a dissolved path cut at its
 * checkpoint does not widen the range with the tail that is hidden.
 *
 * Falls back to `fallback` (or [0, 1]) when no data points fall in the window.
 */
export function computeVisiblePriceDomain(
  history: PricePoint[],
  pathSeries: PricePoint[][],
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

  // Short arrays, linear scan is fine.
  for (const series of pathSeries) {
    for (const pt of series) {
      if (pt.time >= tMin && pt.time <= tMax) {
        if (pt.value < lo) lo = pt.value
        if (pt.value > hi) hi = pt.value
      }
    }
  }

  if (!isFinite(lo) || !isFinite(hi)) {
    return fallback ?? [0, 1]
  }

  const minSpan = ((lo + hi) / 2) * MIN_VISIBLE_SPAN_FRACTION
  if (hi - lo < minSpan) {
    const mid = (lo + hi) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  const span = hi - lo
  return [lo - span * PRICE_DOMAIN_PAD_BELOW, hi + span * PRICE_DOMAIN_PAD_ABOVE]
}
