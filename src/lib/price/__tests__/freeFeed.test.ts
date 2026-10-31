import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import type { Connection } from '@solana/web3.js'

import {
  __resetFreeFeedForTests,
  __setCoinbaseStreamForTests,
  __setConnectionForTests,
  setCandleFetcher,
  useLeveledFeed,
} from '@/lib/price/freeFeed'
import type { CoinbaseEvent, CoinbaseStream } from '@/lib/price/coinbaseStream'
import { subscribeSponsored } from '@/lib/price/sponsored'
import type { PriceTick } from '@/lib/price/types'
import { PYTH_FEED_IDS } from '@/lib/pyth/feedIds'
import { usePriceStore } from '@/stores/priceStore'

vi.mock('@/env/env.config', () => ({ env: { APP_RPC_URL: 'http://127.0.0.1:9' } }))

// PDA derivation fails under jsdom, so the account subscription itself is faked.
vi.mock('@/lib/price/sponsored', async (orig) => ({
  ...(await orig<typeof import('@/lib/price/sponsored')>()),
  subscribeSponsored: vi.fn(),
}))

const FEED = PYTH_FEED_IDS['SOL/USDC']
const PRODUCT = 'SOL-USD'
/** A minute boundary, in seconds. */
const T0_SEC = 1_793_452_680
const T0 = T0_SEC * 1000

type Listener = (e: CoinbaseEvent) => void

/** Records subscriptions per product; the test emits events. */
function createFakeStream() {
  const listeners = new Map<string, Listener>()
  const unsubscribe = vi.fn()
  const subscribe = vi.fn((product: string, onEvent: Listener) => {
    listeners.set(product, onEvent)
    return () => {
      listeners.delete(product)
      unsubscribe(product)
    }
  })
  const stream: CoinbaseStream = { subscribe }
  return {
    stream,
    subscribe,
    unsubscribe,
    trade(price: number, timeMs = Date.now()) {
      listeners.get(PRODUCT)?.({ kind: 'trade', price, timeMs })
    },
    heartbeat() {
      listeners.get(PRODUCT)?.({ kind: 'heartbeat', timeMs: Date.now() })
    },
  }
}

interface SponsoredSub {
  connection: Connection
  feedIdHex: string
  on: Parameters<typeof subscribeSponsored>[2]
  stop: Mock
}

const fakeConnection = { fake: 'connection' } as unknown as Connection
let fake: ReturnType<typeof createFakeStream>
let sponsoredSubs: SponsoredSub[]

function pythUpdate(price: number, publishTime: number) {
  sponsoredSubs.at(-1)?.on.update({ feedIdHex: FEED.slice(2), price, publishTime, full: true })
}

/** Lets the clock run one second at a time, with a heartbeat before each second when asked. */
function advance(seconds: number, heartbeats = false) {
  for (let i = 0; i < seconds; i++) {
    if (heartbeats) fake.heartbeat()
    vi.advanceTimersByTime(1000)
  }
}

async function flushPromises() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const latest = () => usePriceStore.getState().ticks[FEED]
const feedState = () => usePriceStore.getState().feeds[FEED]
const level = () => usePriceStore.getState().levels[FEED]

