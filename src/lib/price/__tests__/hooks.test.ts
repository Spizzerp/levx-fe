import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { PYTH_FEED_IDS } from '@/lib/pyth/feedIds'

vi.mock('@/lib/price/freeFeed', () => ({ useLeveledFeed: vi.fn() }))
vi.mock('@/lib/price/pythFeed', () => ({ usePythHermesFeed: vi.fn() }))

const FEED = PYTH_FEED_IDS['SOL/USDC']
const OTHER = PYTH_FEED_IDS['BTC/USDC']

/** usePriceFeed picks its provider at load, so each case loads the modules afresh. */
async function load(source: string | undefined) {
  vi.resetModules()
  vi.stubEnv('APP_PRICE_SOURCE', source)
  vi.stubEnv('APP_HERMES_URL', 'https://hermes.invalid')
  const hooks = await import('@/lib/price/hooks')
  const { useLeveledFeed } = await import('@/lib/price/freeFeed')
  const { usePythHermesFeed } = await import('@/lib/price/pythFeed')
  const { usePriceStore } = await import('@/stores/priceStore')
  return { ...hooks, useLeveledFeed, usePythHermesFeed, usePriceStore }
}

describe('price hooks', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    // resetModules keeps mocked modules, so their hook spies carry calls across cases
    vi.clearAllMocks()
  })

  it('usePriceFeed uses the leveled feed by default', async () => {
    const m = await load(undefined)

    renderHook(() => m.usePriceFeed(FEED))

    expect(m.useLeveledFeed).toHaveBeenCalledWith(FEED)
    expect(m.usePythHermesFeed).not.toHaveBeenCalled()
  })

  it('usePriceFeed uses the Hermes feed when APP_PRICE_SOURCE is pyth', async () => {
    const m = await load('pyth')

    renderHook(() => m.usePriceFeed(FEED))

    expect(m.usePythHermesFeed).toHaveBeenCalledWith(FEED)
    expect(m.useLeveledFeed).not.toHaveBeenCalled()
  })

  it('useLatestPrice, useFeedState and useLevel read the store per feed id', async () => {
    const m = await load(undefined)
    const { result } = renderHook(() => ({
      tick: m.useLatestPrice(FEED),
      state: m.useFeedState(FEED),
      level: m.useLevel(FEED),
      none: [m.useLatestPrice(null), m.useFeedState(null), m.useLevel(null)],
    }))
    expect(result.current).toEqual({
      tick: null,
      state: null,
      level: null,
      none: [null, null, null],
    })

    const tick = { time: 1_793_452_681_000, value: 95.77, publishTime: 1_793_452_681 }
    const state = { status: 'live' as const, leveled: true, levelAgeSec: 3 }
    act(() => {
      const store = m.usePriceStore.getState()
      store.setTick(FEED, tick)
      store.setFeedState(FEED, state)
      store.setLevel(FEED, 1.0007)
      store.setLevel(OTHER, 1.0003)
    })

    expect(result.current).toEqual({ tick, state, level: 1.0007, none: [null, null, null] })
  })

  it('usePriceTrail keeps its array across unrelated writes', async () => {
    const m = await load(undefined)
    m.usePriceStore.setState({ ticks: {}, feeds: {}, levels: {}, trails: {} })
    const { result } = renderHook(() => ({
      trail: m.usePriceTrail(FEED),
      none: m.usePriceTrail(null),
    }))
    const empty = result.current.trail
    expect(empty).toEqual([])
    expect(result.current.none).toEqual([])

    const tick = { time: 1_793_452_681_000, value: 95.77, publishTime: 1_793_452_681 }
    act(() => {
      const store = m.usePriceStore.getState()
      store.setFeedState(FEED, { status: 'live', leveled: true, levelAgeSec: 3 })
      store.setTick(OTHER, tick)
    })
    expect(result.current.trail).toBe(empty)

    act(() => m.usePriceStore.getState().setTick(FEED, tick))
    const trail = result.current.trail
    expect(trail).toEqual([tick])

    act(() => {
      const store = m.usePriceStore.getState()
      store.setLevel(FEED, 1.0007)
      store.setTick(OTHER, { ...tick, publishTime: tick.publishTime + 1 })
    })
    expect(result.current.trail).toBe(trail)
  })
})
