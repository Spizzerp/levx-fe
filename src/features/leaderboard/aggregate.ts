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
  /** True if the path was dissolved (position is worthless). */
  dissolved: boolean
}

interface Aggregate {
  user: string
  totalWagered: number
  realizedPayout: number
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
 * Aggregate per-user. P&L = `realizedPayout - totalWagered`. Accuracy =
 * `settledWins / settledCount` (0 when no settled positions yet, so a
 * fresh wallet doesn't display NaN%). Sorted by realized P&L desc.
 *
 * `score` is realized P&L (in dollars, post-SCALE) — surfaced in the
 * existing `Podium` and `LeaderboardTable` columns.
 */
export function aggregatePositions(
  positions: ReadonlyArray<RawPosition & { marketId: string }>,
): LeaderboardEntry[] {
  const byUser = new Map<string, Aggregate>()

  for (const pos of positions) {
    if (pos.dissolved) {
      // Dissolved positions still count toward "wagered" (capital was
      // committed) but contribute zero payout.
    }
    let agg = byUser.get(pos.user)
    if (!agg) {
      agg = {
        user: pos.user,
        totalWagered: 0,
        realizedPayout: 0,
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
      agg.settledCount += 1
      if (pos.finalPayout > pos.collateral) agg.settledWins += 1
    }
  }

  const entries: LeaderboardEntry[] = []
  for (const a of byUser.values()) {
    const score = a.realizedPayout - a.totalWagered
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
