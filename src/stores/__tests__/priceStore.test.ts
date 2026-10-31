import { describe, it, expect, beforeEach } from 'vitest'

import type { FeedState, PriceTick } from '@/lib/price/types'
import { TRAIL_CAP, usePriceStore } from '@/stores/priceStore'

const FEED_A = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
const FEED_B = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'

function makeTick(publishTime: number, value: number): PriceTick {
  return { time: publishTime * 1000, value, publishTime }
}

describe('priceStore', () => {
  beforeEach(() => {
    usePriceStore.setState({ ticks: {}, feeds: {}, levels: {}, trails: {} })
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

  it('stores ticks for multiple feed ids independently', () => {
    const { setTick } = usePriceStore.getState()
    setTick(FEED_A, makeTick(1000, 100))
    setTick(FEED_B, makeTick(1000, 200))

    expect(usePriceStore.getState().getLatestTick(FEED_A)?.value).toBe(100)
    expect(usePriceStore.getState().getLatestTick(FEED_B)?.value).toBe(200)
  })

  it('keeps the previous feed state object when every field is equal', () => {
    const { setFeedState } = usePriceStore.getState()
    const first: FeedState = { status: 'live', leveled: true, levelAgeSec: 12 }
    setFeedState(FEED_A, first)
    const feedsBefore = usePriceStore.getState().feeds
    let notified = 0
    const stop = usePriceStore.subscribe(() => notified++)

    setFeedState(FEED_A, { status: 'live', leveled: true, levelAgeSec: 12 })
    expect(usePriceStore.getState().feeds).toBe(feedsBefore)
    expect(usePriceStore.getState().feeds[FEED_A]).toBe(first)
    expect(notified).toBe(0)

    setFeedState(FEED_A, { status: 'live', leveled: true, levelAgeSec: 13 })
    stop()
    expect(usePriceStore.getState().feeds[FEED_A]).toEqual({
      status: 'live',
      leveled: true,
      levelAgeSec: 13,
    })
    expect(notified).toBe(1)
  })

  it('keeps a trail of the accepted ticks per feed', () => {
    const { setTick, setFeedState, setLevel } = usePriceStore.getState()
    setTick(FEED_A, makeTick(10, 100))
    setTick(FEED_A, makeTick(10, 200))
    setTick(FEED_A, makeTick(9, 300))
    setTick(FEED_A, makeTick(11, 400))

    const trail = usePriceStore.getState().trails[FEED_A]
    expect(trail).toEqual([makeTick(10, 100), makeTick(11, 400)])
    expect(usePriceStore.getState().trails[FEED_B]).toBeUndefined()

    // Unrelated writes keep the trail's array
    setTick(FEED_B, makeTick(11, 200))
    setFeedState(FEED_A, { status: 'live', leveled: true, levelAgeSec: 1 })
    setLevel(FEED_A, 1.0007)
    setTick(FEED_A, makeTick(11, 500))
    expect(usePriceStore.getState().trails[FEED_A]).toBe(trail)
  })

  it('the trail is capped and drops the oldest', () => {
    const { setTick } = usePriceStore.getState()
    // Three hours at one tick a second
    expect(TRAIL_CAP).toBe(10_800)
    for (let s = 1; s <= TRAIL_CAP + 2; s++) setTick(FEED_A, makeTick(s, 100 + s / 1000))

    const trail = usePriceStore.getState().trails[FEED_A]!
    expect(trail).toHaveLength(TRAIL_CAP)
    expect(trail[0]).toEqual(makeTick(3, 100.003))
    expect(trail.at(-1)).toEqual(makeTick(TRAIL_CAP + 2, 100 + (TRAIL_CAP + 2) / 1000))
    expect(trail.at(-1)).toBe(usePriceStore.getState().ticks[FEED_A])
  })
})
