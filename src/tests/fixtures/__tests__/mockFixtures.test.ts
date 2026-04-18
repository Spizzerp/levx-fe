import { describe, it, expect } from 'vitest'
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'

const args = {
  startTime: 1_000_000_000_000,
  checkpointInterval: 30 * 60, // 30 min in seconds
  totalCheckpoints: 48,
  basePrice: 100,
}

describe('buildAiPathFixture', () => {
  it('returns a PredictionPath[] of length 5', () => {
    expect(buildAiPathFixture(args)).toHaveLength(5)
  })

  it('each fixture path has values at every checkpoint X', () => {
    const paths = buildAiPathFixture(args)
    for (const p of paths) {
      expect(p.data).toHaveLength(48)
      for (const point of p.data) {
        expect(typeof point.time).toBe('number')
        expect(typeof point.value).toBe('number')
        expect(Number.isFinite(point.value)).toBe(true)
      }
    }
  })

  it('fixture paths span all tones (ultra-bull through ultra-bear)', () => {
    const tones = buildAiPathFixture(args).map((p) => p.tone)
    expect(tones).toEqual(['ultra-bull', 'bull', 'neutral', 'bear', 'ultra-bear'])
  })

  it('paths are labeled with the model-provider names', () => {
    const labels = buildAiPathFixture(args).map((p) => p.label)
    expect(labels).toEqual([
      'Chronos-2 Path',
      'TimesFM Path',
      'GJR-GARCH Path',
      'Merton JD Path',
      'Monte Carlo Path',
    ])
  })

  it('is deterministic — same args produce identical output', () => {
    const a = buildAiPathFixture(args)
    const b = buildAiPathFixture(args)
    expect(a).toEqual(b)
  })
})