describe('useLeveledFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    usePriceStore.setState({ ticks: {}, feeds: {}, levels: {} })
    fake = createFakeStream()
    __setCoinbaseStreamForTests(fake.stream)
    __setConnectionForTests(fakeConnection)
    sponsoredSubs = []
    vi.mocked(subscribeSponsored)
      .mockReset()
      .mockImplementation((connection, feedIdHex, on) => {
        const stop = vi.fn()
        sponsoredSubs.push({ connection, feedIdHex, on, stop })
        return stop
      })
  })

  afterEach(() => {
    cleanup()
    __resetFreeFeedForTests()
    vi.useRealTimers()
  })

  it('writes trade × k each second once a Pyth update has set the level', () => {
    renderHook(() => useLeveledFeed(FEED))
    fake.trade(95.7, T0)
    pythUpdate(95.77, T0_SEC)

    advance(1)

    expect(latest()).toEqual({
      time: T0 + 1000,
      value: expect.closeTo(95.77, 10),
      publishTime: T0_SEC + 1,
    })
    expect(feedState()).toEqual({ status: 'live', leveled: true, levelAgeSec: 1 })
    expect(level()).toBeCloseTo(95.77 / 95.7, 12)
  })

  it('measures k at the Pyth publish time, not at the latest trade', () => {
    renderHook(() => useLeveledFeed(FEED))
    fake.trade(95.7, T0)
    advance(20, true)
    fake.trade(95.9, T0 + 20_000)
    // Pyth's update for t lands after the later trade, as sponsored writes trail their publish time.
    pythUpdate(95.77, T0_SEC)

    advance(1)

    expect(level()).toBeCloseTo(95.77 / 95.7, 12)
    expect(latest()?.value).toBeCloseTo((95.9 * 95.77) / 95.7, 10)
    expect(feedState()).toEqual({ status: 'live', leveled: true, levelAgeSec: 21 })
  })

  it('quiet market keeps advancing and stays live while heartbeats arrive', () => {
    renderHook(() => useLeveledFeed(FEED))
    fake.trade(95.7, T0)
    pythUpdate(95.77, T0_SEC)
    const writes: PriceTick[] = []
    const stop = usePriceStore.subscribe((s, prev) => {
      const tick = s.ticks[FEED]
      if (tick && tick !== prev.ticks[FEED]) writes.push(tick)
    })

    advance(20, true)
    stop()

    expect(writes).toHaveLength(20)
    expect(writes.map((w) => w.publishTime)).toEqual(
      Array.from({ length: 20 }, (_, i) => T0_SEC + i + 1),
    )
    expect(writes.every((w) => w.value === writes[0].value)).toBe(true)
    expect(writes[0].value).toBeCloseTo(95.77, 10)
    expect(feedState()?.status).toBe('live')
  })

  it('falls back to the last Pyth price and delayed when the stream is silent', () => {
    renderHook(() => useLeveledFeed(FEED))
    fake.trade(95.7, T0)
    pythUpdate(95.77, T0_SEC)
    fake.trade(95.9, T0)

    advance(4)
    expect(latest()?.value).toBeCloseTo((95.9 * 95.77) / 95.7, 10)
    expect(feedState()?.status).toBe('live')

    advance(2)
    expect(latest()).toEqual({ time: T0 + 6000, value: 95.77, publishTime: T0_SEC + 6 })
    expect(feedState()?.status).toBe('delayed')
  })

  it('reports nothing before the first event, then delayed with no tick when nothing arrives', () => {
    renderHook(() => useLeveledFeed(FEED))

    advance(4)
    expect(latest()).toBeUndefined()
    expect(feedState()).toBeUndefined()

    advance(1)
    expect(latest()).toBeUndefined()
    expect(feedState()?.status).toBe('delayed')
  })

  it('first level factor falls back to the minute candle, then to unleveled', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ time: T0_SEC - 60, open: 95.6, close: 95.8 })
      .mockResolvedValueOnce(null)
    setCandleFetcher(fetcher)

    // No trade buffered yet: the minute candle containing the publish time gives Coinbase's price.
    const first = renderHook(() => useLeveledFeed(FEED))
    pythUpdate(95.77, T0_SEC - 30)
    await flushPromises()

    expect(fetcher).toHaveBeenCalledWith('SOL/USDC', T0_SEC - 60)
    // Halfway through the minute: 95.6 + (95.8 − 95.6) / 2 = 95.7
    expect(level()).toBeCloseTo(95.77 / 95.7, 12)
    fake.trade(96, T0)
    advance(1)
    expect(latest()?.value).toBeCloseTo((96 * 95.77) / 95.7, 10)
    expect(feedState()?.leveled).toBe(true)

    // A fresh feed whose candle is unavailable stays unleveled until the next Pyth update.
    first.unmount()
    usePriceStore.setState({ ticks: {}, feeds: {}, levels: {} })
    renderHook(() => useLeveledFeed(FEED))
    const nowSec = T0_SEC + 1
    pythUpdate(95.77, nowSec - 10)
    await flushPromises()

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(level()).toBeUndefined()
    fake.trade(96)
    advance(1)
    expect(latest()?.value).toBe(96)
    expect(feedState()).toEqual({ status: 'live', leveled: false, levelAgeSec: null })

    pythUpdate(96.07, nowSec + 1)
    advance(1)
    expect(level()).toBeCloseTo(96.07 / 96, 12)
    expect(latest()?.value).toBeCloseTo(96.07, 10)
    expect(feedState()?.leveled).toBe(true)
  })

  it('a missing sponsored account leaves the feed unleveled', () => {
    renderHook(() => useLeveledFeed(FEED))
    sponsoredSubs[0].on.missing()
    fake.trade(95.7, T0)

    advance(1)

    expect(latest()).toEqual({ time: T0 + 1000, value: 95.7, publishTime: T0_SEC + 1 })
    expect(feedState()).toEqual({ status: 'live', leveled: false, levelAgeSec: null })
    expect(level()).toBeUndefined()
  })

  it('one account subscription per feed across mounts', () => {
    const intervals = vi.spyOn(globalThis, 'setInterval')
    const a = renderHook(() => useLeveledFeed(FEED))
    const b = renderHook(() => useLeveledFeed(FEED))

    expect(subscribeSponsored).toHaveBeenCalledTimes(1)
    expect(sponsoredSubs[0].connection).toBe(fakeConnection)
    expect(sponsoredSubs[0].feedIdHex).toBe(FEED)
    expect(fake.subscribe).toHaveBeenCalledTimes(1)
    expect(fake.subscribe).toHaveBeenCalledWith(PRODUCT, expect.any(Function))
    expect(intervals.mock.calls.filter(([, ms]) => ms === 1000)).toHaveLength(1)
    intervals.mockRestore()
    fake.trade(95.7)

    a.unmount()
    expect(sponsoredSubs[0].stop).not.toHaveBeenCalled()
    expect(fake.unsubscribe).not.toHaveBeenCalled()
    advance(1)
    expect(latest()?.value).toBe(95.7)

    b.unmount()
    expect(sponsoredSubs[0].stop).toHaveBeenCalledOnce()
    expect(fake.unsubscribe).toHaveBeenCalledOnce()
    usePriceStore.setState({ ticks: {}, feeds: {}, levels: {} })
    advance(2)
    expect(latest()).toBeUndefined()

    renderHook(() => useLeveledFeed(FEED))
    expect(subscribeSponsored).toHaveBeenCalledTimes(2)
    expect(fake.subscribe).toHaveBeenCalledTimes(2)
  })

  it('unknown feed id subscribes to nothing', () => {
    renderHook(() => useLeveledFeed(`0x${'ab'.repeat(32)}`))
    renderHook(() => useLeveledFeed(null))

    advance(6)

    expect(subscribeSponsored).not.toHaveBeenCalled()
    expect(fake.subscribe).not.toHaveBeenCalled()
    const { ticks, feeds, levels } = usePriceStore.getState()
    expect({ ticks, feeds, levels }).toEqual({ ticks: {}, feeds: {}, levels: {} })
  })
})
