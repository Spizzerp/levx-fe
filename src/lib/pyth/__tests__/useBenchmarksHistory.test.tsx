import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { PricePoint } from '@/types/market'
import { useBenchmarksHistory } from '@/lib/pyth/useBenchmarksHistory'

// Mock the benchmarksClient module
const mockFetchHistoricalPrices = vi.fn()

vi.mock('@/lib/pyth/benchmarksClient', () => ({
  fetchHistoricalPrices: (...args: Parameters<typeof mockFetchHistoricalPrices>) =>
    mockFetchHistoricalPrices(...args),
  resolutionForCheckpointInterval: (intervalSec: number) => {
    if (intervalSec <= 60) return '1'
    if (intervalSec <= 300) return '5'
    if (intervalSec <= 900) return '15'
    if (intervalSec <= 3600) return '60'
    if (intervalSec <= 14400) return '240'
    return 'D'
  },
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

const FEED_ID = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
const MOCK_PRICE_POINTS: PricePoint[] = [
  { time: 1_700_000_000_000, value: 100.0 },
  { time: 1_700_003_600_000, value: 105.0 },
]

describe('useBenchmarksHistory', () => {
  beforeEach(() => {
    mockFetchHistoricalPrices.mockClear()
  })

  it('returns loading state on first render', () => {
    mockFetchHistoricalPrices.mockReturnValue(new Promise(() => {})) // never resolves

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          feedId: FEED_ID,
          range: '1d',
          checkpointIntervalSec: 60,
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('returns PricePoint[] after successful fetch', async () => {
    mockFetchHistoricalPrices.mockResolvedValue(MOCK_PRICE_POINTS)

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          feedId: FEED_ID,
          range: '1h',
          checkpointIntervalSec: 60,
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(MOCK_PRICE_POINTS)
    expect(mockFetchHistoricalPrices).toHaveBeenCalledOnce()
  })

  it('exposes error state on fetch failure', async () => {
    mockFetchHistoricalPrices.mockRejectedValue(new Error('Benchmarks REST error 503'))

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          feedId: FEED_ID,
          range: '1d',
          checkpointIntervalSec: 60,
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toContain('503')
  })

  it('refetches when range param changes', async () => {
    mockFetchHistoricalPrices.mockResolvedValue(MOCK_PRICE_POINTS)

    let range: '1h' | '1d' = '1h'

    const { result, rerender } = renderHook(
      () =>
        useBenchmarksHistory({
          feedId: FEED_ID,
          range,
          checkpointIntervalSec: 60,
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetchHistoricalPrices).toHaveBeenCalledTimes(1)

    // Change range — should trigger a new query
    range = '1d'
    rerender()

    await waitFor(() => expect(mockFetchHistoricalPrices).toHaveBeenCalledTimes(2))
  })

  it('does not fetch when feedId is null', () => {
    mockFetchHistoricalPrices.mockResolvedValue(MOCK_PRICE_POINTS)

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          feedId: null,
          range: '1d',
          checkpointIntervalSec: 60,
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    // enabled: false when feedId is null
    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetchHistoricalPrices).not.toHaveBeenCalled()
  })
})
