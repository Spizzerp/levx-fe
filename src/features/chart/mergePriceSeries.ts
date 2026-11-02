import type { PriceTick } from '@/lib/price'
import type { PricePoint } from '@/types/market'

/**
 * Two trail points further apart than this (a background tab whose timers the browser
 * throttled) let the candles between them back into the line.
 */
export const TRAIL_GAP_MS = 90_000

/**
 * The price line: the candle history before the first trail tick, then the once-a-second trail
 * and the latest tick, so a history reload never smooths over the seconds the page recorded.
 * The candles strictly inside a trail gap longer than `maxTrailGapMs` fill that gap. Each point
 * is strictly newer than the one before it.
 */
export function mergePriceSeries(
  history: readonly PricePoint[],
  trail: readonly PriceTick[],
  latestTick: PriceTick | null,
  maxTrailGapMs: number,
): PricePoint[] {
  const live = latestTick ? [...trail, latestTick] : trail
  const merged: PricePoint[] = []
  let lastTime = -Infinity
  let next = 0
  /** Adds the candles older than `time` that are newer than the last point. */
  const addCandlesBefore = (time: number) => {
    for (; next < history.length && history[next].time < time; next++) {
      const candle = history[next]
      if (candle.time <= lastTime) continue
      merged.push(candle)
      lastTime = candle.time
    }
  }

  addCandlesBefore(live[0]?.time ?? Infinity)
  for (const tick of live) {
    if (tick.time - lastTime > maxTrailGapMs) addCandlesBefore(tick.time)
    if (tick.time <= lastTime) continue
    merged.push({ time: tick.time, value: tick.value })
    lastTime = tick.time
  }
  return merged
}
