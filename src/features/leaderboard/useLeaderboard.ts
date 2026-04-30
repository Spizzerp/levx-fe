import { useQuery } from '@tanstack/react-query'

import { getReadOnlyProgram } from '@/lib/solana/program'
import { SCALE } from '@/lib/constants'
import { aggregatePositions, type RawPosition } from './aggregate'
import type { LeaderboardEntry } from './data'

/**
 * In-memory leaderboard. Reads every Position PDA via
 * `getProgramAccounts`, normalizes, then groups by user.
 *
 * Devnet position counts are small (low hundreds at most), so this is
 * fine. As volume grows past a few thousand positions a single
 * `getProgramAccounts` call gets slow and may be rate-limited; the
 * fix is an indexer (Helius webhooks → Postgres) feeding a
 * pre-aggregated row set. Tracked as a future-work TODO.
 *
 * Cached for 60s. PR2's `MarketSettled` / `ClaimPaid` invalidations
 * already touch `['userPositions']`; the leaderboard sits on a
 * sibling key so it doesn't refresh on every per-user write.
 */
export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const program = getReadOnlyProgram()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accs: { account: any }[] = await program.account.position.all()
      const raws: (RawPosition & { marketId: string })[] = []
      for (const a of accs) {
        const r = a.account
        try {
          raws.push({
            user: r.user.toBase58(),
            marketId: r.market.toBase58(),
            collateral: Number(r.collateral) / SCALE,
            finalPayout: Number(r.finalPayout) / SCALE,
            claimed: !!r.claimed,
            // The Position account doesn't carry a per-position
            // `dissolved` bit; the path's `dissolved` is the source of
            // truth. For leaderboard P&L, treating non-claimed as
            // un-realized (regardless of dissolved) is simpler and
            // doesn't punish unclaimed losers in the standings.
            dissolved: false,
          })
        } catch {
          // Skip positions we can't deserialize cleanly.
        }
      }
      return aggregatePositions(raws)
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
