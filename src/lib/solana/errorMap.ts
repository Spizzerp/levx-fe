/**
 * Map from on-chain Anchor error code → user-facing message.
 *
 * The protocol defines 48 errors; this map covers the codes a real
 * end-user can plausibly hit through normal wager / exit / claim flows.
 * Admin-only errors (eigendecomp, governance, vault accounting) are
 * deliberately omitted — those callers see the raw program error.
 *
 * Pre-flight pseudo-codes (`ATA_NOT_FOUND`, `INSUFFICIENT_USDC`) live
 * here too so the FE-side guards in transactions.ts can route through
 * the same decoder and produce consistent toast text.
 */

export interface DecodedError {
  /** PascalCase IDL name, also used as a stable key. */
  name: string
  /** Short message ready to drop into a toast title or body. */
  userMessage: string
  /** Optional hint with a concrete next step. Rendered after `userMessage`. */
  hint?: string
}

/**
 * Synthetic codes for FE-side pre-flight failures. Keep distinct from
 * Anchor's 6xxx range so the routing in `describeTxError` is unambiguous.
 */
export const PREFLIGHT_CODES = {
  ATA_NOT_FOUND: 'ATA_NOT_FOUND',
  INSUFFICIENT_USDC: 'INSUFFICIENT_USDC',
} as const
export type PreflightCode = (typeof PREFLIGHT_CODES)[keyof typeof PREFLIGHT_CODES]

/**
 * Lookup keyed by Anchor's `errorCode.code` (PascalCase string), or by
 * one of the synthetic preflight codes above.
 */
export const ERROR_MAP: Readonly<Record<string, DecodedError>> = {
  // ── Pre-flight (FE-detected) ──────────────────────────────────────
  [PREFLIGHT_CODES.ATA_NOT_FOUND]: {
    name: PREFLIGHT_CODES.ATA_NOT_FOUND,
    userMessage: 'No USDC token account yet for this wallet.',
    hint: 'Use "Request test USDC" to mint your first balance.',
  },
  [PREFLIGHT_CODES.INSUFFICIENT_USDC]: {
    name: PREFLIGHT_CODES.INSUFFICIENT_USDC,
    userMessage: 'Insufficient USDC for this wager.',
    hint: 'Use "Request test USDC" or pick a smaller amount.',
  },

  // ── Wager-time errors ─────────────────────────────────────────────
  WagersNotAccepted: {
    name: 'WagersNotAccepted',
    userMessage: 'This market is not accepting wagers right now.',
    hint: 'Wagers are only accepted during Active and Sampling states.',
  },
  TradingCutoffReached: {
    name: 'TradingCutoffReached',
    userMessage: 'Trading window closed.',
    hint: 'Wagers stop after 80% of checkpoints to prevent late-information advantage.',
  },
  WagerTooSmall: {
    name: 'WagerTooSmall',
    userMessage: 'Wager too small.',
    hint: 'Increase the amount — your input rounds to zero on-chain shares.',
  },
  InvalidPathIndex: {
    name: 'InvalidPathIndex',
    userMessage: 'That path is not part of this market.',
  },
  PathDissolved: {
    name: 'PathDissolved',
    userMessage: 'Cannot wager on a dissolved path.',
    hint: 'This path deviated too far from the oracle and was eliminated.',
  },
  FeeExceedsCap: {
    name: 'FeeExceedsCap',
    userMessage: 'Fee misconfiguration on this market.',
    hint: 'Contact support — the protocol is rejecting this market\'s fee config.',
  },

  // ── Settlement / claim errors ─────────────────────────────────────
  MarketNotSettled: {
    name: 'MarketNotSettled',
    userMessage: 'Market is not yet settled — claim is unavailable.',
    hint: 'Wait for the maturity window to close, then try again.',
  },
  AlreadyClaimed: {
    name: 'AlreadyClaimed',
    userMessage: 'You have already claimed this position.',
  },
  MarketHasOpenPositions: {
    name: 'MarketHasOpenPositions',
    userMessage: 'Market still has open positions.',
    hint: 'All users must claim or exit before the market can be closed.',
  },
  MarketHasOpenPaths: {
    name: 'MarketHasOpenPaths',
    userMessage: 'Market still has path accounts.',
    hint: 'Close path chunks and path outcomes before closing the market.',
  },
  MarketVaultNotEmpty: {
    name: 'MarketVaultNotEmpty',
    userMessage: 'Market vault is not empty.',
    hint: 'Outstanding payouts must be claimed before cleanup.',
  },
  MarketDisputed: {
    name: 'MarketDisputed',
    userMessage: 'Market is paused while a settlement dispute is reviewed.',
    hint: 'Claims reopen once governance resolves the dispute or the review window times out.',
  },
  MaturityNotElapsed: {
    name: 'MaturityNotElapsed',
    userMessage: 'Maturity window is still open.',
    hint: 'The market enters its final review period before claims are available.',
  },

  // ── Slippage (already wired in PR1) ──────────────────────────────
  SlippageExceeded: {
    name: 'SlippageExceeded',
    userMessage: 'Slippage exceeded — price moved beyond your tolerance.',
    hint: 'Increase slippage in the selector or refresh the market.',
  },

  // ── Auth / generic ────────────────────────────────────────────────
  Unauthorized: {
    name: 'Unauthorized',
    userMessage: 'This wallet is not authorized for that action.',
  },
  InsufficientPaths: {
    name: 'InsufficientPaths',
    userMessage: 'Market needs at least 3 AI-generated paths before activation.',
    hint: 'The pipeline is still generating — this should resolve shortly.',
  },
  PathFreshnessExpired: {
    name: 'PathFreshnessExpired',
    userMessage: 'AI path is too old to register.',
  },
  MaxPathsReached: {
    name: 'MaxPathsReached',
    userMessage: 'Market is full — no more paths can be added.',
  },
}

/**
 * Look up an error by Anchor's PascalCase code or a preflight code.
 * Returns undefined for unknown errors so `describeTxError` can fall
 * through to the raw `.message` string.
 */
export function lookupError(code: string | undefined): DecodedError | undefined {
  if (!code) return undefined
  return ERROR_MAP[code]
}

/**
 * Format a decoded error for a toast body — `userMessage` + optional
 * hint on a second line.
 */
export function formatDecoded(decoded: DecodedError): string {
  return decoded.hint ? `${decoded.userMessage} ${decoded.hint}` : decoded.userMessage
}
