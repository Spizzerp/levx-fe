// @vitest-environment node
import { describe, it, expect } from 'vitest'

import type { PriceTick } from '@/lib/price'
import type { PricePoint } from '@/types/market'
import { mergePriceSeries, TRAIL_GAP_MS } from '@/features/chart/mergePriceSeries'

const t0 = 1_700_000_000_000

/** A one-minute candle; candle values (100 + minute) never collide with tick values. */
function candle(minute: number): PricePoint {
  return { time: t0 + minute * 60_000, value: 100 + minute }
}

/** A once-a-second live tick; tick values (1000 + second) never collide with candle values. */
function tick(second: number, value = 1000 + second): PriceTick {
  return { time: t0 + second * 1000, value, publishTime: t0 / 1000 + second }
}

function candles(fromMinute: number, toMinute: number): PricePoint[] {
  return Array.from({ length: toMinute - fromMinute + 1 }, (_, i) => candle(fromMinute + i))
}

function ticks(fromSecond: number, toSecond: number): PriceTick[] {
  return Array.from({ length: toSecond - fromSecond + 1 }, (_, i) => tick(fromSecond + i))
}

/** A tick as the line draws it. */
function point({ time, value }: PriceTick): PricePoint {
  return { time, value }
}

describe('mergePriceSeries', () => {
  it('keeps the trail where it overlaps newer candles', () => {
    const history = candles(0, 10)
    const trail = ticks(120, 630)

    const merged = mergePriceSeries(history, trail, null, TRAIL_GAP_MS)

    expect(merged).toEqual([candle(0), candle(1), ...trail.map(point)])
  })

  it('fills a long trail gap with the candles inside it', () => {
    // The history ends before the trail does, so no candle follows the last tick.
    const history = candles(0, 11)
    // A five-minute hole between the ticks at 300 s and 600 s; the candles on its edges stay out.
    const before = ticks(0, 300)
    const after = ticks(600, 700)

    const merged = mergePriceSeries(history, [...before, ...after], null, TRAIL_GAP_MS)

    expect(merged).toEqual([
      ...before.map(point),
      candle(6),
      candle(7),
      candle(8),
      candle(9),
      ...after.map(point),
    ])
  })

  it('does not fill a short gap', () => {
    const history = candles(0, 6)
    // A 60 s hole between the ticks at 290 s and 350 s, with the 300 s candle inside it.
    const trail = [...ticks(0, 290), ...ticks(350, 400)]

    const merged = mergePriceSeries(history, trail, null, TRAIL_GAP_MS)

    expect(merged).toEqual(trail.map(point))
  })

  it('appends the latest tick after the trail', () => {
    const history = candles(0, 2)
    const trail = ticks(180, 190)
    const latest = tick(191)

    const merged = mergePriceSeries(history, trail, latest, TRAIL_GAP_MS)

    expect(merged).toEqual([...history, ...trail.map(point), point(latest)])
  })

  it('drops points that are not newer than the previous one', () => {
    const history = candles(0, 2)
    const last = tick(182)
    // A repeated second, an older second, and the latest tick that is also the trail's last
    const trail = [tick(180), tick(181), tick(181, 5), tick(179, 6), last]

    const merged = mergePriceSeries(history, trail, last, TRAIL_GAP_MS)

    expect(merged).toEqual([...history, point(tick(180)), point(tick(181)), point(last)])
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i].time).toBeGreaterThan(merged[i - 1].time)
    }
  })

  it('appends newer candles after a stalled feed', () => {
    const history = candles(0, 10)
    // The feed stalled at 120 s while the history goes on to 600 s.
    const stalled = ticks(100, 120)

    expect(mergePriceSeries(history, stalled, null, TRAIL_GAP_MS)).toEqual([
      candle(0),
      candle(1),
      ...stalled.map(point),
      ...candles(3, 10),
    ])

    // A last tick within TRAIL_GAP_MS of the newest candle keeps the line on the trail.
    const recent = ticks(100, 550)
    expect(mergePriceSeries(history, recent, null, TRAIL_GAP_MS)).toEqual([
      candle(0),
      candle(1),
      ...recent.map(point),
    ])
  })

  it('returns the history when there is no trail and no tick', () => {
    const history = candles(0, 10)

    expect(mergePriceSeries(history, [], null, TRAIL_GAP_MS)).toEqual(history)
  })
})
