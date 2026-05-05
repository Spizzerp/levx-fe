import type { PredictionPath, PricePoint } from '@/types/market'

interface ProjectPredictionPathsArgs {
  predictions: PredictionPath[]
  nowTime: number
  marketStart: number
  marketEnd: number
  anchorValue?: number | null
}

function interpolateValueAtTime(data: PricePoint[], time: number): number | null {
  if (data.length === 0) return null

  const first = data[0]
  const last = data[data.length - 1]
  if (time <= first.time) return first.value
  if (time >= last.time) return last.value

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1]
    const next = data[i]
    if (time <= next.time) {
      const span = next.time - prev.time
      if (span <= 0) return next.value
      const t = (time - prev.time) / span
      return prev.value + (next.value - prev.value) * t
    }
  }

  return last.value
}

/**
 * Active markets can drift far away from paths that were generated at market
 * creation. For chart display, preserve each path's remaining percentage shape
 * but anchor it to the latest visible price. Raw path data stays untouched for
 * protocol/scoring use.
 */
export function projectPredictionPathsForChart({
  predictions,
  nowTime,
  marketStart,
  marketEnd,
  anchorValue,
}: ProjectPredictionPathsArgs): PredictionPath[] {
  const isInProgress = nowTime > marketStart && nowTime < marketEnd
  if (!isInProgress || anchorValue == null || anchorValue <= 0) return predictions

  return predictions.map((path) => {
    const baseline = interpolateValueAtTime(path.data, nowTime)
    if (baseline == null || baseline <= 0) return path

    const scale = anchorValue / baseline
    const futureData = path.data
      .filter((point) => point.time > nowTime)
      .map((point) => ({
        time: point.time,
        value: point.value * scale,
      }))

    return {
      ...path,
      data: [
        {
          time: nowTime,
          value: anchorValue,
        },
        ...futureData,
      ],
    }
  })
}
