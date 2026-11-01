import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PublicKey, SendTransactionError } from '@solana/web3.js'
import type { Transaction, TransactionInstruction } from '@solana/web3.js'
import { LEVX_MODE2_PROGRAM_ADDRESS } from '@spizzerp/levx-mode2-client'

import type { BuildTransactionOptions } from '@/lib/chain/buildTransaction'
import { useWalletStore } from '@/stores/walletStore'

const flags = vi.hoisted(() => ({ mode2: true }))
const connection = vi.hoisted(() => ({
  getMultipleAccountsInfo: vi.fn(),
  getRecentPrioritizationFees: vi.fn(),
}))
const buildTransactionMock = vi.hoisted(() => vi.fn())
const sendAndConfirmMock = vi.hoisted(() => vi.fn())
const useProgramMock = vi.hoisted(() => vi.fn())
const logTransactionErrorMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/env/env.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/env/env.config')>()
  return {
    env: {
      ...actual.env,
      get APP_MODE2_TRADING() {
        return flags.mode2
      },
    },
  }
})

vi.mock('@solana/wallet-adapter-react', () => ({
  useConnection: () => ({ connection }),
  useWallet: vi.fn(),
  useAnchorWallet: vi.fn(),
}))

vi.mock('@/lib/solana/program', () => ({ useProgram: useProgramMock }))

// ComputeBudgetProgram's encoder (@solana/buffer-layout) rejects jsdom's Buffer, so the
// compute-budget prefix is left out here; admission.test.ts sends it through the real one (node).
vi.mock('@/lib/chain/buildTransaction', () => ({ buildTransaction: buildTransactionMock }))

vi.mock('@/lib/solana/logTransactionError', () => ({
  logTransactionError: logTransactionErrorMock,
}))

vi.mock('@/stores/toastStore', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

import { mode2Keys, useMode2Market, useOpenMode2Positions } from '../api'
import type { PathOrder } from '../precheck'
import { FIXTURE_MARKET_ID, FIXTURE_OWNER, makeView } from './fixtures'

/** 1 unit at 2× and 1 at 3× on slots 0 and 2: two positions at 2.5×. */
const ORDERS: PathOrder[] = [0, 2].map((slot) => ({
  slot,
  parts: [
    { offerSlot: 0, leverage: 2, units: 1 },
    { offerSlot: 1, leverage: 3, units: 1 },
  ],
}))
/** `getPriorityFee`'s floor, which it returns when the RPC has no recent fees. */
const FLOOR_MICRO_LAMPORTS = 10_000

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

/** The instructions of the one transaction handed to the wallet. */
function sentInstructions(): TransactionInstruction[] {
  expect(sendAndConfirmMock).toHaveBeenCalledTimes(1)
  const [tx] = sendAndConfirmMock.mock.calls[0] as [Transaction]
  return tx.instructions
}

describe('Mode 2 queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flags.mode2 = true
    connection.getMultipleAccountsInfo.mockResolvedValue([null, null])
    connection.getRecentPrioritizationFees.mockResolvedValue([])
    buildTransactionMock.mockImplementation(
      async ({ instructions }: BuildTransactionOptions) => instructions,
    )
    useProgramMock.mockReturnValue({
      provider: {
        connection,
        publicKey: new PublicKey(FIXTURE_OWNER),
        sendAndConfirm: sendAndConfirmMock,
      },
    })
    useWalletStore.setState({ publicKey: new PublicKey(FIXTURE_OWNER) })
  })

  it('is disabled while the switch is off', () => {
    flags.mode2 = false
    const { wrapper } = setup()
    const { result } = renderHook(() => useMode2Market(FIXTURE_MARKET_ID, 'pending'), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(connection.getMultipleAccountsInfo).not.toHaveBeenCalled()
  })

  it('reads the market while the switch is on', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useMode2Market(FIXTURE_MARKET_ID, 'pending'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // No cohort account: the market has no Mode 2 cohort.
    expect(result.current.data).toBeNull()
    expect(connection.getMultipleAccountsInfo).toHaveBeenCalledTimes(1)
  })

  it('invalidates Mode 2 queries when the order fails', async () => {
    const failure = new SendTransactionError({
      action: 'simulate',
      signature: '',
      transactionMessage:
        'Transaction simulation failed: Error processing Instruction 2: custom program error: 0x1775',
    })
    sendAndConfirmMock.mockRejectedValue(failure)
    const { queryClient, wrapper } = setup()
    const marketKey = mode2Keys.market(FIXTURE_MARKET_ID, FIXTURE_OWNER)
    queryClient.setQueryData(marketKey, makeView())
    const { result } = renderHook(() => useOpenMode2Positions(), { wrapper })

    act(() => result.current.mutate({ view: makeView(), orders: ORDERS, leverage: 2.5 }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryState(marketKey)?.isInvalidated).toBe(true)
    expect(logTransactionErrorMock).toHaveBeenCalledWith(
      'mode2.admitBatch failed',
      failure,
      expect.objectContaining({ connection }),
    )
    expect(toastErrorMock).toHaveBeenCalledWith('Could not open positions', {
      message: 'That leverage step just filled up',
    })
  })

  it('toasts the signature and refreshes the balances when the order lands', async () => {
    sendAndConfirmMock.mockResolvedValue('admit-sig')
    const { queryClient, wrapper } = setup()
    const marketKey = mode2Keys.market(FIXTURE_MARKET_ID, FIXTURE_OWNER)
    queryClient.setQueryData(marketKey, makeView())
    queryClient.setQueryData(['usdcBalance', FIXTURE_OWNER], { balance: 100 })
    const { result } = renderHook(() => useOpenMode2Positions(), { wrapper })

    act(() => result.current.mutate({ view: makeView(), orders: ORDERS, leverage: 2.5 }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('admit-sig')
    expect(buildTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        computeUnitLimit: 300_150,
        priorityFeeMicroLamports: FLOOR_MICRO_LAMPORTS,
      }),
    )
    const [admit] = sentInstructions()
    expect(admit.programId.toBase58()).toBe(LEVX_MODE2_PROGRAM_ADDRESS)
    expect(admit.keys[10].pubkey.toBase58()).toBe(FIXTURE_OWNER)
    expect(queryClient.getQueryState(marketKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['usdcBalance', FIXTURE_OWNER])?.isInvalidated).toBe(true)
    expect(toastSuccessMock).toHaveBeenCalledWith('Opened 2 positions at 2.5×', {
      txSig: 'admit-sig',
    })
  })
})
