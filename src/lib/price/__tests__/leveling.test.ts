import { describe, it, expect } from 'vitest'

import {
  COINBASE_SILENT_MS,
  LEVEL_STALE_SEC,
  TRADE_BUFFER_MS,
  TradeBuffer,
  candlePriceAt,
  levelFactor,
} from '@/lib/price/leveling'

const T0 = Date.UTC(2026, 9, 31, 13, 18, 0)

describe('leveling', () => {
  it('pins the thresholds', () => {
    expect(COINBASE_SILENT_MS).toBe(5000)
    expect(LEVEL_STALE_SEC).toBe(180)
    expect(TRADE_BUFFER_MS).toBe(300_000)
  })

  it('priceAt returns the last trade at or before the time', () => {
    const buf = new TradeBuffer()
    expect(buf.priceAt(T0)).toBeNull()
    expect(buf.latest()).toBeNull()

    buf.push(T0, 95.7)
    buf.push(T0 + 2000, 95.8)
    buf.push(T0 + 5000, 95.9)

    expect(buf.priceAt(T0 - 1)).toBeNull()
    expect(buf.priceAt(T0)).toBe(95.7)
    expect(buf.priceAt(T0 + 1999)).toBe(95.7)
    expect(buf.priceAt(T0 + 2000)).toBe(95.8)
    expect(buf.priceAt(T0 + 4999)).toBe(95.8)
    expect(buf.priceAt(T0 + 60_000)).toBe(95.9)
    expect(buf.latest()).toEqual({ timeMs: T0 + 5000, price: 95.9 })
  })

  it('drops trades older than the buffer window', () => {
    const buf = new TradeBuffer()
    buf.push(T0, 95.7)
    buf.push(T0 + 1000, 95.8)
    // Exactly one window after the first trade: the first is still inside the window.
    buf.push(T0 + TRADE_BUFFER_MS, 96.0)
    expect(buf.priceAt(T0)).toBe(95.7)

    // One more millisecond pushes the first trade out; the second stays.
    buf.push(T0 + TRADE_BUFFER_MS + 1, 96.1)
    expect(buf.priceAt(T0)).toBeNull()
    expect(buf.priceAt(T0 + 1000)).toBe(95.8)
    expect(buf.latest()).toEqual({ timeMs: T0 + TRADE_BUFFER_MS + 1, price: 96.1 })
  })

  it('levelFactor is a ratio', () => {
    expect(levelFactor(95.77, 95.7)).toBeCloseTo(1.000731, 5)
    expect(levelFactor(100, 100)).toBe(1)
    expect(levelFactor(95.7, 95.77) * levelFactor(95.77, 95.7)).toBeCloseTo(1, 12)
  })

  it('candlePriceAt interpolates inside the minute', () => {
    const candle = { time: 1_793_452_680, open: 95.0, close: 96.2 }
    expect(candlePriceAt(candle, candle.time)).toBe(95.0)
    expect(candlePriceAt(candle, candle.time + 30)).toBeCloseTo(95.6, 10)
    expect(candlePriceAt(candle, candle.time + 15)).toBeCloseTo(95.3, 10)
    expect(candlePriceAt(candle, candle.time + 60)).toBeCloseTo(96.2, 10)
  })
})
