import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PublicKey } from '@solana/web3.js'

import { useWalletStore } from '@/stores/walletStore'

const authenticateMock = vi.hoisted(() => vi.fn())
const requestTestUsdcMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/useUsdcBalance', () => ({
  useUsdcBalance: () => ({ data: { balance: 0 } }),
}))

vi.mock('@/lib/supabase/hooks', () => ({
  useSupabaseAuth: () => ({
    status: 'idle',
    authenticate: authenticateMock,
  }),
}))

vi.mock('@/lib/supabase/faucet', () => ({
  FaucetRateLimitError: class FaucetRateLimitError extends Error {
    retryAfter: number
    constructor(retryAfter: number) {
      super(`Try again in ${retryAfter}s`)
      this.retryAfter = retryAfter
    }
  },
  requestTestUsdc: requestTestUsdcMock,
}))

vi.mock('@/stores/toastStore', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

import { RequestUsdcButton } from '@/features/wallet/RequestUsdcButton'

function renderRequestUsdcButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RequestUsdcButton />
    </QueryClientProvider>,
  )
}

describe('RequestUsdcButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateMock.mockResolvedValue(undefined)
    requestTestUsdcMock.mockResolvedValue({
      sig: 'tx-sig',
      amount: '1000000',
      mint: 'mint',
      ata: 'ata',
    })
    useWalletStore.setState({
      publicKey: {
        toBase58: () => 'FaucetWallet11111111111111111111111111111',
      } as unknown as PublicKey,
      connected: true,
      connecting: false,
      wrongNetwork: false,
      cluster: 'mainnet',
    })
  })

  it('authenticates on explicit faucet click before requesting test USDC', async () => {
    const user = userEvent.setup()

    renderRequestUsdcButton()

    await user.click(screen.getByRole('button', { name: /request test usdc/i }))

    expect(authenticateMock).toHaveBeenCalledTimes(1)
    expect(requestTestUsdcMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalled()
  })
})
