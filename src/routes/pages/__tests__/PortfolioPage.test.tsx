import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicKey } from '@solana/web3.js'

vi.mock('@/env/env.config', () => ({
  env: {
    APP_ENV: 'test',
    APP_API_BASE_URL: '',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.mainnet-beta.solana.com',
    APP_NETWORK: 'mainnet',
  },
}))

vi.mock('@/lib/solana/transactions', () => ({
  useExitPosition: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ disconnect: vi.fn() }),
}))

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn(), visible: false }),
}))

vi.mock('@/ui/TokenPairIcon', () => ({
  TokenPairIcon: () => null,
}))

import { PortfolioPage } from '@/routes/pages/PortfolioPage'
import { useWalletStore } from '@/stores/walletStore'

function setConnected(connected: boolean) {
  useWalletStore.setState({
    publicKey: connected ? new PublicKey('11111111111111111111111111111111') : null,
    connected,
    connecting: false,
    wrongNetwork: false,
    cluster: connected ? 'mainnet' : null,
  })
}

describe('PortfolioPage', () => {
  beforeEach(() => {
    setConnected(false)
  })

  it('shows the connect-wallet empty state when disconnected', () => {
    render(<PortfolioPage />)
    expect(screen.getByText(/please connect your wallet/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /active positions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /settled positions/i })).not.toBeInTheDocument()
  })

  it('renders active and settled sections with provider labels when connected', () => {
    setConnected(true)
    render(<PortfolioPage />)
    expect(screen.getByRole('heading', { name: /active positions/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /settled positions/i })).toBeInTheDocument()
    // At least one canonical provider label from AdminPage.AI_PROVIDERS
    // (Chronos-2 appears in both an active and a settled row, so don't assume uniqueness.)
    expect(screen.getAllByText(/chronos-2/i).length).toBeGreaterThan(0)
  })
})
