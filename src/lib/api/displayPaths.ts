/**
 * The pipeline's display record, `GET /api/v1/markets/{id}/display-paths`: each AI path at the
 * model's native resolution, for drawing only. A record path is attached to a chain path only when
 * every one of its checkpoint values equals the chain's predicted price exactly, so the chart never
 * draws a line through a checkpoint the market does not score.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { env } from '@/env/env.config'
import { SCALE } from '@/lib/constants'
import type { PredictionPath } from '@/types/market'

export interface DisplayPathsRecord {
  schema: 'display-paths-v1'
  market_id: number
  /** ISO-8601 */
  generated_at: string
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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isFiniteArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(isFiniteNumber)

/** The market a record is checked against; `checkpointInterval` in seconds, as on chain. */
export interface DisplayPathsMarket {
  startTimeMs: number
  checkpointInterval: number
  totalCheckpoints: number
}

/** Why a record or path was not attached; printed in dev builds only. */
function logRefusal(reason: string): void {
  if (import.meta.env.DEV) console.debug('[display-paths] not attached:', reason)
}

/**
 * A record is drawn from only if its shape holds together and its time axis is the market's: the
 * same start, interval and checkpoint count, a strictly increasing grid, and every checkpoint grid
 * point at exactly the checkpoint's time. Otherwise none of it is. The body comes from the network,
 * so every field is checked rather than trusted to match the type. Returns why the record is
 * refused, or null when it holds.
 */
function refusalReason(record: DisplayPathsRecord, market: DisplayPathsMarket): string | null {
  const {
    times,
    checkpoint_indices: indices,
    paths,
  } = record as unknown as Partial<Record<'times' | 'checkpoint_indices' | 'paths', unknown>>
  if (record.schema !== 'display-paths-v1') return 'schema is not display-paths-v1'
  if (record.start_time * 1000 !== market.startTimeMs) return 'start_time differs from the market'
  if (record.checkpoint_interval !== market.checkpointInterval) {
    return 'checkpoint_interval differs from the market'
  }
  if (record.total_checkpoints !== market.totalCheckpoints) {
    return 'total_checkpoints differs from the market'
  }
  if (!isFiniteArray(times) || times.length === 0) return 'times is not a non-empty number array'
  if (!times.every((t, i) => i === 0 || t > times[i - 1])) return 'times is not strictly increasing'
  if (!isFiniteArray(indices) || indices.length !== market.totalCheckpoints) {
    return 'checkpoint_indices is not one number per checkpoint'
  }
  if (!indices.every((i) => Number.isInteger(i) && i >= 0 && i < times.length)) {
    return 'checkpoint_indices out of range'
  }
  const checkpointMs = market.checkpointInterval * 1000
  if (!indices.every((i, j) => times[i] * 1000 === market.startTimeMs + j * checkpointMs)) {
    return 'a checkpoint grid point is not at its checkpoint time'
  }
  if (!Array.isArray(paths)) return 'paths is not an array'
  const pathsHold = paths.every(
    (p: unknown) =>
      typeof p === 'object' &&
      p !== null &&
      isFiniteNumber((p as { path_index?: unknown }).path_index) &&
      isFiniteArray((p as { prices_u64?: unknown }).prices_u64) &&
      (p as { prices_u64: number[] }).prices_u64.length === times.length,
  )
  if (!pathsHold) return 'a path is malformed or its prices_u64 length differs from times'
  if (new Set(record.paths.map((p) => p.path_index)).size !== paths.length) {
    return 'a path_index appears twice'
  }
  return null
}

/**
 * Each chain path with the record's dense series as `displayData`, when the record has a path of the
 * same `path_index` whose value at every checkpoint the chain holds equals the chain's, to the unit.
 * Grid points before the market start or past the last checkpoint are dropped. Paths that fail the rule are returned as they were,
 * and a record whose shape or time axis is not the market's (see `isConsistent`) attaches to none.
 */
export function attachDisplayData(
  paths: readonly PredictionPath[],
  record: DisplayPathsRecord | null,
  market: DisplayPathsMarket,
): PredictionPath[] {
  if (!record) return [...paths]
  const refusal = refusalReason(record, market)
  if (refusal) {
    logRefusal(refusal)
    return [...paths]
  }
  const endMs =
    market.startTimeMs + (market.totalCheckpoints - 1) * market.checkpointInterval * 1000
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
        logRefusal(`path ${path.pathIndex}: price at checkpoint ${j} differs from the chain`)
        return path
      }
    }
    const displayData = record.times
      .map((t, i) => ({ time: t * 1000, value: prices[i] / SCALE }))
      .filter((p) => p.time >= market.startTimeMs && p.time <= endMs)
    return { ...path, displayData }
  })
}

/** How often to ask again while the pipeline has no record yet. */
const DISPLAY_PATHS_POLL_MS = 15_000

/**
 * The record is written moments after the market's last `PathAdded`, so the event-driven refetch can
 * miss it (404). Poll while there is none (`null`), and stop once one exists.
 */
export function displayPathsRefetchInterval(query: {
  state: { data: DisplayPathsRecord | null | undefined }
}): number | false {
  return query.state.data === null ? DISPLAY_PATHS_POLL_MS : false
}

/** Mock markets (APP_USE_MOCK) and builds without a pipeline URL have no record, so nothing is fetched. */
export function isDisplayPathsEnabled({
  enabled,
  marketId,
  baseUrl,
  useMock,
}: {
  enabled: boolean
  marketId: number | null
  baseUrl: string
  useMock: boolean
}): boolean {
  return enabled && marketId !== null && baseUrl !== '' && !useMock
}

/**
 * Fetched only when `isDisplayPathsEnabled`.
 * Records are written before a market starts, so polling for a missing one runs only while `pollWhile`
 * (the market is pending).
 */
export function displayPathsQueryOptions(
  marketId: number | null,
  enabled: boolean,
  pollWhile: boolean,
) {
  return queryOptions({
    queryKey: ['display-paths', marketId],
    queryFn: () => fetchDisplayPaths(marketId!),
    enabled: isDisplayPathsEnabled({
      enabled,
      marketId,
      baseUrl: env.APP_API_BASE_URL,
      useMock: import.meta.env.APP_USE_MOCK === 'true',
    }),
    staleTime: 60_000,
    refetchInterval: pollWhile ? displayPathsRefetchInterval : false,
  })
}

export function useDisplayPaths(
  marketId: number | null,
  enabled: boolean,
  pollWhile: boolean,
): DisplayPathsRecord | null {
  const { data } = useQuery(displayPathsQueryOptions(marketId, enabled, pollWhile))
  return data ?? null
}
