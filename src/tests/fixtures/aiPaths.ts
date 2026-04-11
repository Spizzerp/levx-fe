/** Test fixture factory for AI candidate paths.
 *  Used by LevXChart and MarketPage tests.
 *  Populated in Plan 01-03 (TimeRangePicker + fixture factory plan).
 *
 *  PATHS-05 on-chain half is deferred to Phase 3.
 */
import type { PredictionPath, PathTone, PricePoint } from '@/types/market'

export interface BuildAiPathFixtureArgs {
  startTime: number // unix ms
  checkpointInterval: number // seconds
  totalCheckpoints: number
  basePrice: number
}

const TONES: readonly PathTone[] = ['ultra-bull', 'bull', 'neutral', 'bear', 'ultra-bear']

const MULTIPLIERS: Record<PathTone, number> = {
  'ultra-bull': 1.5,
  bull: 1.8,
  neutral: 2.2,
  bear: 1.8,
  'ultra-bear': 1.5,
  custom: 1.0,
}

/** Deterministic slope per tone, as fractional price change across the full range. */
const TONE_SLOPES: Record<PathTone, number> = {
  'ultra-bull': 0.2,
  bull: 0.08,
  neutral: 0.0,
  bear: -0.08,
  'ultra-bear': -0.2,
  custom: 0,
}

/** Build a deterministic, test-friendly set of 5 AI candidate paths. */
export function buildAiPathFixture(args: BuildAiPathFixtureArgs): PredictionPath[] {
  const { startTime, checkpointInterval, totalCheckpoints, basePrice } = args
  const intervalMs = checkpointInterval * 1000
  return TONES.map((tone, toneIdx) => {
    const slope = TONE_SLOPES[tone]
    const data: PricePoint[] = Array.from({ length: totalCheckpoints }, (_, i) => {
      const t = i / Math.max(1, totalCheckpoints - 1) // 0..1
      // Small deterministic wiggle so paths aren't perfectly linear
      const wiggle = Math.sin((i + toneIdx) * 0.35) * basePrice * 0.01
      return {
        time: startTime + i * intervalMs,
        value: basePrice * (1 + slope * t) + wiggle,
      }
    })
    return {
      id: `ai-${tone}`,
      label: `Path ${String.fromCharCode(65 + toneIdx)}`, // A..E
      tone,
      origin: 'ai',
      multiplier: MULTIPLIERS[tone],
      data,
    }
  })
}
