import { describe, it, expect, beforeEach } from 'vitest'

import type { FeedState, PriceTick } from '@/lib/price/types'
import { usePriceStore } from '@/stores/priceStore'

const FEED_A = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
const FEED_B = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'

function makeTick(publishTime: number, value: number): PriceTick {
  return { time: publishTime * 1000, value, publishTime }
}

describe('priceStore', () => {
  beforeEach(() => {
    usePriceStore.setState({ ticks: {}, feeds: {}, levels: {} })
  })

  it('drops a tick that is not newer than the stored one', () => {
    const { setTick } = usePriceStore.getState()
    setTick(FEED_A, makeTick(10, 100))
    setTick(FEED_A, makeTick(10, 200))
    expect(usePriceStore.getState().getLatestTick(FEED_A)?.value).toBe(100)

    setTick(FEED_A, makeTick(9, 300))
    expect(usePriceStore.getState().getLatestTick(FEED_A)?.value).toBe(100)

    setTick(FEED_A, makeTick(11, 400))
    expect(usePriceStore.getState().getLatestTick(FEED_A)).toEqual(makeTick(11, 400))
    expect(usePriceStore.getState().getLatestTick(FEED_B)).toBeNull()
  })

  it('stores feed state and level per feed id', () => {
    const live: FeedState = { status: 'live', leveled: true, levelAgeSec: 12 }
    const delayed: FeedState = { status: 'delayed', leveled: false, levelAgeSec: null }
    const { setFeedState, setLevel } = usePriceStore.getState()

    setFeedState(FEED_A, live)
    setFeedState(FEED_B, delayed)
    setLevel(FEED_A, 1.000731)

    const state = usePriceStore.getState()
    expect(state.feeds[FEED_A]).toEqual(live)
    expect(state.feeds[FEED_B]).toEqual(delayed)
    expect(state.levels[FEED_A]).toBe(1.000731)
    expect(state.levels[FEED_B]).toBeUndefined()
  })
})
