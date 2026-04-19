import type { PricePoint } from '@/types/market'

/** Pyth Benchmarks REST API for historical OHLC/price data.
 *  Endpoint: https://benchmarks.pyth.network/v1/shims/tradingview/history
 *  Params: symbol, resolution, from, to
 *  Source: https://benchmarks.pyth.network/docs
 *
 *  Note: Benchmarks has its own domain (benchmarks.pyth.network), separate from
 *  the Hermes SSE endpoint (hermes.pyth.network). Do NOT conflate them.
 *  The origin is hard-coded for Phase 1; a future phase may add APP_BENCHMARKS_URL.
 *
 *  IMPORTANT: the `symbol` param must be a TradingView-style symbol string like
 *  "Crypto.BTC/USD", NOT a hex Hermes feed ID. Use benchmarkSymbolForPair() from
 *  feedIds.ts to resolve a pair to its Benchmarks symbol.
 */
export type BenchmarksResolution = '1' | '5' | '15' | '60' | '240' | 'D'

export interface FetchHistoricalPricesArgs {
  /** TradingView-shim symbol (e.g. "Crypto.BTC/USD") */
  symbol: string
  /** unix seconds */
  from: number
  /** unix seconds */
  to: number
  resolution: BenchmarksResolution
}

interface BenchmarksOkResponse {
  s: 'ok'
  t: number[]
  c: number[]
}

interface BenchmarksErrorResponse {
  s: 'error' | 'no_data'
  errmsg?: string
}

type BenchmarksResponse = BenchmarksOkResponse | BenchmarksErrorResponse

export async function fetchHistoricalPrices(
  args: FetchHistoricalPricesArgs,
): Promise<PricePoint[]> {
  const url = new URL('/v1/shims/tradingview/history', 'https://benchmarks.pyth.network')
  url.searchParams.set('symbol', args.symbol)
  url.searchParams.set('resolution', args.resolution)
  url.searchParams.set('from', String(args.from))
  url.searchParams.set('to', String(args.to))

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Benchmarks REST error ${res.status}`)
  }
  const json = (await res.json()) as BenchmarksResponse
  // The TradingView shim returns HTTP 200 with { s: "error", errmsg } on
  // application-level errors (unknown symbol, bad range, etc.), so we must
  // check the status field rather than relying on res.ok alone.
  if (json.s !== 'ok') {
    if (json.s === 'no_data') return []
    throw new Error(`Benchmarks REST error: ${json.errmsg ?? 'unknown error'}`)
  }
  // TradingView shim returns parallel arrays: t = publishTime seconds, c = close prices
  return json.t.map((t, i) => ({ time: t * 1000, value: json.c[i] }))
}

/** Map market checkpointInterval (seconds) to the nearest Benchmarks resolution. */
export function resolutionForCheckpointInterval(intervalSec: number): BenchmarksResolution {
  if (intervalSec <= 60) return '1'
  if (intervalSec <= 5 * 60) return '5'
  if (intervalSec <= 15 * 60) return '15'
  if (intervalSec <= 60 * 60) return '60'
  if (intervalSec <= 4 * 60 * 60) return '240'
  return 'D'
}

/** Seconds-per-bar for each Benchmarks resolution. Used to compute page spans for pagination. */
export const RESOLUTION_SECONDS: Record<BenchmarksResolution, number> = {
  '1': 60,
  '5': 5 * 60,
  '15': 15 * 60,
  '60': 60 * 60,
  '240': 4 * 60 * 60,
  D: 24 * 60 * 60,
}
