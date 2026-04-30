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
          // Use `BN.toNumber()` rather than `Number(BN)` for consistency
          // with the rest of the read layer (see `src/lib/api/adapters.ts`)
          // and to avoid the silent precision loss when amounts approach
          // 2^53. SCALE is 1e6, so positions up to ~9 PB collateral are
          // safe — well past anything we'll see at devnet scale.
          raws.push({
            user: r.user.toBase58(),
            marketId: r.market.toBase58(),
            collateral: r.collateral.toNumber() / SCALE,
            finalPayout: r.finalPayout.toNumber() / SCALE,
            claimed: !!r.claimed,
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
