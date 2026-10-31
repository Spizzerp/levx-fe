import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import type { CandleInterval } from '@/features/chart/TimeRangePicker'
import { CandlesRequestError, RESOLUTION_SECONDS, fetchCandles } from '@/lib/price/candlesClient'
import type { CandleResolution, CandlesResponse } from '@/lib/price/candlesClient'
import { useLevel } from '@/lib/price/hooks'
import { priceSource } from '@/lib/price/source'
import { feedIdForPair } from '@/lib/pyth/feedIds'
import type { PricePoint } from '@/types/market'

/** Map each candle interval to the endpoint's resolution. */
const INTERVAL_TO_RESOLUTION: Record<CandleInterval, CandleResolution> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1d': 'D',
}

/** Bars per page; the endpoint allows up to 1000 per request. */
export const BARS_PER_PAGE = 500

/** A cache still backfilling answers 503 candle_cache_warming; it is asked again for two minutes. */
const WARMING_RETRIES = 24
const WARMING_RETRY_DELAY_MS = 5000
/** Any other failure is retried once, as the app's default does, after react-query's first delay. */
const OTHER_RETRIES = 1
const OTHER_RETRY_DELAY_MS = 1000
/** While the newest page is empty (the cache has nothing yet for now), it is asked again this often. */
const EMPTY_POLL_MS = 15_000

const isWarming = (error: Error) =>
  error instanceof CandlesRequestError && error.code === 'candle_cache_warming'

/** Pyth's own history is already on Pyth's level. */
const isPythOnly = (sources: string[]) => sources.length === 1 && sources[0] === 'pyth'

export interface UsePriceHistoryArgs {
  /** Market pair, e.g. "SOL/USDC". A pair with no Pyth feed fetches nothing. */
  pair: string | null
  /** Candle interval — determines both resolution and page span. */
  interval: CandleInterval
  /** unix seconds — overrides "now" for the initial page anchor (tests only). */
  toTime?: number
}

export interface UsePriceHistoryResult {
  /** Flat, ascending-time merged history across all loaded pages. */
  data: PricePoint[] | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  isSuccess: boolean
  fetchStatus: 'fetching' | 'paused' | 'idle'
  /** True while an older-page fetch is in flight. */
  isFetchingOlder: boolean
  /** False once the history is exhausted: an empty page, or the cache's window reached. */
  hasMoreHistory: boolean
  /** Trigger fetch of the next older page. Safe to call repeatedly; react-query dedupes. */
  fetchOlder: () => void
}

/**
 * Lazily load historical prices from the pipeline's candles endpoint, paginating backwards in time.
 *
 * Pagination model:
 *  - Pages are anchored by their `to` timestamp (unix seconds) and span BARS_PER_PAGE bars.
 *  - Initial page fetches [now - pageSpan, now]; each older page ends one second before the
 *    previous page's `from`.
 *  - An empty page, or a cache window that starts after the requested `from`, ends the paging.
 *
 * In the free mode the history is multiplied by the feed's current level, so it joins the leveled
 * live line without a step; history the endpoint took from Pyth alone is already on that level.
 *
 * Live ticks are NOT merged here — callers splice the latest tick onto the tail in the chart layer
 * (see LevXChart.mergedHistory).
 */
export function usePriceHistory({
  pair,
  interval,
  toTime,
}: UsePriceHistoryArgs): UsePriceHistoryResult {
  const resolution = INTERVAL_TO_RESOLUTION[interval]
  const pageSpanSec = BARS_PER_PAGE * RESOLUTION_SECONDS[resolution]
  const feedId = pair ? feedIdForPair(pair) : null
  const level = useLevel(feedId)
  const shift = priceSource() === 'free' ? level : null

  // Snapshot "now" once per mount so initialPageParam is pure across re-renders.
  // react-query rejects a functional initialPageParam, so lazy-init via useState.
  const [initialAnchor] = useState(() => toTime ?? Math.floor(Date.now() / 1000))

  // TData is the raw pages: they are mapped and shifted in a useMemo, not in select, so the
  // flattened array keeps its reference across live-tick re-renders.
  const query = useInfiniteQuery<
    CandlesResponse,
    Error,
    CandlesResponse[],
    readonly unknown[],
    number
  >({
    queryKey: ['price-history', pair, interval],
    enabled: feedId != null,
    initialPageParam: initialAnchor,
    queryFn: ({ pageParam }) =>
      fetchCandles({ pair: pair!, resolution, from: pageParam - pageSpanSec, to: pageParam }),
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const from = lastPageParam - pageSpanSec
      // Empty → depth exhausted; a window starting after `from` → the cache holds nothing older
      if (lastPage.rows.length === 0 || lastPage.window.from > from) return undefined
      return from - 1
    },
    retry: (failureCount, error) =>
      failureCount < (isWarming(error) ? WARMING_RETRIES : OTHER_RETRIES),
    retryDelay: (_failureCount, error) =>
      isWarming(error) ? WARMING_RETRY_DELAY_MS : OTHER_RETRY_DELAY_MS,
    // An empty newest page ends paging, so poll until the cache has rows for it; an empty older
    // page is the end of the history and polls nothing.
    refetchInterval: (q) => (q.state.data?.pages[0]?.rows.length === 0 ? EMPTY_POLL_MS : false),
    staleTime: 30_000,
    select: (data) => data.pages,
  })

  // Map, shift, flatten + sort across pages. react-query returns pages in fetch order
  // (newest-first), so we sort by time to get ascending history.
  const flat = useMemo<PricePoint[] | undefined>(() => {
    if (!query.data) return undefined
    const merged = query.data
      .flatMap((page) => {
        const k = shift !== null && !isPythOnly(page.sources) ? shift : 1
        return page.rows.map((row) => ({ time: row.time * 1000, value: row.close * k }))
      })
      .sort((a, b) => a.time - b.time)
    // Dedupe by time (page boundaries may overlap by one bar)
    const deduped: PricePoint[] = []
    for (const p of merged) {
      if (deduped.length === 0 || deduped[deduped.length - 1].time !== p.time) {
        deduped.push(p)
      }
    }
    return deduped
  }, [query.data, shift])

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
