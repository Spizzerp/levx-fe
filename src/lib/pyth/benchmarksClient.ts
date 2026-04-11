import type { PricePoint } from '@/types/market'

/** Pyth Benchmarks REST API for historical OHLC/price data.
 *  Endpoint: https://benchmarks.pyth.network/v1/shims/tradingview/history
 *  Params: symbol, resolution, from, to
 *  Source: https://benchmarks.pyth.network/docs
 *
 *  Note: Benchmarks has its own domain (benchmarks.pyth.network), separate from
 *  the Hermes SSE endpoint (hermes.pyth.network). Do NOT conflate them.
 *  The origin is hard-coded for Phase 1; a future phase may add APP_BENCHMARKS_URL.
 */
export type BenchmarksResolution = '1' | '5' | '15' | '60' | '240' | 'D'

export interface FetchHistoricalPricesArgs {
  feedId: string
  /** unix seconds */
  from: number
  /** unix seconds */
  to: number
  resolution: BenchmarksResolution
}

export async function fetchHistoricalPrices(
  args: FetchHistoricalPricesArgs,
): Promise<PricePoint[]> {
  const url = new URL('/v1/shims/tradingview/history', 'https://benchmarks.pyth.network')
  url.searchParams.set('symbol', args.feedId)
  url.searchParams.set('resolution', args.resolution)
  url.searchParams.set('from', String(args.from))
  url.searchParams.set('to', String(args.to))

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Benchmarks REST error ${res.status}`)
  }
  const json = (await res.json()) as { t: number[]; c: number[] }
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
