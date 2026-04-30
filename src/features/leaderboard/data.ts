export interface LeaderboardEntry {
  rank: number
  /** Truncated wallet pubkey for display, e.g. `7K4D…9XQ2`. */
  user: string
  /** Realized P&L (USDC, post-SCALE). Negative for losing wallets. */
  score: number
  /** % of settled positions that paid more than collateral. 0 when no settled positions yet. */
  accuracy: number
  /** Distinct markets the wallet has touched. */
  markets: number
  /** Stable avatar slot index in [0, 9). Derived from pubkey hash. */
  avatarIdx: number
}
