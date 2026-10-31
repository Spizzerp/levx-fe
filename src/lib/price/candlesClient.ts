/**
 * The pipeline's candles route, `GET /api/v1/candles`: chart history from the pipeline's cache, filled
 * from the chain it builds paths from (Pyth when it has a key, else Coinbase, then Binance.US).
 */
import { env } from '@/env/env.config'

export type CandleResolution = '1' | '5' | '15' | '60' | 'D'

/** Seconds per bar for each resolution. */
export const RESOLUTION_SECONDS: Record<CandleResolution, number> = {
  '1': 60,
  '5': 5 * 60,
  '15': 15 * 60,
  '60': 60 * 60,
  D: 24 * 60 * 60,
}

export interface CandleRow {
  /** unix seconds, the bar's start */
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface CandlesResponse {
  pair: string
  resolution: CandleResolution
  /** The provider of the series, e.g. "coinbase" */
  source: string
  /** Every provider the series was filled from */
  sources: string[]
  /** The cached range, unix seconds; a request beyond it gets only the overlap */
  window: { from: number; to: number }
  /** unix seconds */
  last_refresh: number
  stale: boolean
  /** Ascending by time */
  rows: CandleRow[]
}

/** A non-OK answer; `code` is the body's `detail.code` (e.g. `candle_cache_warming`) when it has one. */
export class CandlesRequestError extends Error {
  readonly status: number
  readonly code: string | null
  constructor(message: string, status: number, code: string | null) {
    super(message)
    this.name = 'CandlesRequestError'
    this.status = status
    this.code = code
  }
}

function detailCode(text: string): string | null {
  try {
    const code = (JSON.parse(text) as { detail?: { code?: unknown } }).detail?.code
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

/**
 * One range of candles. A plain GET with no custom headers, so the browser sends no CORS preflight:
 * the pipeline's app-wide CORS rejects preflights from origins it doesn't list, while this route
 * answers any origin.
 */
export async function fetchCandles(args: {
  pair: string
  resolution: CandleResolution
  from: number
  to: number
}): Promise<CandlesResponse> {
  const query = new URLSearchParams({
    pair: args.pair,
    resolution: args.resolution,
    from: String(args.from),
    to: String(args.to),
  })
  const url = `${env.APP_API_BASE_URL}/api/v1/candles?${query.toString()}`
  let response: Response

  try {
    response = await fetch(url)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'network error'
    throw new Error(`API request failed before response (${url}): ${detail}`)
  }

  const text = await response.text()

  if (!response.ok) {
    const code = detailCode(text)
    throw new CandlesRequestError(
      `API request failed: ${response.status} ${response.statusText} (${url})${code ? ` - ${code}` : ''}`,
      response.status,
      code,
    )
  }

  try {
    return JSON.parse(text) as CandlesResponse
  } catch {
    throw new Error(`API response was not JSON (${url})`)
  }
}

/**
 * The one-minute candle starting at `minuteStartSec`, or null on any failure: the free feed's
 * Coinbase price at a Pyth publish time its trade buffer doesn't reach. A series with any Pyth
 * rows answers null, since Pyth's price measured against itself would give a level of 1.
 */
export async function fetchPipelineMinuteCandle(
  pair: string,
  minuteStartSec: number,
): Promise<{ time: number; open: number; close: number } | null> {
  try {
    const { rows, sources } = await fetchCandles({
      pair,
      resolution: '1',
      from: minuteStartSec,
      to: minuteStartSec + 60,
    })
    if (sources.includes('pyth')) return null
    const row = rows.find((r) => r.time === minuteStartSec)
    return row ? { time: row.time, open: row.open, close: row.close } : null
  } catch {
    return null
  }
}
