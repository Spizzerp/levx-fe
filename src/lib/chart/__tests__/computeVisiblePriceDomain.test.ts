import { describe, expect, it } from 'vitest'

import {
  computeVisiblePriceDomain,
  MIN_VISIBLE_SPAN_FRACTION,
  PRICE_DOMAIN_PAD_ABOVE,
  PRICE_DOMAIN_PAD_BELOW,
} from '@/lib/chart/computeVisiblePriceDomain'
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
const chainMin = Math.min(...path.data.map((p) => p.value))

describe('computeVisiblePriceDomain', () => {
  it('widens to a displayData point above every checkpoint point', () => {
    const peak = chainMax + 10
    const displayData = [...path.data, { time: startTime + 300_000, value: peak }].sort(
      (a, b) => a.time - b.time,
    )
    const [, hi] = computeVisiblePriceDomain([], [{ ...path, displayData }], viewport)
    expect(hi).toBeCloseTo(peak + (peak - chainMin) * PRICE_DOMAIN_PAD_ABOVE, 9)
  })

  it('uses the checkpoint points without displayData', () => {
    const [, hi] = computeVisiblePriceDomain([], [path], viewport)
    expect(hi).toBeCloseTo(chainMax + (chainMax - chainMin) * PRICE_DOMAIN_PAD_ABOVE, 9)
  })

  it('pads by a share of the visible spread, so a narrow fan still fills the chart', () => {
    // A 1 % spread around 71: padding by a share of the price (the old 0.9x / 1.05x) left the
    // fan under a tenth of the chart height.
    const history = [
      { time: startTime, value: 70.65 },
      { time: startTime + 600_000, value: 71.35 },
    ]
    const [lo, hi] = computeVisiblePriceDomain(history, [], viewport)
    const span = 71.35 - 70.65
    expect(lo).toBeCloseTo(70.65 - span * PRICE_DOMAIN_PAD_BELOW, 9)
    expect(hi).toBeCloseTo(71.35 + span * PRICE_DOMAIN_PAD_ABOVE, 9)
    expect(span / (hi - lo)).toBeGreaterThan(0.4)
  })

  it('keeps a minimum span around a flat series', () => {
    const history = [
      { time: startTime, value: 100 },
      { time: startTime + 600_000, value: 100 },
    ]
    const [lo, hi] = computeVisiblePriceDomain(history, [], viewport)
    const minSpan = 100 * MIN_VISIBLE_SPAN_FRACTION
    expect(lo).toBeCloseTo(100 - minSpan / 2 - minSpan * PRICE_DOMAIN_PAD_BELOW, 9)
    expect(hi).toBeCloseTo(100 + minSpan / 2 + minSpan * PRICE_DOMAIN_PAD_ABOVE, 9)
  })
})
