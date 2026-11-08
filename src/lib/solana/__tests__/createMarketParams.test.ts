// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { SCORING_DEFAULTS } from '@/lib/scoringDefaults'
import { buildCreateMarketParams } from '@/lib/solana/createMarketParams'

const PAIR = {
  baseMint: 'So11111111111111111111111111111111111111112',
  quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  feedIdHex: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
}

function buildWithDefaults() {
  return buildCreateMarketParams({
    pair: PAIR,
    startTime: 1_800_000_000,
    endTime: 1_800_086_400,
    checkpointInterval: 360,
    pathMaxAge: 1800,
    targetNumPaths: 5,
    decoherenceRate: SCORING_DEFAULTS.decoherenceRate,
    minimumProbability: SCORING_DEFAULTS.minimumProbability,
    nudgeRate: SCORING_DEFAULTS.nudgeRate,
    lambda: SCORING_DEFAULTS.lambda,
  })
}

describe('buildCreateMarketParams', () => {
  it('scales the scoring defaults to fixed point', () => {
    const params = buildWithDefaults()

    expect(params.referenceAction.toNumber()).toBe(300)
    expect(params.weightQv.toNumber()).toBe(375_000)
    expect(params.decoherenceRate.toNumber()).toBe(20_000_000)
    expect(params.minimumProbability.toNumber()).toBe(100_000)
  })

  it('serializes referenceAction as exactly 300', () => {
    expect(buildWithDefaults().referenceAction.toString()).toBe('300')
  })

  it('creates markets with the pipeline LMSR alpha', () => {
    expect(buildWithDefaults().lmsrAlpha.toNumber()).toBe(5_000_000)
  })

  it('uses weights that sum to one in fixed point', () => {
    const params = buildWithDefaults()
    const sum =
      params.weightQv.toNumber() +
      params.weightDd.toNumber() +
      params.weightEndpoint.toNumber() +
      params.weightDisplacement.toNumber()

    expect(sum).toBe(1_000_000)
  })
})
