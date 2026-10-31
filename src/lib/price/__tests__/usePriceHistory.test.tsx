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

const row = (time: number, close: number): CandleRow => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
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

  it('maps rows to close-price points in ms', async () => {
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

  it('stops paging at an empty page', async () => {
    mockFetchCandles
      .mockResolvedValueOnce(candles([row(T - 300, 95.2)]))
      .mockResolvedValueOnce(candles([]))

    const { result } = render()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await act(async () => {
      result.current.fetchOlder()
    })

    await waitFor(() => expect(result.current.hasMoreHistory).toBe(false))
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

  it('retries a warming 503', async () => {
    vi.useFakeTimers()
    mockFetchCandles
      .mockRejectedValueOnce(warming())
      .mockRejectedValueOnce(warming())
      .mockRejectedValueOnce(warming())
      .mockResolvedValueOnce(candles([row(T - 300, 95.2)]))

    const { result } = render()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(mockFetchCandles).toHaveBeenCalledTimes(1)

    // Three retries, five seconds apart
    for (let retry = 1; retry <= 3; retry++) {
      await act(() => vi.advanceTimersByTimeAsync(4_999))
      expect(mockFetchCandles).toHaveBeenCalledTimes(retry)
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(mockFetchCandles).toHaveBeenCalledTimes(retry + 1)
    }
    // react-query notifies observers through a 0 ms timeout, which the fake clock runs 1 ms later
    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data).toEqual([{ time: (T - 300) * 1000, value: 95.2 }])
  })

  it('does not retry a disabled cache', async () => {
    mockFetchCandles.mockRejectedValue(
      new CandlesRequestError(
        'API request failed: 503 Service Unavailable - candle_cache_disabled',
        503,
        'candle_cache_disabled',
      ),
    )

    const { result } = render()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockFetchCandles).toHaveBeenCalledOnce()
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
