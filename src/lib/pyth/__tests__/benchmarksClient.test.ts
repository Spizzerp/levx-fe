import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchHistoricalPrices,
  resolutionForCheckpointInterval,
} from '@/lib/pyth/benchmarksClient'

describe('benchmarksClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches historical price range from Pyth Benchmarks REST endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        s: 'ok',
        t: [1_700_000_000, 1_700_000_060],
        c: [150.25, 151.0],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchHistoricalPrices({
      symbol: 'Crypto.SOL/USD',
      from: 1_700_000_000,
      to: 1_700_003_600,
      resolution: '1',
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('benchmarks.pyth.network')
    expect(calledUrl).toContain('/v1/shims/tradingview/history')
  })

  it('parses response into PricePoint[] with publishTime-derived timestamps', async () => {
    const t = [1_700_000_000, 1_700_000_060, 1_700_000_120]
    const c = [100.0, 101.5, 102.25]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ s: 'ok', t, c }),
      }),
    )

    const result = await fetchHistoricalPrices({
      symbol: 'Crypto.BTC/USD',
      from: t[0],
      to: t[2] + 60,
      resolution: '1',
    })

    expect(result).toHaveLength(3)
    // time should be publishTime * 1000 (unix ms)
    expect(result[0]).toEqual({ time: 1_700_000_000_000, value: 100.0 })
    expect(result[1]).toEqual({ time: 1_700_000_060_000, value: 101.5 })
    expect(result[2]).toEqual({ time: 1_700_000_120_000, value: 102.25 })
  })

  it('throws on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    )

    await expect(
      fetchHistoricalPrices({
        symbol: 'Crypto.BTC/USD',
        from: 1_700_000_000,
        to: 1_700_003_600,
        resolution: '1',
      }),
    ).rejects.toThrow('404')
  })

  it('throws when response body reports application-level error (HTTP 200 + s:"error")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ s: 'error', errmsg: "Symbol Crypto.XYZ/USD doesn't exist" }),
      }),
    )

    await expect(
      fetchHistoricalPrices({
        symbol: 'Crypto.XYZ/USD',
        from: 1_700_000_000,
        to: 1_700_003_600,
        resolution: '1',
      }),
    ).rejects.toThrow(/doesn't exist/)
  })

  it('returns [] when response body reports no_data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ s: 'no_data' }),
      }),
    )

    const result = await fetchHistoricalPrices({
      symbol: 'Crypto.BTC/USD',
      from: 1_700_000_000,
      to: 1_700_003_600,
      resolution: '1',
    })
    expect(result).toEqual([])
  })

  it('aligns resolution parameter to market.checkpointInterval', () => {
    // Per-spec mapping: intervalSec → BenchmarksResolution
    expect(resolutionForCheckpointInterval(60)).toBe('1') // 1 min
    expect(resolutionForCheckpointInterval(300)).toBe('5') // 5 min
    expect(resolutionForCheckpointInterval(900)).toBe('15') // 15 min
    expect(resolutionForCheckpointInterval(3600)).toBe('60') // 1 hour
    expect(resolutionForCheckpointInterval(14400)).toBe('240') // 4 hours
    expect(resolutionForCheckpointInterval(86400)).toBe('D') // 1 day
  })

  it('includes symbol, resolution, from, to as URL params', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ s: 'ok', t: [], c: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const symbol = 'Crypto.BTC/USD'
    const from = 1_700_000_000
    const to = 1_700_003_600

    await fetchHistoricalPrices({ symbol, from, to, resolution: '15' })

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('symbol=Crypto.BTC%2FUSD')
    expect(calledUrl).toContain('resolution=15')
    expect(calledUrl).toContain(`from=${from}`)
    expect(calledUrl).toContain(`to=${to}`)
  })
})
