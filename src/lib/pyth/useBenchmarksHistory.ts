import { useQuery } from '@tanstack/react-query'
import { fetchHistoricalPrices } from './benchmarksClient'
import type { BenchmarksResolution } from './benchmarksClient'
import { benchmarkSymbolForPair } from './feedIds'
import type { PricePoint } from '@/types/market'
import type { CandleInterval } from '@/components/TimeRangePicker'

/** Map each candle interval to its Benchmarks resolution string. */
const INTERVAL_TO_RESOLUTION: Record<CandleInterval, BenchmarksResolution> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1d': 'D',
}

/** Map each candle interval to a sensible lookback window (seconds). */
const INTERVAL_TO_LOOKBACK: Record<CandleInterval, number> = {
  '1m': 6 * 60 * 60, // 6 hours → ~360 candles
  '5m': 24 * 60 * 60, // 1 day → ~288 candles
  '15m': 3 * 24 * 60 * 60, // 3 days → ~288 candles
  '1h': 30 * 24 * 60 * 60, // 30 days → ~720 candles
  '1d': 365 * 24 * 60 * 60, // 1 year → ~365 candles
}

export interface UseBenchmarksHistoryArgs {
  /** Market pair, e.g. "BTC/USDC". Resolved to a Benchmarks symbol internally. */
  pair: string | null
  /** Candle interval — determines both resolution and lookback window. */
  interval: CandleInterval
  /** unix seconds — defaults to Date.now() / 1000. Accepts override for tests. */
  toTime?: number
}

export function useBenchmarksHistory({
  pair,
  interval,
  toTime,
}: UseBenchmarksHistoryArgs) {
  const resolution = INTERVAL_TO_RESOLUTION[interval]
  const lookback = INTERVAL_TO_LOOKBACK[interval]
  const symbol = pair ? benchmarkSymbolForPair(pair) : null
  return useQuery<PricePoint[]>({
    queryKey: ['benchmarks', symbol, interval, toTime ?? null],
    enabled: symbol != null,
    queryFn: async () => {
      const to = toTime ?? Math.floor(Date.now() / 1000)
      const from = to - lookback
      return fetchHistoricalPrices({ symbol: symbol!, from, to, resolution })
    },
    staleTime: 30_000,
  })
}
