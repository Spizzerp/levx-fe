import { describe, it, expect } from 'vitest'

import {
  sampleBezierAtCheckpoints,
  type BezierAnchor,
} from '@/lib/drawing/bezierSampling'

describe('sampleBezierAtCheckpoints', () => {
  it('returns empty array when fewer than 2 anchors', () => {
    expect(sampleBezierAtCheckpoints([], [0, 1, 2], -1000, 1000)).toEqual([])
    const single: BezierAnchor[] = [{ domainX: 0, domainY: 100, outHandle: null }]
    expect(sampleBezierAtCheckpoints(single, [0, 1, 2], -1000, 1000)).toEqual([])
  })

  it('two corner anchors produce a straight-line interpolation', () => {
    // Corner-only anchors → control points collapse to anchors → cubic
    // degenerates to a straight line in y vs t. Since x is also linear in t
    // for a degenerate cubic with collapsed handles, y vs x is also linear.
    const anchors: BezierAnchor[] = [
      { domainX: 0, domainY: 100, outHandle: null },
      { domainX: 10, domainY: 200, outHandle: null },
    ]
    const checkpointXs = [0, 2.5, 5, 7.5, 10]
    const out = sampleBezierAtCheckpoints(anchors, checkpointXs, -1000, 1000)
    expect(out).toHaveLength(5)
    expect(out[0].y).toBeCloseTo(100, 1)
    expect(out[1].y).toBeCloseTo(125, 0)
    expect(out[2].y).toBeCloseTo(150, 0)
    expect(out[3].y).toBeCloseTo(175, 0)
    expect(out[4].y).toBeCloseTo(200, 1)
  })

  it('skips checkpoints outside the anchor x-range', () => {
    const anchors: BezierAnchor[] = [
      { domainX: 5, domainY: 100, outHandle: null },
      { domainX: 10, domainY: 200, outHandle: null },
    ]
    const checkpointXs = [0, 2, 5, 7, 10, 12, 15]
    const out = sampleBezierAtCheckpoints(anchors, checkpointXs, -1000, 1000)
    // Only indices 2, 3, 4 (xs = 5, 7, 10) should be sampled.
    const indices = out.map((c) => c.index)
    expect(indices).toEqual([2, 3, 4])
  })

  it('clamps sampled y to the supplied range', () => {
    const anchors: BezierAnchor[] = [
      { domainX: 0, domainY: 1000, outHandle: null },
      { domainX: 10, domainY: 2000, outHandle: null },
    ]
    const out = sampleBezierAtCheckpoints(anchors, [5], 0, 500)
    expect(out[0].y).toBe(500)
  })

  it('honors smooth handles to produce a curve, not a line', () => {
    // Anchors at (0, 100) and (10, 100). A straight line through both is
    // y = 100 everywhere. A cubic with handles pulled "up" should bow above
    // the endpoints' y at the midpoint.
    const anchors: BezierAnchor[] = [
      // Outgoing handle pulled upward
      { domainX: 0, domainY: 100, outHandle: { domainX: 3, domainY: 200 } },
      // Outgoing handle of right anchor goes further right; mirror gives an
      // incoming handle pulled upward and to the left.
      { domainX: 10, domainY: 100, outHandle: { domainX: 13, domainY: 100 } },
    ]
    const out = sampleBezierAtCheckpoints(anchors, [5], -1000, 1000)
    expect(out[0].y).toBeGreaterThan(100)
  })

  it('does not double-write a checkpoint shared between adjacent segments', () => {
    // Three anchors with checkpoint exactly at the middle anchor's x.
    const anchors: BezierAnchor[] = [
      { domainX: 0, domainY: 100, outHandle: null },
      { domainX: 5, domainY: 150, outHandle: null },
      { domainX: 10, domainY: 200, outHandle: null },
    ]
    const out = sampleBezierAtCheckpoints(anchors, [5], -1000, 1000)
    expect(out).toHaveLength(1)
    expect(out[0].index).toBe(0)
  })

  it('handles a 3-anchor path: samples cover the full x-span', () => {
    const anchors: BezierAnchor[] = [
      { domainX: 0, domainY: 0, outHandle: null },
      { domainX: 10, domainY: 100, outHandle: null },
      { domainX: 20, domainY: 0, outHandle: null },
    ]
    const checkpointXs = [0, 5, 10, 15, 20]
    const out = sampleBezierAtCheckpoints(anchors, checkpointXs, -1000, 1000)
    expect(out).toHaveLength(5)
    expect(out.map((c) => c.index)).toEqual([0, 1, 2, 3, 4])
    // Symmetry check: index 1 and index 3 should be approximately equal.
    expect(out[1].y).toBeCloseTo(out[3].y, 1)
  })
})
