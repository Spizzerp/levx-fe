import { describe, expect, it } from 'vitest'

import { segmentPredictionPathAtTime } from '@/lib/chart/segmentPredictionPath'
import type { PricePoint } from '@/types/market'

const path: PricePoint[] = [
  { time: 0, value: 100 },
  { time: 10, value: 110 },
  { time: 20, value: 130 },
]

describe('segmentPredictionPathAtTime', () => {
  it('keeps the full path future-visible before the market has reached it', () => {
    expect(segmentPredictionPathAtTime(path, -1)).toEqual({
      elapsed: [],
      future: path,
    })
  })

  it('splits a forecast at an existing checkpoint', () => {
    expect(segmentPredictionPathAtTime(path, 10)).toEqual({
      elapsed: [
        { time: 0, value: 100 },
        { time: 10, value: 110 },
      ],
      future: [
        { time: 10, value: 110 },
        { time: 20, value: 130 },
      ],
    })
  })

  it('inserts a shared junction point between checkpoints', () => {
    expect(segmentPredictionPathAtTime(path, 15)).toEqual({
      elapsed: [
        { time: 0, value: 100 },
        { time: 10, value: 110 },
        { time: 15, value: 120 },
      ],
      future: [
        { time: 15, value: 120 },
        { time: 20, value: 130 },
      ],
    })
  })
})
