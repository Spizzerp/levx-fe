import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PublicKey } from '@solana/web3.js'
import type { Address } from '@solana/kit'
import {
  associatedTokenAddress,
  cohortPda,
  groupPda,
  mode1MarketPda,
  positionPda,
} from '@spizzerp/levx-mode2-client'

import { useWalletStore } from '@/stores/walletStore'
import type { Market } from '@/types/market'
import type { ReceiptHistory } from '../history'
import type { Mode2MarketView } from '../types'

const flags = vi.hoisted(() => ({ mode2: true }))
const connection = vi.hoisted(() => ({}))
const fetchReceiptHistoryMock = vi.hoisted(() => vi.fn())

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
}))
vi.mock('@/features/mode2/history', () => ({ fetchReceiptHistory: fetchReceiptHistoryMock }))

import { useMode2Position } from '../useMode2Position'
import { FIXTURE_MARKET_ID, FIXTURE_OWNER, FIXTURE_START_MS, makeView } from './fixtures'

/** A second wallet: a fixed address that is nobody's. */
const OTHER_OWNER = 'MQik1CL4pkMV5LJ6g17Dy5kzDtrzdBDazr55PHVWt7Z' as Address

const VIEW = makeView()
const MINT = VIEW.epoch!.data.mint
const MARKET = {
  marketId: FIXTURE_MARKET_ID,
  state: 'settled',
  startTime: FIXTURE_START_MS,
  quoteMint: MINT as string,
} as Market
const AFTER_START_MS = FIXTURE_START_MS + 3_600_000
const receiptOf = (owner: Address) => positionPda(VIEW.group!.address as Address, owner)

/** The receipt address and ATA a closed market's lookup derives without any custody account. */
const DERIVED_RECEIPT = positionPda(
  groupPda(cohortPda(mode1MarketPda(BigInt(FIXTURE_MARKET_ID))), 0),
  FIXTURE_OWNER,
)
const DERIVED_ATA = associatedTokenAddress(FIXTURE_OWNER, MINT)

/** The first owner was paid 29.70 USDC on 20; the second never traded. */
const PAID: ReceiptHistory = { principal: 20_000_000n, paid: 29_700_000n, claimSignature: 'claim' }

function connect(owner: Address) {
  useWalletStore.setState({ publicKey: new PublicKey(owner) })
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function renderPosition(view: Mode2MarketView | null | undefined) {
  return renderHook(({ view: v }) => useMode2Position(MARKET, v, null), {
    wrapper,
    initialProps: { view },
  })
}

/** Lets a query that was going to fetch on mount do so. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

describe('useMode2Position', () => {
  beforeEach(() => {
    flags.mode2 = true
    vi.useFakeTimers({ toFake: ['Date'] })
    fetchReceiptHistoryMock
      .mockReset()
      .mockImplementation(async (_connection, receipt: string) =>
        receipt === receiptOf(FIXTURE_OWNER) ? PAID : null,
      )
  })

  afterEach(() => {
    vi.useRealTimers()
    useWalletStore.setState({ publicKey: null })
  })

  it('reads no history before the start', async () => {
    vi.setSystemTime(FIXTURE_START_MS - 60_000)
    connect(FIXTURE_OWNER)
    const { result } = renderPosition(VIEW)
    await settle()

    expect(result.current).toBeNull()
    expect(fetchReceiptHistoryMock).not.toHaveBeenCalled()
  })

  it('reads no history while the view is still loading', async () => {
    vi.setSystemTime(AFTER_START_MS)
    connect(FIXTURE_OWNER)
    const { result } = renderPosition(undefined)
    await settle()

    expect(result.current).toBeNull()
    expect(fetchReceiptHistoryMock).not.toHaveBeenCalled()
  })

  it('reads no history while the market is still loading', async () => {
    vi.setSystemTime(AFTER_START_MS)
    connect(FIXTURE_OWNER)
    const { result } = renderHook(() => useMode2Position(undefined, null, null), { wrapper })
    await settle()

    expect(result.current).toBeNull()
    expect(fetchReceiptHistoryMock).not.toHaveBeenCalled()
  })

  it('reads no history with the switch off', async () => {
    flags.mode2 = false
    vi.setSystemTime(AFTER_START_MS)
    connect(FIXTURE_OWNER)
    renderPosition(VIEW)
    renderPosition(null)
    await settle()

    expect(fetchReceiptHistoryMock).not.toHaveBeenCalled()
  })

  it.each([
    ['the cohort is closed too', null],
    ['only the cohort is left', { ...VIEW, group: null, epoch: null, pair: null }],
  ])(
    'derives the receipt and the ATA after the keeper closed the group and epoch: %s',
    async (_case, view) => {
      vi.setSystemTime(AFTER_START_MS)
      connect(FIXTURE_OWNER)
      const { result } = renderPosition(view)

      await waitFor(() => expect(result.current?.status).toBe('paid'))
      expect(fetchReceiptHistoryMock).toHaveBeenCalledExactlyOnceWith(
        connection,
        DERIVED_RECEIPT,
        DERIVED_ATA,
      )
    },
  )

  it('shows a refund of exactly the principal on a settled market as voided', async () => {
    // A Mode 2 group voids on its own (e.g. a missing observation) while Mode 1 settles.
    fetchReceiptHistoryMock.mockResolvedValue({ ...PAID, paid: PAID.principal })
    vi.setSystemTime(AFTER_START_MS)
    connect(FIXTURE_OWNER)
    const { result } = renderPosition(null)

    await waitFor(() => expect(result.current?.status).toBe('voided'))
  })

  it("shows the new owner's history when the wallet switches accounts", async () => {
    vi.setSystemTime(AFTER_START_MS)
    connect(FIXTURE_OWNER)
    const { result, rerender } = renderPosition(VIEW)
    await waitFor(() => expect(result.current?.status).toBe('paid'))
    expect(fetchReceiptHistoryMock).toHaveBeenCalledWith(
      connection,
      receiptOf(FIXTURE_OWNER),
      associatedTokenAddress(FIXTURE_OWNER, MINT),
    )

    connect(OTHER_OWNER)
    rerender({ view: makeView({ owner: OTHER_OWNER }) })

    expect(result.current).toBeNull()
    await waitFor(() =>
      expect(fetchReceiptHistoryMock).toHaveBeenLastCalledWith(
        connection,
        receiptOf(OTHER_OWNER),
        associatedTokenAddress(OTHER_OWNER, MINT),
      ),
    )
    expect(result.current).toBeNull()
  })
})
