import { BN, type IdlTypes } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'

import type { Levx } from '@/idl/levx'
import { SCALE } from '@/lib/constants'
import { SCORING_DEFAULTS } from '@/lib/scoringDefaults'

export type CreateMarketParams = IdlTypes<Levx>['createMarketParams']

export interface CreateMarketParamsInput {
  pair: { baseMint: string; quoteMint: string; feedIdHex: string }
  /** Unix seconds. */
  startTime: number
  /** Unix seconds. */
  endTime: number
  /** Seconds. */
  checkpointInterval: number
  /** Seconds. */
  pathMaxAge: number
  targetNumPaths: number
  decoherenceRate: number
  minimumProbability: number
  nudgeRate: number
  lambda: number
}

/**
 * Decode a Pyth feed id (0x-prefixed or bare 64-char hex) into the
 * 32-byte array the IDL expects. Throws on malformed input — callers
 * should validate up front and surface a friendly toast rather than
 * relying on the throw.
 */
export function feedIdToBytes(hexFeedId: string): number[] {
  const hex = hexFeedId.startsWith('0x') ? hexFeedId.slice(2) : hexFeedId
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`Pyth feed id must be 64 hex chars (got ${hex.length})`)
  }
  const bytes: number[] = []
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

function scaled(value: number): BN {
  return new BN(Math.round(value * SCALE))
}

/**
 * The `create_market` / `create_market_under_group` params. Action
 * alpha/beta, the reference action and the four scoring weights come from
 * `SCORING_DEFAULTS`; the rest from the admin form.
 */
export function buildCreateMarketParams(input: CreateMarketParamsInput): CreateMarketParams {
  return {
    baseMint: new PublicKey(input.pair.baseMint),
    quoteMint: new PublicKey(input.pair.quoteMint),
    pythFeedId: feedIdToBytes(input.pair.feedIdHex),
    startTime: new BN(input.startTime),
    endTime: new BN(input.endTime),
    checkpointInterval: input.checkpointInterval,
    actionAlpha: scaled(SCORING_DEFAULTS.actionAlpha),
    actionBeta: scaled(SCORING_DEFAULTS.actionBeta),
    decoherenceRate: scaled(input.decoherenceRate),
    minimumProbability: scaled(input.minimumProbability),
    nudgeRate: scaled(input.nudgeRate),
    pathMaxAge: new BN(input.pathMaxAge),
    targetNumPaths: input.targetNumPaths,
    lambda: scaled(input.lambda),
    referenceAction: scaled(SCORING_DEFAULTS.referenceAction),
    weightQv: scaled(SCORING_DEFAULTS.weightQv),
    weightDd: scaled(SCORING_DEFAULTS.weightDd),
    weightEndpoint: scaled(SCORING_DEFAULTS.weightEndpoint),
    weightDisplacement: scaled(SCORING_DEFAULTS.weightDisplacement),
    lmsrAlpha: new BN(1_000_000),
  }
}
