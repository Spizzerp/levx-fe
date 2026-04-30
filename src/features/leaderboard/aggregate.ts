/**
 * Pure aggregation: turns raw on-chain Position accounts into
 * `LeaderboardEntry[]` for the leaderboard surface.
 *
 * Devnet positions are small enough (low hundreds at most) for an
 * in-process group-by to be fine. Once volume grows we'll need an
 * indexer — see TODO in `useLeaderboard.ts`.
 */

import type { LeaderboardEntry } from './data'

export interface RawPosition {
  /** Owner pubkey (base-58). Used as the group-by key. */
  user: string
  /** USDC committed to the wager (post-fee). */
  collateral: number
  /** Realized payout when the position has been claimed; 0 otherwise. */
  finalPayout: number
  /** True if the user has called `claim` and the program wrote `final_payout`. */
  claimed: boolean
}

interface Aggregate {
  user: string
  /** Sum of collateral across all positions, claimed or not. UI only — not used for the score. */
  totalWagered: number
  /** Sum of `final_payout` for claimed positions only. */
  realizedPayout: number
  /**
   * Sum of `collateral` for the subset of positions that have realized
   * (`claimed=true`). Used as the negative side of `score = realizedPayout
   * - realizedWagered` so unclaimed positions don't drag a wallet's
   * leaderboard rank into the negative until they claim.
   */
  realizedWagered: number
  marketsTouched: Set<string>
  settledCount: number
  settledWins: number
}

/** Truncated mid-pubkey form used for display, e.g. `7K4D…9XQ2`. */
function truncate(pubkey: string): string {
  if (pubkey.length <= 12) return pubkey
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`
}

/**
 * Aggregate per-user. Score = `realizedPayout - realizedWagered`
 * (claimed positions only — open positions don't drag rank until they
 * claim). Accuracy = `settledWins / settledCount` (0 when no settled
 * positions yet, so a fresh wallet doesn't display NaN%). Sorted by
 * score desc.
 */
export function aggregatePositions(
  positions: ReadonlyArray<RawPosition & { marketId: string }>,
): LeaderboardEntry[] {
  const byUser = new Map<string, Aggregate>()

  for (const pos of positions) {
    let agg = byUser.get(pos.user)
    if (!agg) {
      agg = {
        user: pos.user,
        totalWagered: 0,
        realizedPayout: 0,
        realizedWagered: 0,
        marketsTouched: new Set(),
        settledCount: 0,
        settledWins: 0,
      }
      byUser.set(pos.user, agg)
    }
    agg.totalWagered += pos.collateral
    agg.marketsTouched.add(pos.marketId)
    if (pos.claimed) {
      agg.realizedPayout += pos.finalPayout
      agg.realizedWagered += pos.collateral
      agg.settledCount += 1
      if (pos.finalPayout > pos.collateral) agg.settledWins += 1
    }
  }

  const entries: LeaderboardEntry[] = []
  for (const a of byUser.values()) {
    // Score = realized P&L only. Open positions don't count until they
    // claim — otherwise an active wallet shows as a full loss equal to
    // its collateral until settlement, which is wrong.
    const score = a.realizedPayout - a.realizedWagered
    const accuracy = a.settledCount === 0 ? 0 : (a.settledWins / a.settledCount) * 100
    entries.push({
      rank: 0, // assigned after sort
      user: truncate(a.user),
      score,
      accuracy,
      markets: a.marketsTouched.size,
      // Avatar slot derived from the pubkey string so a given user
      // gets a stable avatar across renders. 9 slots match the
      // existing Podium/Table layout.
      avatarIdx: deterministicAvatar(a.user),
    })
  }

  entries.sort((a, b) => b.score - a.score)
  for (let i = 0; i < entries.length; i++) entries[i].rank = i + 1
  return entries
}

function deterministicAvatar(pubkey: string): number {
  let h = 0
  for (let i = 0; i < pubkey.length; i++) h = (h * 31 + pubkey.charCodeAt(i)) | 0
  return Math.abs(h) % 9
}
