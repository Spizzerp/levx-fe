/**
 * Adapters that convert Anchor-deserialized on-chain accounts
 * into the FE types defined in @/types/market.
 *
 * All fixed-point u64 fields are divided by SCALE (1_000_000).
 * Anchor BN instances are converted to plain numbers.
 * Anchor enums ({ active: {} }) are mapped to lowercase strings.
 */

import type { BN } from '@coral-xyz/anchor'

import type {
  Market,
  MarketState,
  PathOrigin,
  PredictionPath,
  PricePoint,
  UserPosition,
} from '@/types/market'
import { SCALE } from '@/lib/constants'

/** Convert Anchor BN to number, optionally dividing by SCALE for fixed-point fields. */
function bn(v: BN, scaled = false): number {
  const n = v.toNumber()
  return scaled ? n / SCALE : n
}

/** Convert i64 (signed) BN to number. */
function i64(v: BN): number {
  return v.toNumber()
}

/**
 * Parse Anchor's enum representation ({ active: {} }) to our lowercase string type.
 * Anchor enums serialize as objects with a single key whose value is {}.
 */
export function parseMarketState(raw: Record<string, unknown>): MarketState {
  const key = Object.keys(raw)[0]
  return key.toLowerCase() as MarketState
}

function parsePathOrigin(raw: Record<string, unknown>): PathOrigin {
  const key = Object.keys(raw)[0]
  return key === 'userDrawn' ? 'user' : 'ai'
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function anchorMarketToFE(raw: any, id: string): Market {
  const marketId = bn(raw.marketId)
  const numPaths = raw.numPaths as number
  const startTimeMs = i64(raw.startTime) * 1000
  const endTimeMs = i64(raw.endTime) * 1000

  return {
    id,
    marketId,
    // Pair info is resolved externally (from ProtocolState.supported_pairs or a lookup).
    // For now, use mint addresses as fallback.
    pair: '',
    base: '',
    quote: '',
    state: parseMarketState(raw.state),
    pool: bn(raw.totalPool, true),
    traders: raw.numPositions,
    startTime: startTimeMs,
    endTime: endTimeMs,
    checkpointInterval: raw.checkpointInterval,
    completedCheckpoints: raw.completedCheckpoints,
    totalCheckpoints: raw.totalCheckpoints,
    leverageEnabled: raw.leverageEnabled,
    maxLeverage: raw.maxLeverage,
    entryFeeBps: raw.feeEntryBpsOverride ?? 0,
    history: [],
    paths: [],
    numPaths,
    amplitudes: (raw.amplitudes as BN[]).slice(0, numPaths).map((a) => bn(a, true)),
    lmsrShareQuantities: (raw.lmsrShareQuantities as BN[]).slice(0, numPaths).map((q) => i64(q)),
    lambda: bn(raw.lambda, true),
    decoherenceRate: bn(raw.decoherenceRate, true),
    minimumProbability: bn(raw.minimumProbability, true),
    nudgeRate: bn(raw.nudgeRate, true),
    pathMaxAge: i64(raw.pathMaxAge),
    pathsScored: raw.pathsScored,
    pathsDissolved: raw.pathsDissolved,
  }
}

export function anchorPathToFE(raw: any, marketStartTime: number, checkpointInterval: number): PredictionPath {
  const predictedPrices: number[] = (raw.predictedPrices as BN[]).map((p) => bn(p, true))
  const intervalMs = checkpointInterval * 1000

  const data: PricePoint[] = predictedPrices.map((price, i) => ({
    time: marketStartTime + i * intervalMs,
    value: price,
  }))

  return {
    id: `path-${raw.pathIndex}`,
    label: `Path ${String.fromCharCode(65 + raw.pathIndex)}`,
    tone: 'neutral', // derived later from price trajectory
    origin: parsePathOrigin(raw.generationMethod),
    multiplier: 0, // computed from LMSR pricing
    data,
    pathIndex: raw.pathIndex,
    predictedPrices,
    numCheckpoints: raw.numCheckpoints,
    initialProbabilityBps: raw.initialProbabilityBps,
    generationTimestamp: i64(raw.generationTimestamp) * 1000,
    creator: raw.creator.toBase58(),
    cumulativeAction: bn(raw.cumulativeAction, true),
    compositeScore: bn(raw.compositeScore, true),
    peakAmplitude: bn(raw.peakAmplitude, true),
    amplitudeAtDecoherence: bn(raw.amplitudeAtDecoherence, true),
    dissolved: raw.dissolved,
    dissolvedAtCheckpoint: raw.dissolvedAtCheckpoint,
    checkpointsProcessed: raw.checkpointsProcessed,
    totalWagered: bn(raw.totalWagered, true),
    totalLeveragedExposure: bn(raw.totalLeveragedExposure, true),
    lmsrSharesOutstanding: bn(raw.lmsrSharesOutstanding, true),
    totalTimeWeightedExposure: bn(raw.totalTimeWeightedExposure, true),
    currentImpliedProbability: raw.currentImpliedProbability,
  }
}

export function anchorPositionToFE(
  raw: any,
  marketId: string,
  pathLabel: string,
  pathTone: PredictionPath['tone'],
  pathDissolved: boolean,
): UserPosition {
  return {
    marketId,
    pathId: `path-${raw.pathIndex}`,
    pathLabel,
    pathTone,
    collateral: bn(raw.collateral, true),
    leverage: raw.leverage,
    exposure: bn(raw.notionalExposure, true),
    entryMultiplier: bn(raw.costBasis, true) > 0
      ? bn(raw.lmsrShares, true) / bn(raw.costBasis, true)
      : 0,
    entryTime: 0, // not directly stored on-chain; could derive from entered_at_checkpoint
    estimatedPayout: bn(raw.finalPayout, true),
    dissolved: pathDissolved,
    claimed: raw.claimed,
  }
}
