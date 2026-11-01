/**
 * The connected trader's leveraged positions in a market: the receipt from the market view and,
 * once the keeper has paid and closed it, the payment from the receipt address's history.
 */
import { useConnection } from '@solana/wallet-adapter-react'
import type { Address } from '@solana/kit'
import {
  associatedTokenAddress,
  cohortPda,
  groupPda,
  mode1MarketPda,
  positionPda,
} from '@spizzerp/levx-mode2-client'
import { useQuery } from '@tanstack/react-query'
import { env } from '@/env/env.config'
import { useNowTick } from '@/lib/hooks/useNowTick'
import { useWalletStore } from '@/stores/walletStore'
import type { Market } from '@/types/market'
import { mode2Keys } from './api'
import { fetchReceiptHistory } from './history'
import { summarizePosition } from './position'
import type { PositionSummary } from './position'
import type { Mode2Forecasts, Mode2MarketView } from './types'

/** The start is the only moment the status reads the clock; the view refetches as often before it. */
const STATUS_TICK_MS = 5_000
/** A history with the admissions but no claim yet, behind the view that saw the receipt close. */
const UNPAID_REFETCH_MS = 15_000
/** A market has one group (T1), so a closed group's receipts were in group 0. */
const SOLE_GROUP_INDEX = 0
/** The key's market id while the market is still loading. */
const NO_MARKET = -1

/**
 * The receipt address and the owner's ATA: from the view's group and epoch while they exist, else
 * derived from the market, since the keeper closes both right after paying (Ruling 18).
 */
function historyAddresses(
  market: Market,
  view: Mode2MarketView | null,
  owner: Address,
): { receipt: Address; ata: Address } {
  const group =
    (view?.group?.address as Address | undefined) ??
    groupPda(cohortPda(mode1MarketPda(BigInt(market.marketId))), SOLE_GROUP_INDEX)
  const mint = view?.epoch?.data.mint ?? (market.quoteMint as Address)
  return { receipt: positionPda(group, owner), ata: associatedTokenAddress(owner, mint) }
}

/** Null while the market or the view is loading (undefined). */
export function useMode2Position(
  market: Market | undefined,
  view: Mode2MarketView | null | undefined,
  forecasts: Mode2Forecasts | null | undefined,
): PositionSummary | null {
  const owner = useWalletStore((s) => s.publicKey)?.toBase58() ?? null
  const { connection } = useConnection()
  const nowMs = useNowTick(STATUS_TICK_MS)
  const history = useQuery({
    queryKey: mode2Keys.history(market?.marketId ?? NO_MARKET, owner),
    queryFn: () => {
      const { receipt, ata } = historyAddresses(market!, view ?? null, owner as Address)
      return fetchReceiptHistory(connection, receipt, ata)
    },
    // Before the start an absent receipt has nothing to show; after it, it may have been paid. A
    // view still loading (undefined) may hold the receipt; a null one means the cohort is gone.
    enabled:
      env.APP_MODE2_TRADING &&
      market !== undefined &&
      owner !== null &&
      nowMs >= market.startTime &&
      view !== undefined &&
      (view === null || view.receipt === null),
    staleTime: (query) => (query.state.data?.paid != null ? Infinity : 0),
    refetchInterval: (query) => (query.state.data?.paid === null ? UNPAID_REFETCH_MS : false),
  })
  if (market === undefined || view === undefined) return null
  return summarizePosition(view, forecasts ?? null, history.data ?? null, market.state, nowMs)
}
