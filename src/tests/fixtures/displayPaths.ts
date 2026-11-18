/** Test fixture for the pipeline's display-paths record, derived from `buildAiPathFixture` paths. */
import type { DisplayPathsRecord } from '@/lib/api/displayPaths'
import { SCALE } from '@/lib/constants'
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'
import type { PredictionPath } from '@/types/market'

/** A 6 × 600 s market; pass to `buildAiPathFixture` for the matching chain paths. */
export const DISPLAY_FIXTURE_MARKET = {
  startTime: 1_700_000_000_000, // unix ms
  checkpointInterval: 600,
  totalCheckpoints: 6,
  basePrice: 150,
} as const

export const DISPLAY_FIXTURE_MODEL_STEP_SECONDS = 300

/** The fixture market as `attachDisplayData` takes it. */
export const DISPLAY_FIXTURE_ATTACH_MARKET = {
  startTimeMs: DISPLAY_FIXTURE_MARKET.startTime,
  checkpointInterval: DISPLAY_FIXTURE_MARKET.checkpointInterval,
  totalCheckpoints: DISPLAY_FIXTURE_MARKET.totalCheckpoints,
} as const

/** `buildAiPathFixture` paths for the fixture market, with prices at the chain's 6 decimals (u64 / SCALE). */
export function buildDisplayFixturePaths(): PredictionPath[] {
  const quantize = (price: number) => Math.round(price * SCALE) / SCALE
  return buildAiPathFixture(DISPLAY_FIXTURE_MARKET).map((path) => ({
    ...path,
    data: path.data.map((p) => ({ ...p, value: quantize(p.value) })),
    predictedPrices: path.predictedPrices.map(quantize),
  }))
}

/**
 * A record whose checkpoint values equal `paths`' predicted prices: 300 s model steps give 11 grid
 * points, checkpoints at `[0, 2, 4, 6, 8, 10]`, and each point between two checkpoints their midpoint.
 */
export function buildDisplayPathsRecord(
  paths: readonly PredictionPath[],
  marketId = 1,
): DisplayPathsRecord {
  const { startTime, checkpointInterval, totalCheckpoints } = DISPLAY_FIXTURE_MARKET
  const startSec = startTime / 1000
  const stepsPerCheckpoint = checkpointInterval / DISPLAY_FIXTURE_MODEL_STEP_SECONDS
  const gridLength = (totalCheckpoints - 1) * stepsPerCheckpoint + 1
  const times = Array.from(
    { length: gridLength },
    (_, i) => startSec + i * DISPLAY_FIXTURE_MODEL_STEP_SECONDS,
  )
  const checkpointIndices = Array.from(
    { length: totalCheckpoints },
    (_, j) => j * stepsPerCheckpoint,
  )

  return {
    schema: 'display-paths-v1',
    market_id: marketId,
    generated_at: new Date((startSec - 60) * 1000).toISOString(),
    start_time: startSec,
    checkpoint_interval: checkpointInterval,
    total_checkpoints: totalCheckpoints,
    model_step_seconds: DISPLAY_FIXTURE_MODEL_STEP_SECONDS,
    times,
    checkpoint_indices: checkpointIndices,
    paths: paths.map((path) => {
      const checkpoints = path.predictedPrices.map((price) => Math.round(price * SCALE))
      return {
        path_index: path.pathIndex,
        prices_u64: times.map((_, i) => {
          const j = Math.floor(i / stepsPerCheckpoint)
          if (i % stepsPerCheckpoint === 0) return checkpoints[j]
          return Math.round((checkpoints[j] + checkpoints[j + 1]) / 2)
        }),
      }
    }),
  }
}

/**
 * `record` with a `simulated_fill` every `stepSeconds`: every stored value kept at its anchor, and
 * each simulated point the straight-line value between its stored neighbours plus 500 units, so a
 * test can tell the two apart. The fill starts after the record's origin when it has one.
 */
export function withSimulatedFill(
  record: DisplayPathsRecord,
  stepSeconds = 60,
): DisplayPathsRecord {
  const knots = record.origin ? [record.origin.time, ...record.times] : [...record.times]
  const times: number[] = record.origin ? [] : [record.times[0]]
  const anchorIndices: number[] = record.origin ? [] : [0]
  for (let i = 1; i < knots.length; i++) {
    for (let t = knots[i - 1] + stepSeconds; t <= knots[i]; t += stepSeconds) times.push(t)
    anchorIndices.push(times.length - 1)
  }
  const paths = record.paths.map((path) => {
    const stored = record.origin ? [record.origin.price_u64, ...path.prices_u64] : path.prices_u64
    const prices = times.map((t) => {
      const i = knots.findIndex((knot) => knot >= t)
      if (knots[i] === t) return stored[i]
      const share = (t - knots[i - 1]) / (knots[i] - knots[i - 1])
      return Math.round(stored[i - 1] + share * (stored[i] - stored[i - 1])) + 500
    })
    return { path_index: path.path_index, prices_u64: prices }
  })
  return {
    ...record,
    simulated_fill: {
      simulated: true,
      method: 'brownian-bridge-v1',
      step_seconds: stepSeconds,
      volatility: 0.6,
      times,
      anchor_indices: anchorIndices,
      paths,
    },
  }
}
