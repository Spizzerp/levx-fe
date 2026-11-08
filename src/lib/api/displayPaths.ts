/**
 * The pipeline's display record, `GET /api/v1/markets/{id}/display-paths`: each AI path at the
 * model's native resolution, for drawing only. A record path is attached to a chain path only when
 * every one of its checkpoint values equals the chain's predicted price exactly, so the chart never
 * draws a line through a checkpoint the market does not score.
 */
import { useQuery } from '@tanstack/react-query'

import { env } from '@/env/env.config'
import { SCALE } from '@/lib/constants'
import type { PredictionPath } from '@/types/market'

export interface DisplayPathsRecord {
  schema: 'display-paths-v1'
  market_id: number
  /** unix seconds */
  generated_at: number
  /** unix seconds */
  start_time: number
  /** seconds */
  checkpoint_interval: number
  total_checkpoints: number
  model_step_seconds: number
  /** unix seconds, one per grid point */
  times: number[]
  /** Grid index of each checkpoint, in checkpoint order */
  checkpoint_indices: number[]
  /** `prices_u64`: one per grid point, u64 with 6 decimals */
  paths: { path_index: number; prices_u64: number[] }[]
}

/** A non-OK answer other than 404. */
export class DisplayPathsRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'DisplayPathsRequestError'
    this.status = status
  }
}

/** The market's display record, or null when the pipeline has none (404). A plain GET, so no CORS preflight. */
export async function fetchDisplayPaths(marketId: number): Promise<DisplayPathsRecord | null> {
  const url = `${env.APP_API_BASE_URL}/api/v1/markets/${marketId}/display-paths`
  let response: Response

  try {
    response = await fetch(url)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'network error'
    throw new Error(`API request failed before response (${url}): ${detail}`)
  }

  if (response.status === 404) return null

  const text = await response.text()

  if (!response.ok) {
    throw new DisplayPathsRequestError(
      `API request failed: ${response.status} ${response.statusText} (${url})`,
      response.status,
    )
  }

  try {
    return JSON.parse(text) as DisplayPathsRecord
  } catch {
    throw new Error(`API response was not JSON (${url})`)
  }
}

/** A record is drawn from only if its shape holds together; otherwise none of it is. */
function isConsistent(record: DisplayPathsRecord): boolean {
  const gridLength = record.times.length
  const indexes = new Set(record.paths.map((p) => p.path_index))
  return (
    record.schema === 'display-paths-v1' &&
    gridLength > 0 &&
    record.checkpoint_indices.length === record.total_checkpoints &&
    record.checkpoint_indices.every((i) => Number.isInteger(i) && i >= 0 && i < gridLength) &&
    record.paths.every((p) => p.prices_u64.length === gridLength) &&
    indexes.size === record.paths.length
  )
}

/**
 * Each chain path with the record's dense series as `displayData`, when the record has a path of the
 * same `path_index` whose value at every checkpoint the chain holds equals the chain's, to the unit.
 * Grid points before the market start are dropped. Paths that fail the rule are returned as they were.
 */
export function attachDisplayData(
  paths: readonly PredictionPath[],
  record: DisplayPathsRecord | null,
  startTimeMs: number,
): PredictionPath[] {
  if (!record || !isConsistent(record)) return [...paths]
  const byIndex = new Map(record.paths.map((p) => [p.path_index, p.prices_u64]))

  return paths.map((path) => {
    const prices = byIndex.get(path.pathIndex)
    if (!prices) return path
    for (let j = 0; j < path.numCheckpoints; j++) {
      const gridIndex = record.checkpoint_indices[j]
      if (
        gridIndex === undefined ||
        prices[gridIndex] !== Math.round(path.predictedPrices[j] * SCALE)
      ) {
        return path
      }
    }
    const displayData = record.times
      .map((t, i) => ({ time: t * 1000, value: prices[i] / SCALE }))
      .filter((p) => p.time >= startTimeMs)
    return { ...path, displayData }
  })
}

/** Mock markets (APP_USE_MOCK) and builds without a pipeline URL have no record, so nothing is fetched. */
export function useDisplayPaths(
  marketId: number | null,
  enabled: boolean,
): DisplayPathsRecord | null {
  const { data } = useQuery({
    queryKey: ['display-paths', marketId],
    queryFn: () => fetchDisplayPaths(marketId!),
    enabled:
      enabled &&
      marketId !== null &&
      env.APP_API_BASE_URL !== '' &&
      import.meta.env.APP_USE_MOCK !== 'true',
    staleTime: 60_000,
  })
  return data ?? null
}
