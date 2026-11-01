/**
 * React Query hooks for the Mode 2 trade panel: the market's custody accounts, the cohort's
 * forecasts, the wallet's SOL, and the mutation that opens the trader's positions.
 */
import type { AnchorProvider } from '@coral-xyz/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import { getPositionReceiptSize } from '@spizzerp/levx-mode2-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { env } from '@/env/env.config'
import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'
import { logTransactionError } from '@/lib/solana/logTransactionError'
import { useProgram } from '@/lib/solana/program'
import { toast } from '@/stores/toastStore'
import { useWalletStore } from '@/stores/walletStore'
import type { MarketState } from '@/types/market'
import { buildAdmitInstruction, positionCount } from './admission'
import { fetchMode2Forecasts, fetchMode2Market } from './chain'
import { describeMode2Error } from './errors'
import type { PathOrder } from './precheck'
import type { Mode2Forecasts, Mode2MarketView } from './types'

/** The admission's signature fee plus a margin for the priority fee, in lamports. */
export const ADMIT_FEE_LAMPORTS = 10_000

export const mode2Keys = {
  market: (marketId: number, owner: string | null) => ['mode2', 'market', marketId, owner] as const,
  forecasts: (marketId: number) => ['mode2', 'forecasts', marketId] as const,
  history: (marketId: number, owner: string | null) =>
    ['mode2', 'history', marketId, owner] as const,
}

/** The key's market id while the query is disabled for want of one. */
const NO_MARKET = -1
const PENDING_REFETCH_MS = 5_000
const LIVE_REFETCH_MS = 15_000
const IDLE_REFETCH_MS = 60_000
const BALANCE_REFETCH_MS = 30_000
const LIVE_STATES: ReadonlySet<MarketState> = new Set([
  'active',
  'sampling',
  'settling',
  'maturing',
])

function marketRefetchMs(marketState: MarketState | undefined): number {
  if (marketState === 'pending') return PENDING_REFETCH_MS
  return marketState !== undefined && LIVE_STATES.has(marketState)
    ? LIVE_REFETCH_MS
    : IDLE_REFETCH_MS
}

/** The market's custody accounts for the connected wallet; null when the market has no cohort. */
export function useMode2Market(
  marketId: number | undefined,
  marketState: MarketState | undefined,
): UseQueryResult<Mode2MarketView | null> {
  const owner = useWalletStore((s) => s.publicKey)?.toBase58() ?? null
  const { connection } = useConnection()
  return useQuery({
    queryKey: mode2Keys.market(marketId ?? NO_MARKET, owner),
    queryFn: () => fetchMode2Market(connection, marketId!, owner),
    enabled: env.APP_MODE2_TRADING && marketId !== undefined,
    refetchInterval: marketRefetchMs(marketState),
  })
}

/**
 * The cohort's forecasts, fixed once complete. Until then they are polled at the pending cadence:
 * the key does not change when the view's `forecastMask` fills.
 */
export function useMode2Forecasts(
  view: Mode2MarketView | null | undefined,
): UseQueryResult<Mode2Forecasts | null> {
  const { connection } = useConnection()
  return useQuery({
    queryKey: mode2Keys.forecasts(view?.marketId ?? NO_MARKET),
    queryFn: () => fetchMode2Forecasts(connection, view!),
    enabled: view != null,
    staleTime: (query) => (query.state.data ? Infinity : 0),
    refetchInterval: (query) => (query.state.data ? false : PENDING_REFETCH_MS),
  })
}

/** The connected wallet's SOL and a new position receipt's rent, in lamports; null while unknown. */
export function useWalletFunds(): { lamports: number | null; rentLamports: number | null } {
  const wallet = useWalletStore((s) => s.publicKey)
  const owner = wallet?.toBase58() ?? null
  const { connection } = useConnection()
  const balance = useQuery({
    queryKey: ['mode2', 'lamports', owner],
    queryFn: () => connection.getBalance(wallet!),
    enabled: wallet !== null,
    refetchInterval: BALANCE_REFETCH_MS,
  })
  const rent = useQuery({
    queryKey: ['mode2', 'receiptRent'],
    queryFn: () => connection.getMinimumBalanceForRentExemption(getPositionReceiptSize()),
    enabled: wallet !== null,
    staleTime: Infinity,
  })
  if (wallet === null) return { lamports: null, rentLamports: null }
  return { lamports: balance.data ?? null, rentLamports: rent.data ?? null }
}

export interface OpenPositionsInput {
  view: Mode2MarketView
  orders: PathOrder[]
  /** The leverage on the slider, for the toast. */
  leverage: number
}

/** Opens the orders' positions in one `admit_batch`, signed and paid for by the connected wallet. */
export function useOpenMode2Positions(): UseMutationResult<string, Error, OpenPositionsInput> {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ view, orders }: OpenPositionsInput) => {
      if (!program) throw new Error('Wallet not connected')
      const provider = program.provider as AnchorProvider
      const { instruction, computeUnitLimit } = buildAdmitInstruction(
        view,
        provider.publicKey.toBase58(),
        orders,
      )
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const tx = new Transaction().add(
        ...(await buildTransaction({
          instructions: [instruction],
          computeUnitLimit,
          priorityFeeMicroLamports,
        })),
      )
      try {
        return await provider.sendAndConfirm(tx)
      } catch (err) {
        await logTransactionError('mode2.admitBatch failed', err, {
          connection: provider.connection,
          details: { marketId: view.marketId, orders, computeUnitLimit, priorityFeeMicroLamports },
        })
        throw err
      }
    },
    onSuccess: (signature, { orders, leverage }) => {
      void queryClient.invalidateQueries({ queryKey: ['mode2'] })
      void queryClient.invalidateQueries({ queryKey: ['usdcBalance'] })
      const n = positionCount(orders)
      toast.success(
        `Opened ${n} ${n === 1 ? 'position' : 'positions'} at ${leverage.toFixed(1)}×`,
        {
          txSig: signature,
        },
      )
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['mode2'] })
      toast.error('Could not open positions', { message: describeMode2Error(err) })
    },
  })
}
