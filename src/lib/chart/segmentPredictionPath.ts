import type { PricePoint } from '@/types/market'

export interface PredictionPathSegments {
  elapsed: PricePoint[]
  future: PricePoint[]
}

function interpolatePoint(a: PricePoint, b: PricePoint, time: number): PricePoint {
  const span = b.time - a.time
  if (span <= 0) return { time, value: b.value }

  const t = (time - a.time) / span
  return {
    time,
    value: a.value + (b.value - a.value) * t,
  }
}

/**
 * Splits a fixed market-window forecast around the current live time.
 * The same interpolated junction point is included in both segments so the
 * elapsed and future strokes meet cleanly without changing the raw path.
 */
export function segmentPredictionPathAtTime(
  data: readonly PricePoint[],
  time: number,
): PredictionPathSegments {
  if (data.length === 0) return { elapsed: [], future: [] }

  const first = data[0]
  const last = data[data.length - 1]
  if (time <= first.time) return { elapsed: [], future: [...data] }
  if (time >= last.time) return { elapsed: [...data], future: [] }

  const elapsed: PricePoint[] = []
  const future: PricePoint[] = []

  for (let i = 0; i < data.length; i++) {
    const point = data[i]

    if (point.time < time) {
      elapsed.push(point)
      continue
    }

    if (point.time === time) {
      elapsed.push(point)
      future.push(point, ...data.slice(i + 1))
      return { elapsed, future }
    }

    const prev = data[i - 1]
    const junction = interpolatePoint(prev, point, time)
    elapsed.push(junction)
    future.push(junction, point, ...data.slice(i + 1))
    return { elapsed, future }
  }

  return { elapsed: [...data], future: [] }
}
