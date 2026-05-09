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

const warnedLegacyTargetNumPaths = new Set<number>()

export function anchorMarketToFE(raw: any, id: string): Market {
  const marketId = bn(raw.marketId)
  const numPaths = raw.numPaths as number
  const targetNumPaths = targetNumPathsOrLegacy(raw, marketId)
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
    vault: raw.vault.toBase58(),
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
    targetNumPaths,
    amplitudes: (raw.amplitudes as BN[]).slice(0, numPaths).map((a) => bn(a, true)),
    lmsrShareQuantities: (raw.lmsrShareQuantities as BN[]).slice(0, numPaths).map((q) => i64(q)),
    lmsrAlpha: bn(raw.lmsrAlpha, true),
    lambda: bn(raw.lambda, true),
    decoherenceRate: bn(raw.decoherenceRate, true),
    minimumProbability: bn(raw.minimumProbability, true),
    nudgeRate: bn(raw.nudgeRate, true),
    pathMaxAge: i64(raw.pathMaxAge),
    pathsScored: raw.pathsScored,
    pathsDissolved: raw.pathsDissolved,
  }
}

function targetNumPathsOrLegacy(raw: Record<string, unknown>, marketId: number): number {
  if (typeof raw.targetNumPaths === 'number') return raw.targetNumPaths

  if (!warnedLegacyTargetNumPaths.has(marketId)) {
    warnedLegacyTargetNumPaths.add(marketId)
    console.warn(
      `[onchain] Market ${marketId} missing targetNumPaths; falling back to legacy target=3`,
    )
  }
  return 3
}

export function anchorPathToFE(raw: any, marketStartTime: number, checkpointInterval: number): PredictionPath {
  const predictedPrices: number[] = ((raw.predictedPrices ?? []) as BN[]).map((p) => bn(p, true))
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
    generationTimestamp: i64(raw.generationTimestamp) * 1000,
    creator: raw.creator.toBase58(),
    cumulativeAction: bn(raw.cumulativeAction, true),
    compositeScore: bn(raw.compositeScore, true),
    peakAmplitude: bn(raw.peakAmplitude, true),
    amplitudeAtDecoherence: bn(raw.amplitudeAtDecoherence, true),
    dissolved: raw.dissolved,
    dissolvedAtCheckpoint: raw.dissolvedAtCheckpoint,
    checkpointsProcessed: raw.checkpointsProcessed,
    createdAtCheckpoint: raw.createdAtCheckpoint,
    firstActiveCheckpoint: raw.firstActiveCheckpoint,
    totalWagered: bn(raw.totalWagered, true),
    totalLeveragedExposure: bn(raw.totalLeveragedExposure, true),
    lmsrSharesOutstanding: bn(raw.lmsrSharesOutstanding, true),
    totalTimeWeightedExposure: bn(raw.totalTimeWeightedExposure, true),
    currentImpliedProbability: raw.currentImpliedProbability,
    initialAmplitude: bn(raw.initialAmplitude, true),
  }
}

export interface PositionContext {
  marketIdNum: number
  marketState: MarketState
  pair: string
  base: string
  quote: string
  pathLabel: string
  pathTone: PredictionPath['tone']
  pathDissolved: boolean
  /**
   * Display value for the "EST PAYOUT" / "PAYOUT" column. Caller computes
   * per state (see callers in onchain.ts):
   *   - claimed → realized `final_payout` from chain
   *   - dissolved → 0
   *   - void & unclaimed → `collateral` (refund)
   *   - otherwise → LMSR-based mark-to-market via `estimateLmsrExitPayout`
   *
   * `final_payout` is initialized to 0 by `place_wager` and only written
   * by `exit_position` / `claim`, so reading it directly would show $0
   * P&L on every active and settled-but-unclaimed row.
   */
  estimatedPayout: number
}

export function anchorPositionToFE(raw: any, ctx: PositionContext): UserPosition {
  const pathIndex = raw.pathIndex as number
  const marketId = String(ctx.marketIdNum)
  return {
    id: `${ctx.marketIdNum}-${pathIndex}`,
    marketId,
    marketIdNum: ctx.marketIdNum,
    marketState: ctx.marketState,
    pair: ctx.pair,
    base: ctx.base,
    quote: ctx.quote,
    pathId: `path-${pathIndex}`,
    pathIndex,
    pathLabel: ctx.pathLabel,
    pathTone: ctx.pathTone,
    collateral: bn(raw.collateral, true),
    leverage: raw.leverage,
    exposure: bn(raw.notionalExposure, true),
    entryMultiplier: bn(raw.costBasis, true) > 0
      ? bn(raw.lmsrShares, true) / bn(raw.costBasis, true)
      : 0,
    entryTime: 0, // not directly stored on-chain; could derive from entered_at_checkpoint
    estimatedPayout: ctx.estimatedPayout,
    dissolved: ctx.pathDissolved,
    claimed: raw.claimed,
  }
}
