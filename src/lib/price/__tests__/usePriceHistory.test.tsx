import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { CandlesRequestError } from '@/lib/price/candlesClient'
import type { CandleRow, CandlesResponse } from '@/lib/price/candlesClient'
import { usePriceHistory } from '@/lib/price/usePriceHistory'
import { PYTH_FEED_IDS } from '@/lib/pyth/feedIds'
import { usePriceStore } from '@/stores/priceStore'

const mockEnv = vi.hoisted(() => ({
  APP_API_BASE_URL: '',
  APP_RPC_URL: 'http://127.0.0.1:9',
  APP_PRICE_SOURCE: 'free',
}))
vi.mock('@/env/env.config', () => ({ env: mockEnv }))

// Only the request is stubbed; RESOLUTION_SECONDS and the error class stay real.
const mockFetchCandles = vi.fn()
vi.mock('@/lib/price/candlesClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/price/candlesClient')>(
    '@/lib/price/candlesClient',
  )
  return {
    ...actual,
    fetchCandles: (...args: Parameters<typeof actual.fetchCandles>) => mockFetchCandles(...args),
  }
})

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

const PAIR = 'SOL/USDC'
const FEED = PYTH_FEED_IDS[PAIR]
/** The initial page's anchor, unix seconds. */
const T = 1_793_452_800
/** 500 five-minute bars, in seconds. */
const SPAN_5M = 500 * 300

/** A bar opening at `open`; its close differs, so a test sees which price is plotted. */
const row = (time: number, open: number): CandleRow => ({
  time,
  open,
  high: open + 0.3,
  low: open - 0.2,
  close: open + 0.1,
})

function candles(rows: CandleRow[], overrides: Partial<CandlesResponse> = {}): CandlesResponse {
  return {
    pair: PAIR,
    resolution: '5',
    source: 'coinbase',
    sources: ['coinbase'],
    window: { from: T - 30 * 86_400, to: T },
    last_refresh: T,
    stale: false,
    rows,
    ...overrides,
  }
}

const warming = () =>
  new CandlesRequestError(
    'API request failed: 503 Service Unavailable - candle_cache_warming',
    503,
    'candle_cache_warming',
  )

/**
 * Runs the fake clock inside act. A 0 ms timeout set while the clock runs (react-query notifies
 * observers through one) lands 1 ms later, so a flush after a fetch advances 1 ms.
 */
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

function render(pair: string | null = PAIR, interval: '5m' | '1h' = '5m') {
  return renderHook(() => usePriceHistory({ pair, interval, toTime: T }), {
    wrapper: makeWrapper(),
  })
}

