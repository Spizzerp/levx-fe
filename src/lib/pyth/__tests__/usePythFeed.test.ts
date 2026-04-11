import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePythStore } from '@/stores/pythStore'

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

const mockGetStreamingPriceUpdates = vi.fn()

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
    getStreamingPriceUpdates: mockGetStreamingPriceUpdates,
  }),
  __resetPythClientForTests: () => {},
}))

const FEED_ID = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'

describe('usePythFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockClose.mockClear()
    mockGetStreamingPriceUpdates.mockClear()
    mockOnMessage = null
    mockOnError = null
    mockGetStreamingPriceUpdates.mockResolvedValue(mockSource)
    usePythStore.setState({ ticks: {}, status: 'idle' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens HermesClient stream on mount', async () => {
    const { usePythFeed } = await import('@/lib/pyth/hooks')
    const { unmount } = renderHook(() => usePythFeed(FEED_ID))

    await act(async () => {
      await flushMicrotasks()
    })

    expect(mockGetStreamingPriceUpdates).toHaveBeenCalledOnce()
    expect(mockGetStreamingPriceUpdates).toHaveBeenCalledWith([FEED_ID])

    unmount()
  })

  it('closes EventSource on unmount', async () => {
    const { usePythFeed } = await import('@/lib/pyth/hooks')
    const { unmount } = renderHook(() => usePythFeed(FEED_ID))

    await act(async () => {
      await flushMicrotasks()
    })

    unmount()
    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('schedules reconnect on onerror with exponential backoff', async () => {
    const { usePythFeed } = await import('@/lib/pyth/hooks')
    renderHook(() => usePythFeed(FEED_ID))

    await act(async () => {
      await flushMicrotasks()
    })

    expect(mockGetStreamingPriceUpdates).toHaveBeenCalledTimes(1)

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
    expect(mockGetStreamingPriceUpdates).toHaveBeenCalledTimes(2)
  })

  it('sets status to "reconnecting" during backoff window', async () => {
    const { usePythFeed } = await import('@/lib/pyth/hooks')
    renderHook(() => usePythFeed(FEED_ID))

    await act(async () => {
      await flushMicrotasks()
    })

    // Trigger onerror
    act(() => {
      mockOnError?.()
    })

    // Status should be 'reconnecting' immediately after onerror (before timer fires)
    expect(usePythStore.getState().status).toBe('reconnecting')
  })

  it('does not reconnect after cancelled flag is set by cleanup', async () => {
    // Make getStreamingPriceUpdates return a promise that we control
    let resolveStream!: (src: typeof mockSource) => void
    const slowStreamPromise = new Promise<typeof mockSource>((resolve) => {
      resolveStream = resolve
    })
    mockGetStreamingPriceUpdates.mockReturnValue(slowStreamPromise)

    const { usePythFeed } = await import('@/lib/pyth/hooks')
    const { unmount } = renderHook(() => usePythFeed(FEED_ID))

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
    expect(mockGetStreamingPriceUpdates).toHaveBeenCalledTimes(1)
  })
})
