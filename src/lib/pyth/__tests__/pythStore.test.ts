import { describe, it, expect, beforeEach } from 'vitest'
import { usePythStore } from '@/stores/pythStore'
import type { PythTick } from '@/lib/pyth/types'

const FEED_ID = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'

function makeTick(publishTime: number, value = 100): PythTick {
  return { publishTime, time: publishTime * 1000, value }
}

describe('pythStore', () => {
  beforeEach(() => {
    usePythStore.setState({ ticks: {}, status: 'idle' })
  })

  it('deduplicates ticks with equal publishTime', () => {
    const tick1 = makeTick(1000, 100)
    const tick2 = makeTick(1000, 200) // same publishTime, different value

    usePythStore.getState().setPythTick(FEED_ID, tick1)
    usePythStore.getState().setPythTick(FEED_ID, tick2)

    const stored = usePythStore.getState().ticks[FEED_ID]
    expect(stored?.value).toBe(100) // second tick was dropped
  })

  it('drops ticks with earlier publishTime (out-of-order)', () => {
    const newer = makeTick(2000, 200)
    const older = makeTick(1500, 100) // out-of-order, earlier publishTime

    usePythStore.getState().setPythTick(FEED_ID, newer)
    usePythStore.getState().setPythTick(FEED_ID, older)

    const stored = usePythStore.getState().ticks[FEED_ID]
    expect(stored?.publishTime).toBe(2000) // older tick was dropped
    expect(stored?.value).toBe(200)
  })

  it('stores the most recent tick keyed by feedId', () => {
    const tick1 = makeTick(1000, 100)
    const tick2 = makeTick(1001, 105)

    usePythStore.getState().setPythTick(FEED_ID, tick1)
    usePythStore.getState().setPythTick(FEED_ID, tick2)

    const tick = usePythStore.getState().getLatestTick(FEED_ID)
    expect(tick).not.toBeNull()
    expect(tick?.publishTime).toBe(1001)
    expect(tick?.value).toBe(105)
  })

  it('returns null from getLatestTick when no tick stored for feedId', () => {
    const tick = usePythStore.getState().getLatestTick('unknown-feed')
    expect(tick).toBeNull()
  })

  it('exposes connection status via setStatus action', () => {
    expect(usePythStore.getState().status).toBe('idle')

    usePythStore.getState().setStatus('reconnecting')
    expect(usePythStore.getState().status).toBe('reconnecting')

    usePythStore.getState().setStatus('connected')
    expect(usePythStore.getState().status).toBe('connected')
  })

  it('stores ticks for multiple feedIds independently', () => {
    const feedA = '0xaaa'
    const feedB = '0xbbb'

    usePythStore.getState().setPythTick(feedA, makeTick(1000, 100))
    usePythStore.getState().setPythTick(feedB, makeTick(1000, 200))

    expect(usePythStore.getState().getLatestTick(feedA)?.value).toBe(100)
    expect(usePythStore.getState().getLatestTick(feedB)?.value).toBe(200)
  })
})