describe('usePriceHistory', () => {
  beforeEach(() => {
    mockFetchCandles.mockReset()
    mockEnv.APP_PRICE_SOURCE = 'free'
    usePriceStore.setState({ ticks: {}, feeds: {}, levels: {} })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps rows to points in ms', async () => {
    mockFetchCandles.mockResolvedValue(candles([row(T - 600, 95.1), row(T - 300, 95.2)]))

    const { result } = render(PAIR, '1h')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { time: (T - 600) * 1000, value: 95.1 },
      { time: (T - 300) * 1000, value: 95.2 },
    ])
    expect(mockFetchCandles).toHaveBeenCalledWith({
      pair: PAIR,
      resolution: '60',
      from: T - 500 * 3600,
      to: T,
    })
    expect(result.current.hasMoreHistory).toBe(true)
  })

  it("plots each candle's open at its start", async () => {
    // A bar's time is its start: the price at that moment is the open, not the close an hour on.
    mockFetchCandles.mockResolvedValue(
      candles([
        { time: T - 7200, open: 95.0, high: 95.9, low: 94.8, close: 95.6 },
        { time: T - 3600, open: 95.6, high: 96.2, low: 95.1, close: 95.3 },
      ]),
    )

    const { result } = render(PAIR, '1h')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { time: (T - 7200) * 1000, value: 95.0 },
      { time: (T - 3600) * 1000, value: 95.6 },
    ])
  })

  it('pages backwards 500 bars at a time', async () => {
    const olderTo = T - SPAN_5M - 1
    mockFetchCandles
      .mockResolvedValueOnce(candles([row(T - SPAN_5M, 95.0), row(T - 300, 95.2)]))
      .mockResolvedValueOnce(candles([row(T - SPAN_5M - 600, 94.0), row(T - SPAN_5M - 300, 94.9)]))

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await act(async () => {
      result.current.fetchOlder()
    })
    await waitFor(() => expect(mockFetchCandles).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    expect(mockFetchCandles.mock.calls.map(([args]) => args)).toEqual([
      { pair: PAIR, resolution: '5', from: T - SPAN_5M, to: T },
      { pair: PAIR, resolution: '5', from: olderTo - SPAN_5M, to: olderTo },
    ])
    expect(result.current.data?.map((p) => p.value)).toEqual([94.0, 94.9, 95.0, 95.2])
    expect(result.current.hasMoreHistory).toBe(true)
  })

  it('stops paging at the cache window', async () => {
    // The cache holds less than the page asked for: the window starts after the requested from.
    mockFetchCandles.mockResolvedValue(
      candles([row(T - 100_000, 95.0), row(T - 300, 95.2)], {
        window: { from: T - 100_000, to: T },
      }),
    )

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasMoreHistory).toBe(false)

    await act(async () => {
      result.current.fetchOlder()
    })

    expect(mockFetchCandles).toHaveBeenCalledOnce()
    expect(result.current.data).toHaveLength(2)
  })

  it('an empty older page still ends paging', async () => {
    vi.useFakeTimers()
    mockFetchCandles
      .mockResolvedValueOnce(candles([row(T - 300, 95.2)]))
      .mockResolvedValueOnce(candles([]))

    const { result } = render()
    await tick(1)
    expect(result.current.isSuccess).toBe(true)

    act(() => result.current.fetchOlder())
    await tick(1)

    expect(mockFetchCandles).toHaveBeenCalledTimes(2)
    expect(result.current.hasMoreHistory).toBe(false)
    expect(result.current.data).toEqual([{ time: (T - 300) * 1000, value: 95.2 }])
    // The newest page has rows, so nothing polls
    await tick(10 * 60_000)
    expect(mockFetchCandles).toHaveBeenCalledTimes(2)
  })

  it('shifts history by the current level in free mode', async () => {
    usePriceStore.setState({ levels: { [FEED]: 1.0007 } })
    mockFetchCandles.mockResolvedValue(candles([row(T - 600, 95.1), row(T - 300, 95.2)]))

    const { result } = render()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].value).toBeCloseTo(95.1 * 1.0007, 10)
    expect(result.current.data?.[1].value).toBeCloseTo(95.2 * 1.0007, 10)

    // A new level moves the whole history onto it
    act(() => usePriceStore.setState({ levels: { [FEED]: 1.001 } }))
    expect(result.current.data?.[1].value).toBeCloseTo(95.2 * 1.001, 10)
  })

  it('does not shift Pyth-sourced history', async () => {
    usePriceStore.setState({ levels: { [FEED]: 1.0007 } })
    mockFetchCandles.mockResolvedValue(
      candles([row(T - 300, 95.2)], { source: 'pyth', sources: ['pyth'] }),
    )

    const { result } = render()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ time: (T - 300) * 1000, value: 95.2 }])
  })

  it('does not shift in pyth mode', async () => {
    mockEnv.APP_PRICE_SOURCE = 'pyth'
    usePriceStore.setState({ levels: { [FEED]: 1.0007 } })
    mockFetchCandles.mockResolvedValue(candles([row(T - 300, 95.2)]))

    const { result } = render()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ time: (T - 300) * 1000, value: 95.2 }])
  })

  it('retries a warming 503 for up to two minutes', async () => {
    vi.useFakeTimers()
    mockFetchCandles.mockRejectedValue(warming())

    const { result } = render()
    await tick(0)
    expect(mockFetchCandles).toHaveBeenCalledTimes(1)

    // 24 retries, five seconds apart
    for (let retry = 1; retry <= 24; retry++) {
      await tick(4_999)
      expect(mockFetchCandles).toHaveBeenCalledTimes(retry)
      await tick(1)
      expect(mockFetchCandles).toHaveBeenCalledTimes(retry + 1)
    }
    await tick(1)

    // The 25th failure surfaces, and nothing asks again
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toMatchObject({ code: 'candle_cache_warming' })
    await tick(10 * 60_000)
    expect(mockFetchCandles).toHaveBeenCalledTimes(25)
  })

  it('retries other failures once', async () => {
    vi.useFakeTimers()
    mockFetchCandles.mockRejectedValue(
      new CandlesRequestError(
        'API request failed: 503 Service Unavailable - candle_cache_disabled',
        503,
        'candle_cache_disabled',
      ),
    )

    const { result } = render()
    await tick(0)
    expect(mockFetchCandles).toHaveBeenCalledTimes(1)
    await tick(999)
    expect(mockFetchCandles).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(mockFetchCandles).toHaveBeenCalledTimes(2)
    await tick(1)

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toMatchObject({ code: 'candle_cache_disabled' })
    await tick(10 * 60_000)
    expect(mockFetchCandles).toHaveBeenCalledTimes(2)
  })

  it('polls while the newest page is empty and stops once it has rows', async () => {
    vi.useFakeTimers()
    mockFetchCandles
      .mockResolvedValueOnce(candles([]))
      .mockResolvedValueOnce(candles([row(T - 300, 95.2)]))

    const { result } = render()
    await tick(1)
    expect(result.current.data).toEqual([])
    expect(result.current.hasMoreHistory).toBe(false)

    await tick(14_000)
    expect(mockFetchCandles).toHaveBeenCalledTimes(1)
    await tick(1_000)
    expect(mockFetchCandles).toHaveBeenCalledTimes(2)
    // The refetch asks for the same newest page again
    expect(mockFetchCandles.mock.calls[1][0]).toEqual(mockFetchCandles.mock.calls[0][0])
    await tick(1)

    expect(result.current.data).toEqual([{ time: (T - 300) * 1000, value: 95.2 }])
    expect(result.current.hasMoreHistory).toBe(true)
    await tick(10 * 60_000)
    expect(mockFetchCandles).toHaveBeenCalledTimes(2)
  })

  it('does not fetch without a supported pair', () => {
    for (const pair of [null, '', 'XYZ/UNKNOWN']) {
      const { result } = render(pair)
      expect(result.current.fetchStatus).toBe('idle')
      expect(result.current.isLoading).toBe(false)
    }
    expect(mockFetchCandles).not.toHaveBeenCalled()
  })
})
