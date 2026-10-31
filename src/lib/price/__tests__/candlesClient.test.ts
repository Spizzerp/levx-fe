import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CandlesRequestError,
  fetchCandles,
  fetchPipelineMinuteCandle,
} from '@/lib/price/candlesClient'
import type { CandlesResponse } from '@/lib/price/candlesClient'

const mockEnv = vi.hoisted(() => ({ APP_API_BASE_URL: '' }))
vi.mock('@/env/env.config', () => ({ env: mockEnv }))

/** A minute boundary, in seconds. */
const M = 1_793_452_680

function candles(overrides: Partial<CandlesResponse> = {}): CandlesResponse {
  return {
    pair: 'SOL/USDC',
    resolution: '5',
    source: 'coinbase',
    sources: ['coinbase'],
    window: { from: M - 30 * 86_400, to: M },
    last_refresh: M + 10,
    stale: false,
    rows: [{ time: M - 300, open: 95.1, high: 95.3, low: 95.0, close: 95.2 }],
    ...overrides,
  }
}

const json = (body: unknown, status = 200, statusText = 'OK') =>
  new Response(JSON.stringify(body), { status, statusText })

let fetchMock: ReturnType<typeof vi.fn>

describe('fetchCandles', () => {
  beforeEach(() => {
    mockEnv.APP_API_BASE_URL = ''
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds the candles URL with an encoded pair', async () => {
    const body = candles()
    fetchMock.mockResolvedValue(json(body))

    const result = await fetchCandles({
      pair: 'SOL/USDC',
      resolution: '5',
      from: M - 150_000,
      to: M,
    })

    expect(result).toEqual(body)
    // A plain GET with no custom headers, so the browser sends no CORS preflight
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/candles?pair=SOL%2FUSDC&resolution=5&from=${M - 150_000}&to=${M}`,
    )

    mockEnv.APP_API_BASE_URL = 'https://pipeline.example'
    fetchMock.mockResolvedValue(json(body))
    await fetchCandles({ pair: 'BTC/USDC', resolution: 'D', from: M - 86_400, to: M })
    expect(fetchMock).toHaveBeenLastCalledWith(
      `https://pipeline.example/api/v1/candles?pair=BTC%2FUSDC&resolution=D&from=${M - 86_400}&to=${M}`,
    )
  })

  it('throws on a non-OK answer with its status and detail code', async () => {
    fetchMock.mockResolvedValue(
      json(
        { detail: { code: 'candle_cache_warming', message: 'not backfilled yet' } },
        503,
        'Service Unavailable',
      ),
    )

    const error = await fetchCandles({
      pair: 'SOL/USDC',
      resolution: '1',
      from: M,
      to: M + 60,
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CandlesRequestError)
    expect(error).toMatchObject({ status: 503, code: 'candle_cache_warming' })
    expect((error as Error).message).toMatch(
      /^API request failed: 503 Service Unavailable \(.*\/api\/v1\/candles\?.*\) - candle_cache_warming$/,
    )
  })
})

describe('fetchPipelineMinuteCandle', () => {
  beforeEach(() => {
    mockEnv.APP_API_BASE_URL = ''
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('answers the one-minute candle that starts the minute', async () => {
    fetchMock.mockResolvedValue(
      json(
        candles({
          resolution: '1',
          rows: [
            { time: M, open: 95.6, high: 95.9, low: 95.5, close: 95.8 },
            { time: M + 60, open: 95.8, high: 96.0, low: 95.7, close: 95.9 },
          ],
        }),
      ),
    )

    await expect(fetchPipelineMinuteCandle('SOL/USDC', M)).resolves.toEqual({
      time: M,
      open: 95.6,
      close: 95.8,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/candles?pair=SOL%2FUSDC&resolution=1&from=${M}&to=${M + 60}`,
    )
  })

  it('answers null when the minute is missing or the request fails', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        candles({
          resolution: '1',
          rows: [{ time: M + 60, open: 95.8, high: 96.0, low: 95.7, close: 95.9 }],
        }),
      ),
    )
    await expect(fetchPipelineMinuteCandle('SOL/USDC', M)).resolves.toBeNull()

    fetchMock.mockResolvedValueOnce(
      json({ detail: { code: 'candle_cache_disabled', message: 'off' } }, 503),
    )
    await expect(fetchPipelineMinuteCandle('SOL/USDC', M)).resolves.toBeNull()

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(fetchPipelineMinuteCandle('SOL/USDC', M)).resolves.toBeNull()
  })
})
