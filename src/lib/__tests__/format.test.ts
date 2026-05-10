import { describe, expect, it } from 'vitest'

import { formatPathAccuracyScore, formatPrice, pathAccuracyScoreFromComposite } from '@/lib/format'

describe('formatPrice', () => {
  it('always renders two decimal places for spot prices', () => {
    expect(formatPrice(96)).toBe('96.00')
    expect(formatPrice(72_856.43)).toBe('72,856.43')
  })
})

describe('pathAccuracyScoreFromComposite', () => {
  it('provides the reusable numeric Path Accuracy Score', () => {
    expect(pathAccuracyScoreFromComposite(0)).toBe(0)
    expect(pathAccuracyScoreFromComposite(367_879)).toBe(36.7879)
    expect(pathAccuracyScoreFromComposite(1_000_000)).toBe(100)
  })

  it('clamps values before returning the numeric score', () => {
    expect(pathAccuracyScoreFromComposite(-10)).toBe(0)
    expect(pathAccuracyScoreFromComposite(1_500_000)).toBe(100)
  })
})

describe('formatPathAccuracyScore', () => {
  it('maps on-chain composite scores to a 0-100 display score', () => {
    expect(formatPathAccuracyScore(0)).toBe('0.0')
    expect(formatPathAccuracyScore(367_879)).toBe('36.8')
    expect(formatPathAccuracyScore(875_500)).toBe('87.5')
    expect(formatPathAccuracyScore(1_000_000)).toBe('100.0')
  })

  it('clamps unexpected values to the public display range', () => {
    expect(formatPathAccuracyScore(-10)).toBe('0.0')
    expect(formatPathAccuracyScore(1_500_000)).toBe('100.0')
  })
})
