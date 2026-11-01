import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PublicKey } from '@solana/web3.js'
import type { Address } from '@solana/kit'
import { associatedTokenAddress, positionPda } from '@spizzerp/levx-mode2-client'

import { useWalletStore } from '@/stores/walletStore'
import type { Market } from '@/types/market'
import type { ReceiptHistory } from '../history'

const connection = vi.hoisted(() => ({}))
const fetchReceiptHistoryMock = vi.hoisted(() => vi.fn())

vi.mock('@solana/wallet-adapter-react', () => ({
  useConnection: () => ({ connection }),
}))
vi.mock('@/features/mode2/history', () => ({ fetchReceiptHistory: fetchReceiptHistoryMock }))

import { useMode2Position } from '../useMode2Position'
import { FIXTURE_OWNER, FIXTURE_START_MS, makeView } from './fixtures'

/** A second wallet: a fixed address that is nobody's. */
const OTHER_OWNER = 'MQik1CL4pkMV5LJ6g17Dy5kzDtrzdBDazr55PHVWt7Z' as Address

const MARKET = { marketId: 142, state: 'settled', startTime: FIXTURE_START_MS } as Market
const VIEW = makeView()
const MINT = VIEW.epoch!.data.mint
const receiptOf = (owner: Address) => positionPda(VIEW.group!.address as Address, owner)

/** The first owner was paid 29.70 USDC on 20; the second never traded. */
const PAID: ReceiptHistory = { principal: 20_000_000n, paid: 29_700_000n, claimSignature: 'claim' }

function connect(owner: Address) {
  useWalletStore.setState({ publicKey: new PublicKey(owner) })
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useMode2Position', () => {
  beforeEach(() => {
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

  it('reads no history before the start', () => {
    vi.setSystemTime(FIXTURE_START_MS - 60_000)
    connect(FIXTURE_OWNER)
    const { result } = renderHook(() => useMode2Position(MARKET, VIEW, null), { wrapper })

    expect(result.current).toBeNull()
    expect(fetchReceiptHistoryMock).not.toHaveBeenCalled()
  })

  it("shows the new owner's history when the wallet switches accounts", async () => {
    vi.setSystemTime(FIXTURE_START_MS + 3_600_000)
    connect(FIXTURE_OWNER)
    const { result, rerender } = renderHook(({ view }) => useMode2Position(MARKET, view, null), {
      wrapper,
      initialProps: { view: VIEW },
    })
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
