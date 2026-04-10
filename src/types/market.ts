/**
 * Shared types for markets, paths, and price data.
 *
 * These match the on-chain account schema (§4 of the architecture doc)
 * as closely as the UI needs — we intentionally flatten/adapt the fields
 * the backend will send. Anything the protocol stores as fixed-point u64
 * is converted to a plain number on the read boundary.
 */

export type MarketState =
  | 'pending'
  | 'active'
  | 'sampling'
  | 'settling'
  | 'maturing'
  | 'settled'
  | 'void'

export type PathTone = 'ultra-bull' | 'bull' | 'neutral' | 'bear' | 'ultra-bear' | 'custom'

export type PathOrigin = 'ai' | 'user'

export interface PricePoint {
  /** unix ms */
  time: number
  /** price in quote units (e.g. USDC) */
  value: number
}

export interface PredictionPath {
  id: string
  label: string
  tone: PathTone
  origin: PathOrigin
  /** LMSR price multiplier — payout per USDC wagered */
  multiplier: number
  data: PricePoint[]
}

export interface Market {
  id: string
  pair: string // "BTC/USDC"
  base: string // "BTC"
  quote: string // "USDC"
  state: MarketState

  pool: number // USDC
  traders: number

  /** unix ms */
  startTime: number
  /** unix ms */
  endTime: number
  /** seconds */
  checkpointInterval: number
  completedCheckpoints: number
  totalCheckpoints: number

  leverageEnabled: boolean
  maxLeverage: number
  entryFeeBps: number

  history: PricePoint[]
  paths: PredictionPath[]
}

export interface CurrentPrice {
  pair: string
  value: number
  /** change over last 24h in basis points (100 = 1%) */
  delta24hBps: number
  /** unix ms */
  timestamp: number
}
