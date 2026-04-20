import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchHistoricalPrices, RESOLUTION_SECONDS } from './benchmarksClient'
import type { BenchmarksResolution } from './benchmarksClient'
import { benchmarkSymbolForPair } from './feedIds'
import type { PricePoint } from '@/types/market'
import type { CandleInterval } from '@/features/chart/TimeRangePicker'

/** Map each candle interval to its Benchmarks resolution string. */
const INTERVAL_TO_RESOLUTION: Record<CandleInterval, BenchmarksResolution> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1d': 'D',
}

/**
 * Bars per page, per resolution.
 *
 * Pyth Benchmarks has per-request limits we have to respect:
 *   - D  → hard cap of 365 days per request ("Requested range exceeds 1 year")
 *   - 1m → caps around ~48h span ("Too many datapoints to return")
 * 500 works for everything except D, which we pull back to 300 days (safely
 * under the 1-year limit). Paginating backwards still covers multi-year ranges.
 */
const BARS_PER_PAGE: Record<BenchmarksResolution, number> = {
  '1': 500, // 500 min ≈ 8h
  '5': 500, // 500 × 5m ≈ 41h
  '15': 500, // 500 × 15m ≈ 125h
  '60': 500, // 500 × 1h ≈ 20d
  '240': 500, // 500 × 4h ≈ 83d
  D: 300, // 300 days (cap 365)
}

export interface UseBenchmarksHistoryArgs {
  /** Market pair, e.g. "BTC/USDC". Resolved to a Benchmarks symbol internally. */
  pair: string | null
  /** Candle interval — determines both resolution and page span. */
  interval: CandleInterval
  /** unix seconds — overrides "now" for the initial page anchor (tests only). */
  toTime?: number
}

export interface UseBenchmarksHistoryResult {
  /** Flat, ascending-time merged history across all loaded pages. */
  data: PricePoint[] | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
  fetchStatus: 'fetching' | 'paused' | 'idle'
  /** True while an older-page fetch is in flight. */
  isFetchingOlder: boolean
  /** False once the feed's depth is exhausted (last page came back empty). */
  hasMoreHistory: boolean
  /** Trigger fetch of the next older page. Safe to call repeatedly; react-query dedupes. */
  fetchOlder: () => void
}

/**
 * Lazily load historical price data from Pyth Benchmarks, paginating backwards in time.
 *
 * Pagination model:
 *  - Pages are anchored by their `to` timestamp (unix seconds).
 *  - Initial page fetches [now - pageSpan, now].
 *  - Each subsequent page fetches [oldestLoaded - pageSpan - 1s, oldestLoaded - 1s].
 *  - An empty page signals depth exhaustion and pins hasMoreHistory=false.
 *
 * Live ticks are NOT merged here — callers continue to splice the latest Pyth tick
 * onto the tail in the chart layer (see LevXChart.mergedHistory).
 */
export function useBenchmarksHistory({
  pair,
  interval,
  toTime,
}: UseBenchmarksHistoryArgs): UseBenchmarksHistoryResult {
  const resolution = INTERVAL_TO_RESOLUTION[interval]
  const pageSpanSec = BARS_PER_PAGE[resolution] * RESOLUTION_SECONDS[resolution]
  const symbol = pair ? benchmarkSymbolForPair(pair) : null

  // Snapshot "now" once per mount so initialPageParam is pure across re-renders.
  // react-query rejects a functional initialPageParam, so lazy-init via useState.
  const [initialAnchor] = useState(() => toTime ?? Math.floor(Date.now() / 1000))

  const query = useInfiniteQuery<
    PricePoint[],
    Error,
    PricePoint[][], // TData (raw pages — we flatten in a useMemo, not in select,
                    //         so the flattened array retains referential stability
                    //         across live-tick re-renders)
    readonly unknown[],
    number
  >({
    queryKey: ['benchmarks-history', symbol, interval],
    enabled: symbol != null,
    initialPageParam: initialAnchor,
    queryFn: async ({ pageParam }) => {
      return fetchHistoricalPrices({
        symbol: symbol!,
        to: pageParam,
        from: pageParam - pageSpanSec,
        resolution,
      })
    },
    getNextPageParam: (lastPage) => {
      // Empty page → depth exhausted
      if (lastPage.length === 0) return undefined
      // PricePoint.time is unix ms; step one second before oldest bar to avoid overlap
      const oldestSec = Math.floor(lastPage[0].time / 1000)
      return oldestSec - 1
    },
    staleTime: 30_000,
    select: (data) => data.pages,
  })

  // Flatten + sort across pages. react-query returns pages in fetch order
  // (newest-first), so we sort by time to get ascending history.
  const flat = useMemo<PricePoint[] | undefined>(() => {
    if (!query.data) return undefined
    const merged = query.data.flat().sort((a, b) => a.time - b.time)
    // Dedupe by time (page boundaries may overlap by one bar)
    const deduped: PricePoint[] = []
    for (const p of merged) {
      if (deduped.length === 0 || deduped[deduped.length - 1].time !== p.time) {
        deduped.push(p)
      }
    }
    return deduped
  }, [query.data])

  const fetchOlder = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
  }, [query])

  return {
    data: flat,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
    fetchStatus: query.fetchStatus,
    isFetchingOlder: query.isFetchingNextPage,
    hasMoreHistory: query.hasNextPage ?? true,
    fetchOlder,
  }
}

/**
 * Returns a setter to wire into <LevXChart onViewportChange={...}/>.
 *
 * Internally it stores the latest viewport and runs an effect that re-evaluates
 * on every viewport change AND on every history growth. This is important:
 * a fast zoom-out opens a range that may require many pages to cover. A single
 * fetchOlder call only loads ONE page, so we must re-fire once that page lands.
 * By depending on `history` in the effect, the cascade runs automatically until
 * either the visible range is covered or the feed's depth is exhausted.
 */
export function useLazyHistoryTrigger({
  history,
  hasMoreHistory,
  isFetchingOlder,
  fetchOlder,
}: {
  history: PricePoint[] | undefined
  hasMoreHistory: boolean
  isFetchingOlder: boolean
  fetchOlder: () => void
}): (domain: [number, number]) => void {
  const [viewport, setViewport] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!viewport) return
    if (!history || history.length === 0) return
    if (!hasMoreHistory || isFetchingOlder) return
    const [leftEdgeMs, rightEdgeMs] = viewport
    const oldestMs = history[0].time
    const visibleSpan = rightEdgeMs - leftEdgeMs
    // Fetch while the loaded range does not cover the visible span (plus a
    // 20% prefetch buffer to the left). This condition catches both:
    //   - left edge already past oldest loaded bar (urgent, filling a gap)
    //   - left edge inside loaded range but near its left boundary (prefetch)
    if (leftEdgeMs - oldestMs < visibleSpan * 0.2) fetchOlder()
  }, [viewport, history, hasMoreHistory, isFetchingOlder, fetchOlder])

  return setViewport
}
