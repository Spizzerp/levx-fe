/** Test fixture factory for AI candidate paths.
 *  Generates realistic random-walk price trajectories per tone.
 */
import type { PredictionPath, PathTone, PricePoint } from '@/types/market'

export interface BuildAiPathFixtureArgs {
  startTime: number // unix ms
  checkpointInterval: number // seconds
  totalCheckpoints: number
  basePrice: number
}

const TONES: readonly PathTone[] = ['ultra-bull', 'bull', 'neutral', 'bear', 'ultra-bear']

const PROVIDER_NAMES: readonly string[] = ['Chronos-2', 'TimesFM', 'GJR-GARCH', 'Merton JD', 'Monte Carlo']

const MULTIPLIERS: Record<PathTone, number> = {
  'ultra-bull': 1.5,
  bull: 1.8,
  neutral: 2.2,
  bear: 1.8,
  'ultra-bear': 1.5,
  custom: 1.0,
}

/** Drift per step as fraction of price. Positive = bullish. */
const TONE_DRIFT: Record<PathTone, number> = {
  'ultra-bull': 0.0012,
  bull: 0.0005,
  neutral: 0.0,
  bear: -0.0005,
  'ultra-bear': -0.0012,
  custom: 0,
}

/** Volatility per step as fraction of price. */
const TONE_VOL: Record<PathTone, number> = {
  'ultra-bull': 0.008,
  bull: 0.006,
  neutral: 0.005,
  bear: 0.006,
  'ultra-bear': 0.008,
  custom: 0.005,
}

/** Seeded pseudo-random number generator (mulberry32). Deterministic per seed. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller transform: uniform [0,1) → normal distribution. */
function normalRandom(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2)
}

const PATH_OUTCOME_DEFAULTS = {
  creator: '11111111111111111111111111111111',
  cumulativeAction: 0,
  compositeScore: 0,
  peakAmplitude: 1_000_000,
  amplitudeAtDecoherence: 0,
  dissolved: false,
  dissolvedAtCheckpoint: 0,
  checkpointsProcessed: 0,
  totalWagered: 0,
  totalLeveragedExposure: 0,
  lmsrSharesOutstanding: 0,
  currentImpliedProbability: 2000,
} as const

/** Build a deterministic set of 5 AI candidate paths with realistic random-walk trajectories. */
export function buildAiPathFixture(args: BuildAiPathFixtureArgs): PredictionPath[] {
  const { startTime, checkpointInterval, totalCheckpoints, basePrice } = args
  const intervalMs = checkpointInterval * 1000

  return TONES.map((tone, toneIdx) => {
    const drift = TONE_DRIFT[tone]
    const vol = TONE_VOL[tone]
    // Deterministic seed per tone so paths are stable across re-renders
    const rng = mulberry32(toneIdx * 7919 + 42)

    let price = basePrice
    const data: PricePoint[] = Array.from({ length: totalCheckpoints }, (_, i) => {
      if (i > 0) {
        // Geometric random walk: price * (1 + drift + vol * Z)
        const z = normalRandom(rng)
        const ret = drift + vol * z
        price = price * (1 + ret)
      }
      return {
        time: startTime + i * intervalMs,
        value: price,
      }
    })

    return {
      id: `ai-${tone}`,
      label: `${PROVIDER_NAMES[toneIdx % PROVIDER_NAMES.length]} Path`,
      tone,
      origin: 'ai' as const,
      multiplier: MULTIPLIERS[tone],
      data,
      pathIndex: toneIdx,
      predictedPrices: data.map((d) => d.value),
      numCheckpoints: totalCheckpoints,
      initialProbabilityBps: Math.round(10_000 / TONES.length),
      generationTimestamp: startTime,
      ...PATH_OUTCOME_DEFAULTS,
    }
  })
}
