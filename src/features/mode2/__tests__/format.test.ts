// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { PredictionPath } from '@/types/market'

import {
  formatCountdownShort,
  formatLeverage,
  formatMarketWindow,
  formatSignedUsdc,
  formatUsdc,
  pathDirection,
  pathLabelsOf,
} from '../format'

/** The fields the helpers read; the rest of a PredictionPath is irrelevant here. */
function pathOf(pathIndex: number, label: string, values: readonly number[]): PredictionPath {
  return {
    id: `path-${pathIndex}`,
    label,
    pathIndex,
    data: values.map((value, i) => ({ time: i * 1000, value })),
  } as PredictionPath
}

describe('formatUsdc', () => {
  it('shows micro-USDC with two decimals', () => {
    expect(formatUsdc(29_700_000n)).toBe('29.70')
    expect(formatUsdc(10_000_000n)).toBe('10.00')
    expect(formatUsdc(1_000_000n)).toBe('1.00')
    expect(formatUsdc(50_000n)).toBe('0.05')
  })

  it('shows zero', () => {
    expect(formatUsdc(0n)).toBe('0.00')
  })

  it('truncates below the cent rather than rounding', () => {
    expect(formatUsdc(9_999n)).toBe('0.00')
    expect(formatUsdc(10_000n)).toBe('0.01')
    expect(formatUsdc(29_709_999n)).toBe('29.70')
  })

  it('stays exact beyond the float range', () => {
    expect(formatUsdc(9_007_199_254_740_993_000_000n)).toBe('9007199254740993.00')
  })

  it('marks a negative amount with the minus sign', () => {
    expect(formatUsdc(-5_900_000n)).toBe('−5.90')
  })
})

describe('formatSignedUsdc', () => {
  it('prefixes a gain with plus', () => {
    expect(formatSignedUsdc(29_700_000n)).toBe('+29.70')
  })

  it('prefixes a loss with the minus sign (U+2212)', () => {
    expect(formatSignedUsdc(-5_900_000n)).toBe('−5.90')
  })

  it('shows zero as plus', () => {
    expect(formatSignedUsdc(0n)).toBe('+0.00')
  })

  it('does not show a loss that truncates to zero as negative', () => {
    expect(formatSignedUsdc(-9_999n)).toBe('+0.00')
  })
})

describe('formatLeverage', () => {
  it('always shows one decimal', () => {
    expect(formatLeverage(2.4)).toBe('2.4×')
    expect(formatLeverage(3)).toBe('3.0×')
    expect(formatLeverage(1)).toBe('1.0×')
    expect(formatLeverage(10)).toBe('10.0×')
  })
})

describe('formatMarketWindow', () => {
  // Built in local time so the expected clock text holds in any timezone. July avoids the daylight
  // saving changes that would make a calendar day 23 or 25 hours long.
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 6, day, hour, minute).getTime()

  it('shows a whole number of hours as hours', () => {
    expect(formatMarketWindow(at(15, 14), at(15, 15))).toBe('1h · 14:00 → 15:00')
    expect(formatMarketWindow(at(15, 9), at(15, 12))).toBe('3h · 09:00 → 12:00')
  })

  it('shows a full day as 24h with midnight both ends', () => {
    expect(formatMarketWindow(at(15, 0), at(16, 0))).toBe('24h · 00:00 → 00:00')
  })

  it('shows any other span in minutes', () => {
    expect(formatMarketWindow(at(15, 14, 5), at(15, 14, 35))).toBe('30m · 14:05 → 14:35')
    expect(formatMarketWindow(at(15, 14), at(15, 15, 30))).toBe('90m · 14:00 → 15:30')
  })
})

describe('formatCountdownShort', () => {
  it('shows minutes and zero-padded seconds', () => {
    expect(formatCountdownShort(161_000)).toBe('2:41')
    expect(formatCountdownShort(5_000)).toBe('0:05')
    expect(formatCountdownShort(60_000)).toBe('1:00')
  })

  it('floors partial seconds', () => {
    expect(formatCountdownShort(161_999)).toBe('2:41')
    expect(formatCountdownShort(999)).toBe('0:00')
  })

  it('clamps at zero', () => {
    expect(formatCountdownShort(0)).toBe('0:00')
    expect(formatCountdownShort(-4_000)).toBe('0:00')
  })
})

describe('pathDirection', () => {
  it('is LONG when the path ends at or above where it starts', () => {
    expect(pathDirection(pathOf(0, 'A', [100, 90, 110]))).toBe('LONG')
    expect(pathDirection(pathOf(0, 'A', [100, 120, 100]))).toBe('LONG')
  })

  it('is SHORT when the path ends below where it starts', () => {
    expect(pathDirection(pathOf(0, 'A', [100, 120, 99]))).toBe('SHORT')
  })

  it('is LONG for an empty or one-point path', () => {
    expect(pathDirection(pathOf(0, 'A', []))).toBe('LONG')
    expect(pathDirection(pathOf(0, 'A', [100]))).toBe('LONG')
  })
})

describe('pathLabelsOf', () => {
  it('keys the name and direction by pathIndex', () => {
    const labels = pathLabelsOf([pathOf(3, 'Path C', [100, 90]), pathOf(0, 'Path A', [100, 110])])

    expect(labels).toEqual({
      3: { name: 'Path C', direction: 'SHORT' },
      0: { name: 'Path A', direction: 'LONG' },
    })
  })

  it('is empty for no paths', () => {
    expect(pathLabelsOf([])).toEqual({})
  })
})
