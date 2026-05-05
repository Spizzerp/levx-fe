import { describe, expect, it } from 'vitest'

import { projectPredictionPathsForChart } from '@/lib/chart/projectPredictionPaths'
import type { PredictionPath } from '@/types/market'

const basePath: PredictionPath = {
  id: 'path-0',
  label: 'Path A',
  tone: 'bull',
  origin: 'ai',
  multiplier: 1,
  data: [
    { time: 0, value: 100 },
    { time: 10, value: 110 },
    { time: 20, value: 121 },
  ],
  pathIndex: 0,
  predictedPrices: [100, 110, 121],
  numCheckpoints: 3,
  generationTimestamp: 0,
  creator: '11111111111111111111111111111111',
  cumulativeAction: 0,
  compositeScore: 0,
  peakAmplitude: 0,
  amplitudeAtDecoherence: 0,
  dissolved: false,
  dissolvedAtCheckpoint: 0,
  checkpointsProcessed: 0,
  totalWagered: 0,
  totalLeveragedExposure: 0,
  lmsrSharesOutstanding: 0,
  totalTimeWeightedExposure: 0,
  currentImpliedProbability: 0,
}

describe('projectPredictionPathsForChart', () => {
  it('anchors active-market path display to the latest live price', () => {
    const [projected] = projectPredictionPathsForChart({
      predictions: [basePath],
      nowTime: 10,
      marketStart: 0,
      marketEnd: 30,
      anchorValue: 220,
    })

    expect(projected.data).toEqual([
      { time: 10, value: 220 },
      { time: 20, value: 242 },
    ])
    expect(projected.predictedPrices).toBe(basePath.predictedPrices)
    expect(basePath.data).toEqual([
      { time: 0, value: 100 },
      { time: 10, value: 110 },
      { time: 20, value: 121 },
    ])
  })

  it('returns raw paths before the market starts', () => {
    const projected = projectPredictionPathsForChart({
      predictions: [basePath],
      nowTime: -10,
      marketStart: 0,
      marketEnd: 30,
      anchorValue: 220,
    })

    expect(projected[0]).toBe(basePath)
  })
})
