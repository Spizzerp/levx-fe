import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PublicKey, SendTransactionError } from '@solana/web3.js'
import type { Transaction, TransactionInstruction } from '@solana/web3.js'
import {
  COMPUTE_BUDGET_IX_CU,
  CU_CEILINGS,
  LEVX_MODE2_PROGRAM_ADDRESS,
} from '@spizzerp/levx-mode2-client'

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

import {
  ADMIT_FEE_LAMPORTS,
  mode2Keys,
  mode2MarketRefetchMs,
  useMode2Market,
  useOpenMode2Positions,
} from '../api'
import type { PathOrder } from '../precheck'
import type { Mode2MarketView } from '../types'
import { FIXTURE_MARKET_ID, FIXTURE_OWNER, FIXTURE_START_MS, makeGroup, makeView } from './fixtures'

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
const MICRO_LAMPORTS_PER_LAMPORT = 1_000_000
const SIGNATURE_FEE_LAMPORTS = 5_000
const MINUTE_MS = 60_000
const FAST_MS = 5_000
const SLOW_MS = 60_000

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
    const { result } = renderHook(
      () => useMode2Market(FIXTURE_MARKET_ID, 'pending', FIXTURE_START_MS),
      { wrapper },
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(connection.getMultipleAccountsInfo).not.toHaveBeenCalled()
  })

  it('reads the market while the switch is on', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => useMode2Market(FIXTURE_MARKET_ID, 'pending', FIXTURE_START_MS),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // No cohort account: the market has no Mode 2 cohort.
    expect(result.current.data).toBeNull()
    expect(connection.getMultipleAccountsInfo).toHaveBeenCalledTimes(1)
  })

  describe('polling the market (spec §5)', () => {
    /** The market without a cohort yet: every read finds no account. */
    function renderNoCohort(startMs: number) {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      const { wrapper } = setup()
      renderHook(() => useMode2Market(FIXTURE_MARKET_ID, 'pending', startMs), { wrapper })
    }
    const reads = () => connection.getMultipleAccountsInfo.mock.calls.length

    afterEach(() => {
      vi.useRealTimers()
    })

    it('reads every 5 s while the market starts within 10 minutes', async () => {
      renderNoCohort(Date.now() + 5 * MINUTE_MS)
      await vi.advanceTimersByTimeAsync(0)
      expect(reads()).toBe(1)

      await vi.advanceTimersByTimeAsync(FAST_MS)
      expect(reads()).toBe(2)
    })

    it('reads every 60 s while the start is further out', async () => {
      renderNoCohort(Date.now() + 20 * MINUTE_MS)
      await vi.advanceTimersByTimeAsync(0)
      expect(reads()).toBe(1)

      await vi.advanceTimersByTimeAsync(FAST_MS)
      expect(reads()).toBe(1)
      await vi.advanceTimersByTimeAsync(SLOW_MS - FAST_MS)
      expect(reads()).toBe(2)
    })
  })

  describe('while the owner changes', () => {
    /** A second wallet: a fixed address that is nobody's. */
    const OTHER_OWNER = 'MQik1CL4pkMV5LJ6g17Dy5kzDtrzdBDazr55PHVWt7Z'

    /** The view already read for `owner` on `marketId`; every new read stays in flight. */
    function renderWithView(owner: string | null, marketId = FIXTURE_MARKET_ID) {
      connection.getMultipleAccountsInfo.mockReturnValue(new Promise(() => {}))
      useWalletStore.setState({ publicKey: owner === null ? null : new PublicKey(owner) })
      const { queryClient, wrapper } = setup()
      const view = makeView({ owner })
      queryClient.setQueryData(mode2Keys.market(marketId, owner), view)
      const hook = renderHook(({ id }) => useMode2Market(id, 'pending', FIXTURE_START_MS), {
        wrapper,
        initialProps: { id: marketId },
      })
      expect(hook.result.current.data).toBe(view)
      return { ...hook, view }
    }

    it("keeps the view across a wallet connect while the owner's view loads", () => {
      const { result, view } = renderWithView(null)

      act(() => useWalletStore.setState({ publicKey: new PublicKey(FIXTURE_OWNER) }))

      expect(result.current.isPlaceholderData).toBe(true)
      expect(result.current.data).toBe(view)
    })

    it("shows no view of the previous owner's after an account switch", () => {
      const { result } = renderWithView(FIXTURE_OWNER)

      act(() => useWalletStore.setState({ publicKey: new PublicKey(OTHER_OWNER) }))

      expect(result.current.data).toBeUndefined()
    })

    it("shows no view of another market's while disconnected", () => {
      const { result, rerender } = renderWithView(null)

      rerender({ id: FIXTURE_MARKET_ID + 1 })

      expect(result.current.data).toBeUndefined()
    })
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

describe('mode2MarketRefetchMs', () => {
  /** The group not bound yet: entry is waiting for the paths. */
  function waitingView(): Mode2MarketView {
    const view = makeView()
    return { ...view, group: { ...view.group!, data: makeGroup({ bound: 0 }) } }
  }

  it('is 5 s while entry is open', () => {
    // 15 minutes before the start: the open entry alone sets the pace.
    const nowMs = FIXTURE_START_MS - 15 * MINUTE_MS
    expect(mode2MarketRefetchMs(makeView(), 'pending', FIXTURE_START_MS, nowMs)).toBe(FAST_MS)
  })

  it('is 5 s while the market is pending within 10 minutes of the start', () => {
    const nowMs = FIXTURE_START_MS - 5 * MINUTE_MS
    expect(mode2MarketRefetchMs(waitingView(), 'pending', FIXTURE_START_MS, nowMs)).toBe(FAST_MS)
    // Without a cohort the Mode 1 market's start counts.
    const edgeMs = FIXTURE_START_MS - 10 * MINUTE_MS
    expect(mode2MarketRefetchMs(null, 'pending', FIXTURE_START_MS, edgeMs)).toBe(FAST_MS)
  })

  it("counts the cohort's start when the market has one", () => {
    const nowMs = FIXTURE_START_MS - 5 * MINUTE_MS
    const laterMs = FIXTURE_START_MS + 60 * MINUTE_MS
    expect(mode2MarketRefetchMs(waitingView(), 'pending', laterMs, nowMs)).toBe(FAST_MS)
  })

  it('is 60 s while the market is pending further out or past its start', () => {
    const farMs = FIXTURE_START_MS - 15 * MINUTE_MS
    expect(mode2MarketRefetchMs(waitingView(), 'pending', FIXTURE_START_MS, farMs)).toBe(SLOW_MS)
    const edgeMs = FIXTURE_START_MS - 10 * MINUTE_MS - 1
    expect(mode2MarketRefetchMs(null, 'pending', FIXTURE_START_MS, edgeMs)).toBe(SLOW_MS)
    const lateMs = FIXTURE_START_MS + 1_000
    expect(mode2MarketRefetchMs(null, 'pending', FIXTURE_START_MS, lateMs)).toBe(SLOW_MS)
  })

  it('is 60 s while the market runs or once it has ended', () => {
    const nowMs = FIXTURE_START_MS + 5 * MINUTE_MS
    for (const state of [
      'active',
      'sampling',
      'settling',
      'maturing',
      'settled',
      'void',
    ] as const) {
      expect(mode2MarketRefetchMs(makeView(), state, FIXTURE_START_MS, nowMs), state).toBe(SLOW_MS)
    }
  })
})

describe('ADMIT_FEE_LAMPORTS', () => {
  it("covers a certified group's admission at the priority-fee floor", () => {
    const computeUnits = CU_CEILINGS.admitCertified + COMPUTE_BUDGET_IX_CU
    const priorityLamports = Math.ceil(
      (computeUnits * FLOOR_MICRO_LAMPORTS) / MICRO_LAMPORTS_PER_LAMPORT,
    )
    expect(ADMIT_FEE_LAMPORTS).toBeGreaterThanOrEqual(SIGNATURE_FEE_LAMPORTS + priorityLamports)
  })
})
