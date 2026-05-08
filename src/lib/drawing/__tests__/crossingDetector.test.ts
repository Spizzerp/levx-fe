import { describe, it, expect } from 'vitest'
import { crossingDetector } from '@/lib/drawing/crossingDetector'
import { buildCheckpointXs, checkpointIndexAtX } from '@/lib/drawing/geometry'
import type { Market } from '@/types/market'

describe('crossingDetector', () => {
  const columns = [0, 10, 20, 30, 40, 50] // simple evenly-spaced checkpoints

  it('forward stroke crossing 1 checkpoint returns 1 entry with linearly-interpolated Y', () => {
    // prev=(5, 100), curr=(15, 200). Crosses column 10 at t=0.5 → y=150
    const result = crossingDetector(5, 15, 100, 200, columns)
    expect(result).toEqual([{ index: 1, y: 150 }])
  })

  it('forward stroke crossing 3 checkpoints returns 3 entries in ascending index order', () => {
    // prev=(5, 100), curr=(35, 400). Crosses 10, 20, 30.
    const result = crossingDetector(5, 35, 100, 400, columns)
    expect(result.map((r) => r.index)).toEqual([1, 2, 3])
    // t at 10: (10-5)/30 = 1/6 → y = 100 + (1/6)*300 = 150
    // t at 20: (20-5)/30 = 0.5 → y = 250
    // t at 30: (30-5)/30 = 5/6 → y = 350
    expect(result[0].y).toBeCloseTo(150)
    expect(result[1].y).toBeCloseTo(250)
    expect(result[2].y).toBeCloseTo(350)
  })

  it('backward (right-to-left) stroke crossing 2 checkpoints returns 2 entries', () => {
    // prev=(25, 400), curr=(5, 100). Crosses 10, 20 (still in ascending index order).
    const result = crossingDetector(25, 5, 400, 100, columns)
    expect(result.map((r) => r.index)).toEqual([1, 2])
    // t at 10: (10-25)/(5-25) = 0.75 → y = 400 + 0.75*(100-400) = 175
    // t at 20: (20-25)/(5-25) = 0.25 → y = 400 + 0.25*(100-400) = 325
    expect(result[0].y).toBeCloseTo(175)
    expect(result[1].y).toBeCloseTo(325)
  })

  it('no checkpoints in range returns empty array', () => {
    // prev=(11, 100), curr=(19, 200). No column in (11, 19).
    expect(crossingDetector(11, 19, 100, 200, columns)).toEqual([])
  })

  it('vertical stroke (prevX === currX) with checkpoint exactly at X returns single entry at t=0.5', () => {
    // prev=(20, 100), curr=(20, 300). Vertical over column 20.
    const result = crossingDetector(20, 20, 100, 300, columns)
    expect(result).toHaveLength(1)
    expect(result[0].index).toBe(2)
    expect(result[0].y).toBe(200) // (100+300)/2
  })

  it('checkpoint exactly at prevX is included (start-boundary)', () => {
    const result = crossingDetector(10, 15, 100, 200, columns)
    expect(result.some((r) => r.index === 1)).toBe(true)
  })

  it('checkpoint exactly at currX is included (end-boundary)', () => {
    const result = crossingDetector(5, 10, 100, 200, columns)
    expect(result.some((r) => r.index === 1)).toBe(true)
  })

  it('all checkpoints crossed in one move returns N entries', () => {
    const result = crossingDetector(-5, 55, 0, 600, columns)
    expect(result).toHaveLength(columns.length)
    expect(result.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('fast stroke spanning many columns returns all crossings in correct index order', () => {
    const many = Array.from({ length: 100 }, (_, i) => i * 5)
    const result = crossingDetector(-1, 501, 0, 1000, many)
    expect(result).toHaveLength(100)
    expect(result[0].index).toBe(0)
    expect(result[99].index).toBe(99)
    // Check monotonic Y interpolation
    for (let i = 1; i < result.length; i++) {
      expect(result[i].y).toBeGreaterThan(result[i - 1].y)
    }
  })
})

// ---- geometry helpers ----

const mockMarket = (overrides: Partial<Market> = {}): Market => ({
  id: 'test',
  marketId: 0,
  pair: 'SOL/USDC',
  base: 'SOL',
  quote: 'USDC',
  state: 'active',
  pool: 0,
  traders: 0,
  startTime: 1_000_000,
  endTime: 1_000_000 + 48 * 30 * 60 * 1000,
  checkpointInterval: 30 * 60, // 30 minutes in seconds
  completedCheckpoints: 0,
  totalCheckpoints: 48,
  leverageEnabled: false,
  maxLeverage: 1,
  entryFeeBps: 0,
  history: [],
  paths: [],
  numPaths: 0,
  targetNumPaths: 3,
  amplitudes: [],
  lmsrShareQuantities: [],
  lmsrAlpha: 100_000,
  lambda: 0,
  decoherenceRate: 500_000,
  minimumProbability: 10_000,
  nudgeRate: 50_000,
  pathMaxAge: 3600,
  pathsScored: 0,
  pathsDissolved: 0,
  ...overrides,
})

describe('buildCheckpointXs', () => {
  it('returns array of length market.totalCheckpoints', () => {
    expect(buildCheckpointXs(mockMarket())).toHaveLength(48)
  })

  it('first entry is market.startTime', () => {
    expect(buildCheckpointXs(mockMarket())[0]).toBe(1_000_000)
  })

  it('spacing matches checkpointInterval * 1000', () => {
    const xs = buildCheckpointXs(mockMarket())
    expect(xs[1] - xs[0]).toBe(30 * 60 * 1000)
  })
})

describe('checkpointIndexAtX', () => {
  it('returns 0 for X at startTime', () => {
    expect(checkpointIndexAtX(1_000_000, mockMarket())).toBe(0)
  })

  it('returns null for X before startTime', () => {
    expect(checkpointIndexAtX(500_000, mockMarket())).toBeNull()
  })

  it('returns null for X past last checkpoint', () => {
    const m = mockMarket()
    expect(checkpointIndexAtX(m.startTime + 48 * 30 * 60 * 1000 + 1, m)).toBeNull()
  })

  it('rounds to nearest checkpoint', () => {
    const m = mockMarket()
    // halfway between checkpoint 0 and 1 → rounds to 1 (Math.round(0.5) = 1 in JS)
    expect(checkpointIndexAtX(m.startTime + 15 * 60 * 1000, m)).toBe(1)
  })
})
