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

const PAIR = 'SOL/USDC'
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
          pair: PAIR,
          interval: '1h',
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
          pair: PAIR,
          interval: '1m',
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
          pair: PAIR,
          interval: '1h',
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toContain('503')
  })

  it('refetches when interval changes', async () => {
    mockFetchHistoricalPrices.mockResolvedValue(MOCK_PRICE_POINTS)

    let interval: '1m' | '1h' = '1m'

    const { result, rerender } = renderHook(
      () =>
        useBenchmarksHistory({
          pair: PAIR,
          interval,
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetchHistoricalPrices).toHaveBeenCalledTimes(1)

    // Change interval — should trigger a new query
    interval = '1h'
    rerender()

    await waitFor(() => expect(mockFetchHistoricalPrices).toHaveBeenCalledTimes(2))
  })

  it('does not fetch when pair is null', () => {
    mockFetchHistoricalPrices.mockResolvedValue(MOCK_PRICE_POINTS)

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          pair: null,
          interval: '1h',
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    // enabled: false when pair is null (no symbol to resolve)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetchHistoricalPrices).not.toHaveBeenCalled()
  })

  it('does not fetch when pair is unknown (no Benchmarks symbol)', () => {
    mockFetchHistoricalPrices.mockResolvedValue(MOCK_PRICE_POINTS)

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          pair: 'XYZ/UNKNOWN',
          interval: '1h',
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetchHistoricalPrices).not.toHaveBeenCalled()
  })

  it('passes the resolved Benchmarks symbol (not the raw pair) to fetchHistoricalPrices', async () => {
    mockFetchHistoricalPrices.mockResolvedValue(MOCK_PRICE_POINTS)

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          pair: 'BTC/USDC',
          interval: '15m',
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetchHistoricalPrices).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'Crypto.BTC/USD', resolution: '15' }),
    )
  })
})
