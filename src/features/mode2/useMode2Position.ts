/**
 * The connected trader's leveraged positions in a market: the receipt from the market view and,
 * once the keeper has paid and closed it, the payment from the receipt address's history.
 */
import { useConnection } from '@solana/wallet-adapter-react'
import type { Address } from '@solana/kit'
import { associatedTokenAddress, positionPda } from '@spizzerp/levx-mode2-client'
import { useQuery } from '@tanstack/react-query'
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

export function useMode2Position(
  market: Market,
  view: Mode2MarketView | null | undefined,
  forecasts: Mode2Forecasts | null | undefined,
): PositionSummary | null {
  const owner = useWalletStore((s) => s.publicKey)?.toBase58() ?? null
  const { connection } = useConnection()
  const nowMs = useNowTick(STATUS_TICK_MS)
  const group = view?.group ?? null
  const epoch = view?.epoch ?? null
  const history = useQuery({
    queryKey: mode2Keys.history(market.marketId, owner),
    queryFn: () =>
      fetchReceiptHistory(
        connection,
        positionPda(group!.address as Address, owner as Address),
        associatedTokenAddress(owner as Address, epoch!.data.mint),
      ),
    // Before the start an absent receipt has nothing to show; after it, it may have been paid.
    enabled:
      owner !== null &&
      group !== null &&
      epoch !== null &&
      view?.receipt === null &&
      nowMs >= market.startTime,
    staleTime: (query) => (query.state.data?.paid != null ? Infinity : 0),
    refetchInterval: (query) => (query.state.data?.paid === null ? UNPAID_REFETCH_MS : false),
  })
  if (view == null) return null
  return summarizePosition(view, forecasts ?? null, history.data ?? null, market.state, nowMs)
}
