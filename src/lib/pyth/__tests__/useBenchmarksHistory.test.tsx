import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { PricePoint } from '@/types/market'
import { useBenchmarksHistory } from '@/lib/pyth/useBenchmarksHistory'

// Mock the benchmarksClient module. Keep RESOLUTION_SECONDS real so the page-span
// math still works in the hook; only fetchHistoricalPrices is stubbed.
const mockFetchHistoricalPrices = vi.fn()

vi.mock('@/lib/pyth/benchmarksClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pyth/benchmarksClient')>(
    '@/lib/pyth/benchmarksClient',
  )
  return {
    ...actual,
    fetchHistoricalPrices: (...args: Parameters<typeof mockFetchHistoricalPrices>) =>
      mockFetchHistoricalPrices(...args),
  }
})

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

const OLDER_PAGE: PricePoint[] = [
  { time: 1_699_900_000_000, value: 90.0 },
  { time: 1_699_950_000_000, value: 92.0 },
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

  it('returns flat ascending PricePoint[] after successful fetch', async () => {
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
    expect(result.current.hasMoreHistory).toBe(true)
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

  it('passes the resolved Benchmarks symbol to fetchHistoricalPrices', async () => {
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

  it('fetchOlder paginates backwards and merges pages ascending', async () => {
    mockFetchHistoricalPrices
      .mockResolvedValueOnce(MOCK_PRICE_POINTS) // initial (newer)
      .mockResolvedValueOnce(OLDER_PAGE) // one page back

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          pair: PAIR,
          interval: '1h',
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(MOCK_PRICE_POINTS)

    await act(async () => {
      result.current.fetchOlder()
    })

    await waitFor(() => expect(mockFetchHistoricalPrices).toHaveBeenCalledTimes(2))
    expect(result.current.data).toEqual([...OLDER_PAGE, ...MOCK_PRICE_POINTS])

    // Second call should target an earlier window (anchor moved backwards)
    const secondCallArgs = mockFetchHistoricalPrices.mock.calls[1][0]
    const firstCallArgs = mockFetchHistoricalPrices.mock.calls[0][0]
    expect(secondCallArgs.to).toBeLessThan(firstCallArgs.to)
    expect(secondCallArgs.from).toBeLessThan(firstCallArgs.from)
  })

  it('pins hasMoreHistory=false when an older page comes back empty', async () => {
    mockFetchHistoricalPrices
      .mockResolvedValueOnce(MOCK_PRICE_POINTS) // initial
      .mockResolvedValueOnce([]) // depth exhausted

    const { result } = renderHook(
      () =>
        useBenchmarksHistory({
          pair: PAIR,
          interval: '1h',
          toTime: 1_700_086_400,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await act(async () => {
      result.current.fetchOlder()
    })

    await waitFor(() => expect(result.current.hasMoreHistory).toBe(false))
  })
})
