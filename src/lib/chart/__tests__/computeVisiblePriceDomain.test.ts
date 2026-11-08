import { describe, expect, it } from 'vitest'

import { computeVisiblePriceDomain } from '@/lib/chart/computeVisiblePriceDomain'
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'

const startTime = 1_700_000_000_000
const [path] = buildAiPathFixture({
  startTime,
  checkpointInterval: 600,
  totalCheckpoints: 6,
  basePrice: 100,
})
const viewport: [number, number] = [startTime, startTime + 3_000_000]
const chainMax = Math.max(...path.data.map((p) => p.value))

describe('computeVisiblePriceDomain', () => {
  it('widens to a displayData point above every checkpoint point', () => {
    const peak = chainMax + 10
    const displayData = [...path.data, { time: startTime + 300_000, value: peak }].sort(
      (a, b) => a.time - b.time,
    )
    const [, hi] = computeVisiblePriceDomain([], [{ ...path, displayData }], viewport)
    expect(hi).toBeCloseTo(peak * 1.05, 9)
  })

  it('uses the checkpoint points without displayData', () => {
    const [, hi] = computeVisiblePriceDomain([], [path], viewport)
    expect(hi).toBeCloseTo(chainMax * 1.05, 9)
  })
})
