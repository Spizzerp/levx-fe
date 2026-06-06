import { PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'

import type { MarketGroupKind, MarketGroupStatus } from '@/types/market'

export const DEFAULT_PUBKEY = new PublicKey('11111111111111111111111111111111')

export const MARKET_GROUP_CONSTRAINT_FLAGS = {
  pair: 1 << 0,
  feed: 1 << 1,
  timeWindow: 1 << 2,
  timeframeMask: 1 << 3,
} as const

export const MARKET_GROUP_TIMEFRAME_BITS: Record<number, number> = {
  900: 1 << 0,
  3_600: 1 << 1,
  14_400: 1 << 2,
  86_400: 1 << 3,
  604_800: 1 << 4,
}

export const MARKET_GROUP_TIMEFRAME_OPTIONS = [
  { value: 900, label: '15m' },
  { value: 3_600, label: '1h' },
  { value: 14_400, label: '4h' },
  { value: 86_400, label: '1d' },
  { value: 604_800, label: '1w' },
] as const

export const MARKET_GROUP_KIND_OPTIONS: { value: MarketGroupKind; label: string }[] = [
  { value: 'root', label: 'Root' },
  { value: 'league', label: 'League' },
  { value: 'season', label: 'Season' },
  { value: 'game', label: 'Game' },
  { value: 'event', label: 'Event' },
  { value: 'assetSeason', label: 'Asset season' },
  { value: 'horizon', label: 'Horizon' },
  { value: 'custom', label: 'Custom' },
]

export const MARKET_GROUP_STATUS_OPTIONS: { value: MarketGroupStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'retired', label: 'Retired' },
]

export function normalizeBytes32Hex(input: string): string {
  const hex = input.trim().startsWith('0x') ? input.trim().slice(2) : input.trim()
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('Expected a 32-byte hex string')
  }
  return hex.toLowerCase()
}

export function bytes32HexToArray(input: string): number[] {
  const hex = normalizeBytes32Hex(input)
  return Array.from({ length: 32 }, (_, index) => parseInt(hex.slice(index * 2, index * 2 + 2), 16))
}

export function isBytes32Hex(input: string): boolean {
  try {
    normalizeBytes32Hex(input)
    return true
  } catch {
    return false
  }
}

export function anchorEnum(value: MarketGroupKind | MarketGroupStatus): Record<string, object> {
  return { [value]: {} }
}

export type MarketGroupConstraintFormValues = {
  pairEnabled: boolean
  feedEnabled: boolean
  timeWindowEnabled: boolean
  timeframeMaskEnabled: boolean
  baseMint: string
  quoteMint: string
  pythFeedId: string
  startTime: string
  endTime: string
  timeframeSeconds: number[]
}

export type MarketGroupConstraintParams = {
  baseMint: PublicKey
  quoteMint: PublicKey
  pythFeedId: number[]
  constraintFlags: number
  startTime: BN
  endTime: BN
  allowedTimeframesMask: number
}

function parseLocalDateTimeSeconds(value: string, fieldName: string): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${fieldName} is required`)
  }
  return Math.floor(timestamp / 1000)
}

function parsePublicKey(value: string, fieldName: string): PublicKey {
  try {
    return new PublicKey(value.trim())
  } catch {
    throw new Error(`${fieldName} must be a valid public key`)
  }
}

export function buildMarketGroupConstraintParams(
  values: MarketGroupConstraintFormValues,
): MarketGroupConstraintParams {
  let constraintFlags = 0
  let baseMint = DEFAULT_PUBKEY
  let quoteMint = DEFAULT_PUBKEY
  let pythFeedId = Array(32).fill(0)
  let startTime = 0
  let endTime = 0
  let allowedTimeframesMask = 0

  if (values.pairEnabled) {
    if (!values.baseMint.trim() || !values.quoteMint.trim()) {
      throw new Error('Base and quote mints are required')
    }
    constraintFlags |= MARKET_GROUP_CONSTRAINT_FLAGS.pair
    baseMint = parsePublicKey(values.baseMint, 'Base mint')
    quoteMint = parsePublicKey(values.quoteMint, 'Quote mint')
  }

  if (values.feedEnabled) {
    if (!values.pythFeedId.trim()) {
      throw new Error('Pyth feed id is required')
    }
    constraintFlags |= MARKET_GROUP_CONSTRAINT_FLAGS.feed
    pythFeedId = bytes32HexToArray(values.pythFeedId)
  }

  if (values.timeWindowEnabled) {
    constraintFlags |= MARKET_GROUP_CONSTRAINT_FLAGS.timeWindow
    startTime = parseLocalDateTimeSeconds(values.startTime, 'Start time')
    endTime = parseLocalDateTimeSeconds(values.endTime, 'End time')
    if (endTime <= startTime) {
      throw new Error('End time must be after start time')
    }
  }

  if (values.timeframeMaskEnabled) {
    if (values.timeframeSeconds.length === 0) {
      throw new Error('Select at least one timeframe')
    }
    constraintFlags |= MARKET_GROUP_CONSTRAINT_FLAGS.timeframeMask
    allowedTimeframesMask = values.timeframeSeconds.reduce((mask, timeframeSeconds) => {
      const bit = MARKET_GROUP_TIMEFRAME_BITS[timeframeSeconds]
      if (!bit) {
        throw new Error(`Unsupported timeframe: ${timeframeSeconds}`)
      }
      return mask | bit
    }, 0)
  }

  return {
    baseMint,
    quoteMint,
    pythFeedId,
    constraintFlags,
    startTime: new BN(startTime),
    endTime: new BN(endTime),
    allowedTimeframesMask,
  }
}
