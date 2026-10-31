import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePriceStore } from '@/stores/priceStore'

// Flush all pending promises/microtasks
async function flushMicrotasks() {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve()
  }
}

// --- Mock dependencies ---
const mockClose = vi.fn()
let mockOnMessage: ((e: MessageEvent) => void) | null = null
let mockOnError: (() => void) | null = null

const mockSource = {
  get onmessage() {
    return mockOnMessage
  },
  set onmessage(fn: ((e: MessageEvent) => void) | null) {
    mockOnMessage = fn
  },
  get onerror() {
    return mockOnError
  },
  set onerror(fn: (() => void) | null) {
    mockOnError = fn
  },
  close: mockClose,
}

const mockGetPriceUpdatesStream = vi.fn()

vi.mock('@/env/env.config', () => ({
  env: {
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.devnet.solana.com',
    APP_NETWORK: 'devnet',
    APP_ENV: 'test',
    APP_API_BASE_URL: '',
  },
}))

vi.mock('@pythnetwork/hermes-client', () => ({
  HermesClient: vi.fn(),
}))

vi.mock('@/lib/pyth/client', () => ({
  getPythClient: () => ({
    getPriceUpdatesStream: mockGetPriceUpdatesStream,
  }),
  __resetPythClientForTests: () => {},
}))

const FEED_ID = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'

/** One Hermes SSE message carrying a parsed price update. */
function hermesMessage(price: string, expo: number, publishTime: number): MessageEvent {
  const parsed = [{ id: FEED_ID.slice(2), price: { price, expo, publish_time: publishTime } }]
  return { data: JSON.stringify({ parsed }) } as MessageEvent
}

describe('usePythHermesFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockClose.mockClear()
    mockGetPriceUpdatesStream.mockClear()
    mockOnMessage = null
    mockOnError = null
    mockGetPriceUpdatesStream.mockResolvedValue(mockSource)
    usePriceStore.setState({ ticks: {}, feeds: {}, levels: {}, trails: {} })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens HermesClient stream on mount', async () => {
    const { usePythHermesFeed } = await import('@/lib/price/pythFeed')
    const { unmount } = renderHook(() => usePythHermesFeed(FEED_ID))

    await act(async () => {
      await flushMicrotasks()
    })

    expect(mockGetPriceUpdatesStream).toHaveBeenCalledOnce()
    expect(mockGetPriceUpdatesStream).toHaveBeenCalledWith([FEED_ID], { parsed: true })

    unmount()
  })

  it('closes EventSource on unmount', async () => {
    const { usePythHermesFeed } = await import('@/lib/price/pythFeed')
    const { unmount } = renderHook(() => usePythHermesFeed(FEED_ID))

    await act(async () => {
      await flushMicrotasks()
    })

    unmount()
    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('writes parsed ticks to the price store and reports the feed live', async () => {
    const { usePythHermesFeed } = await import('@/lib/price/pythFeed')
    const { unmount } = renderHook(() => usePythHermesFeed(FEED_ID))

    await act(async () => {
      await flushMicrotasks()
    })

    act(() => {
      mockOnMessage?.(hermesMessage('9577000000', -8, 1_793_452_681))
      vi.advanceTimersByTime(1000)
    })

    expect(usePriceStore.getState().ticks[FEED_ID]).toEqual({
      time: 1_793_452_681_000,
      value: expect.closeTo(95.77, 10),
      publishTime: 1_793_452_681,
    })
    expect(usePriceStore.getState().feeds[FEED_ID]).toEqual({
      status: 'live',
      leveled: true,
      levelAgeSec: 0,
    })

    unmount()
  })

  it('schedules reconnect on onerror with exponential backoff', async () => {
    const { usePythHermesFeed } = await import('@/lib/price/pythFeed')
    renderHook(() => usePythHermesFeed(FEED_ID))

    await act(async () => {
      await flushMicrotasks()
    })

    expect(mockGetPriceUpdatesStream).toHaveBeenCalledTimes(1)

    // Trigger onerror
    act(() => {
      mockOnError?.()
    })

    // Advance past the initial 1s backoff window (with ±20% jitter, max is 1.2s)
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await flushMicrotasks()
    })

    // Should have reconnected (called again)
    expect(mockGetPriceUpdatesStream).toHaveBeenCalledTimes(2)
  })

  it('reports the feed delayed once no tick has arrived for COINBASE_SILENT_MS', async () => {
    // The stream keeps failing, so no tick ever arrives.
    mockGetPriceUpdatesStream.mockRejectedValue(new Error('401'))
    const { usePythHermesFeed } = await import('@/lib/price/pythFeed')
    renderHook(() => usePythHermesFeed(FEED_ID))

    await act(async () => {
      vi.advanceTimersByTime(4000)
      await flushMicrotasks()
    })
    expect(usePriceStore.getState().feeds[FEED_ID]).toBeUndefined()

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await flushMicrotasks()
    })
    expect(usePriceStore.getState().feeds[FEED_ID]).toEqual({
      status: 'delayed',
      leveled: true,
      levelAgeSec: 0,
    })
  })

  it('does not reconnect after cancelled flag is set by cleanup', async () => {
    // Make getStreamingPriceUpdates return a promise that we control
    let resolveStream!: (src: typeof mockSource) => void
    const slowStreamPromise = new Promise<typeof mockSource>((resolve) => {
      resolveStream = resolve
    })
    mockGetPriceUpdatesStream.mockReturnValue(slowStreamPromise)

    const { usePythHermesFeed } = await import('@/lib/price/pythFeed')
    const { unmount } = renderHook(() => usePythHermesFeed(FEED_ID))

    // Unmount BEFORE the stream resolves — this fires cleanup and sets cancelled = true
    unmount()

    // Now resolve the stream — the cancelled guard should close it and NOT schedule reconnect
    await act(async () => {
      resolveStream(mockSource)
      await flushMicrotasks()
    })

    // close() should have been called by the cancelled guard
    expect(mockClose).toHaveBeenCalledOnce()

    // Advance timers — no reconnect should be scheduled
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    await act(async () => {
      await flushMicrotasks()
    })

    // getStreamingPriceUpdates should only have been called once
    expect(mockGetPriceUpdatesStream).toHaveBeenCalledTimes(1)
  })
})
