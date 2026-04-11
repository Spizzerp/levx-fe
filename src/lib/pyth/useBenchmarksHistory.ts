import { useQuery } from '@tanstack/react-query'
import { fetchHistoricalPrices, resolutionForCheckpointInterval } from './benchmarksClient'
import type { BenchmarksResolution } from './benchmarksClient'
import type { PricePoint } from '@/types/market'

export type TimeRange = '1h' | '1d' | '1w' | '1m'

const RANGE_SECONDS: Record<TimeRange, number> = {
  '1h': 60 * 60,
  '1d': 24 * 60 * 60,
  '1w': 7 * 24 * 60 * 60,
  '1m': 30 * 24 * 60 * 60,
}

export interface UseBenchmarksHistoryArgs {
  feedId: string | null
  range: TimeRange
  checkpointIntervalSec: number
  /** unix seconds — defaults to Date.now() / 1000. Accepts override for tests. */
  toTime?: number
}

export function useBenchmarksHistory({
  feedId,
  range,
  checkpointIntervalSec,
  toTime,
}: UseBenchmarksHistoryArgs) {
  const resolution: BenchmarksResolution = resolutionForCheckpointInterval(checkpointIntervalSec)
  return useQuery<PricePoint[]>({
    queryKey: ['benchmarks', feedId, range, resolution, toTime ?? null],
    enabled: feedId != null,
    queryFn: async () => {
      const to = toTime ?? Math.floor(Date.now() / 1000)
      const from = to - RANGE_SECONDS[range]
      return fetchHistoricalPrices({ feedId: feedId!, from, to, resolution })
    },
    staleTime: 30_000,
  })
}
