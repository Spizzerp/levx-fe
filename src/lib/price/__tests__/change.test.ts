import { describe, it, expect } from 'vitest'

import { changeSinceStart } from '@/lib/price/change'

const START = Date.UTC(2026, 9, 31, 12)
const MINUTE = 60_000

describe('changeSinceStart', () => {
  it('uses checkpoint 0 as the baseline when it exists', () => {
    const change = changeSinceStart({
      history: [
        { time: START, value: 100 },
        { time: START + 60 * MINUTE, value: 205 },
      ],
      marketStart: START,
      checkpoint0Price: 200,
      current: 210,
    })

    expect(change.value).toBeCloseTo(5)
    expect(change.isPositive).toBe(true)
  })

  it('falls back to the history at the market start', () => {
    const change = changeSinceStart({
      history: [
        { time: START - 180 * MINUTE, value: 90 },
        { time: START + MINUTE, value: 100 },
        { time: START + 120 * MINUTE, value: 120 },
      ],
      marketStart: START,
      current: 95,
    })

    expect(change.value).toBeCloseTo(5)
    expect(change.isPositive).toBe(false)
  })

  it('is zero without a baseline', () => {
    expect(changeSinceStart({ history: [], marketStart: START, current: 95 })).toEqual({
      value: 0,
      isPositive: true,
    })
    expect(
      changeSinceStart({
        history: [{ time: START, value: 0 }],
        marketStart: START,
        current: 95,
      }),
    ).toEqual({ value: 0, isPositive: true })
  })
})
