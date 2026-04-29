/**
 * Shared types for markets, paths, and price data.
 *
 * These mirror the on-chain account schemas from the LevX program IDL
 * (LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV on devnet).
 * Fixed-point u64 fields are converted to plain numbers on the read
 * boundary; Pubkeys are stored as base-58 strings.
 */

/* ── Enums ─────────────────────────────────────────────────── */

/** Matches on-chain MarketState enum exactly. */
export type MarketState =
  | 'pending'
  | 'active'
  | 'sampling'
  | 'settling'
  | 'maturing'
  | 'settled'
  | 'void'

/**
 * UI-only concept for colour-coding paths by directional sentiment.
 * Not stored on-chain — derived from the path's price trajectory.
 */
export type PathTone = 'ultra-bull' | 'bull' | 'neutral' | 'bear' | 'ultra-bear' | 'custom'

/** Maps to on-chain PathOrigin enum: Ai → 'ai', UserDrawn → 'user'. */
export type PathOrigin = 'ai' | 'user'

/* ── Price data ────────────────────────────────────────────── */

export interface PricePoint {
  /** unix ms */
  time: number
  /** price in quote units (e.g. USDC) */
  value: number
}

/* ── Prediction paths ──────────────────────────────────────── */

/**
 * Frontend representation of an on-chain PathOutcome account + its
 * off-chain checkpoint data. Fields marked "on-chain" come from the
 * PathOutcome PDA; the rest are derived or UI-only.
 */
export interface PredictionPath {
  id: string
  label: string
  /** UI-only: derived from price trajectory direction */
  tone: PathTone
  /** on-chain: PathOrigin (Ai | UserDrawn) */
  origin: PathOrigin
  /** LMSR price multiplier — payout per USDC wagered (derived from shares) */
  multiplier: number
  /** Resolved price trajectory for chart rendering */
  data: PricePoint[]

  /* ── On-chain PathOutcome fields ─────────────────────────── */

  /** on-chain path_index (0..15) */
  pathIndex: number
  /** On-chain predicted prices (fixed-point u64 / 1M). One per checkpoint. */
  predictedPrices: number[]
  /** Number of checkpoints in this path */
  numCheckpoints: number
  /** unix ms — when the path was generated */
  generationTimestamp: number
  /** Creator pubkey (base-58) */
  creator: string

  /* ── Settlement / scoring (populated during market lifecycle) ── */

  /** Cumulative action S = Σ[α(Δp)² + β(Δv)²]. Lower = better fit. */
  cumulativeAction: number
  /** Final composite score (0-1_000_000). Displayed to users as a 0-100 Path Accuracy Score. */
  compositeScore: number
  /** Highest amplitude this path reached */
  peakAmplitude: number
  /** Amplitude when path decohered (0 if still alive) */
  amplitudeAtDecoherence: number
  /** True if path has been dissolved (deviated too far) */
  dissolved: boolean
  /** Checkpoint index at which dissolution occurred */
  dissolvedAtCheckpoint: number
  /** Number of checkpoints processed via check_dissolution */
  checkpointsProcessed: number

  /* ── Wagering state ──────────────────────────────────────── */

  /** Total USDC wagered on this path */
  totalWagered: number
  /** Total leveraged exposure on this path */
  totalLeveragedExposure: number
  /** Outstanding LMSR shares */
  lmsrSharesOutstanding: number
  /** Time-weighted exposure accumulator for settlement scoring */
  totalTimeWeightedExposure: number
  /** Current implied probability in basis points */
  currentImpliedProbability: number

  /* ── Client-only ────────────────────────────────────────── */

  /** Tracks on-chain persistence for user-drawn paths. Undefined = confirmed. */
  onChainStatus?: 'pending' | 'confirmed'
}

/* ── Market ────────────────────────────────────────────────── */

export interface Market {
  id: string
  /** On-chain market_id (u64) */
  marketId: number
  pair: string // "BTC/USDC"
  base: string // "BTC"
  quote: string // "USDC"
  state: MarketState

  pool: number // USDC (on-chain: total_pool)
  traders: number // on-chain: num_positions

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

  /* ── On-chain LMSR / quantum pricing fields ──────────────── */

  /** Number of registered paths (0..16) */
  numPaths: number
  /** Born-rule amplitudes per path (up to 16) */
  amplitudes: number[]
  /** LMSR share quantities per path (up to 16, signed) */
  lmsrShareQuantities: number[]
  /** LMSR liquidity parameter `b` (already divided by SCALE). Drives cost-function curvature. */
  lmsrAlpha: number
  /** Quantum coupling strength (0 = pure LMSR) */
  lambda: number
  /** Rate at which deviating paths decohere */
  decoherenceRate: number
  /** Minimum Born probability below which a path decoheres (fixed-point) */
  minimumProbability: number
  /** LMSR oracle nudge rate (fixed-point fraction, e.g. 0.05 = 5%) */
  nudgeRate: number
  /** Max age (seconds) for AI paths at activation time */
  pathMaxAge: number

  /* ── Settlement tracking ─────────────────────────────────── */

  /** Number of paths that have been scored during settling */
  pathsScored: number
  /** Number of dissolved paths */
  pathsDissolved: number
}

/* ── User position ─────────────────────────────────────────── */

/**
 * Frontend representation of a user's wager on a market.
 * On-chain this would mirror a Position PDA; the indexer joins in path
 * label/tone for display.
 */
export interface UserPosition {
  marketId: string
  /** Path the user wagered on */
  pathId: string
  pathLabel: string
  pathTone: PathTone
  /** USDC committed (collateral) */
  collateral: number
  /** Leverage multiplier (1 if leverage disabled on the market) */
  leverage: number
  /** Effective exposure = collateral × leverage */
  exposure: number
  /** LMSR multiplier locked at entry — payout per USDC if path wins */
  entryMultiplier: number
  /** unix ms */
  entryTime: number
  /** Live payout estimate (settled = realized; otherwise = mark-to-market) */
  estimatedPayout: number
  /** True if path was dissolved → position is worthless */
  dissolved: boolean
  /** True once `claim` has been called and funds withdrawn */
  claimed: boolean
}

export interface CurrentPrice {
  pair: string
  value: number
  /** change over last 24h in basis points (100 = 1%) */
  delta24hBps: number
  /** unix ms */
  timestamp: number
}
