import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import React from 'react'

import type { UserPosition } from '@/types/market'

vi.mock('@/env/env.config', () => ({
  env: {
    APP_ENV: 'test',
    APP_API_BASE_URL: '',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.mainnet-beta.solana.com',
    APP_NETWORK: 'mainnet',
    APP_PROGRAM_ID: 'LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV',
    APP_SUPABASE_URL: 'http://localhost:54321',
    APP_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}))

vi.mock('@/lib/solana/transactions', () => ({
  useExitPosition: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useClaim: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}))

vi.mock('@/lib/api/useUsdcBalance', () => ({
  useUsdcBalance: () => ({ data: null, isLoading: false }),
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

const positionsRef: { current: UserPosition[] } = { current: [] }
vi.mock('@/lib/chain', async () => {
  const actual = await vi.importActual<typeof import('@/lib/chain')>('@/lib/chain')
  return {
    ...actual,
    useUserPositions: () => ({ data: positionsRef.current, isLoading: false }),
  }
})

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

function withQueryClient(node: React.ReactNode): React.ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return React.createElement(QueryClientProvider, { client }, node) as React.ReactElement
}

const FIXTURE: UserPosition[] = [
  {
    id: '1-1',
    marketId: '1',
    marketIdNum: 1,
    marketState: 'active',
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    pathId: 'path-1',
    pathIndex: 1,
    pathLabel: 'Path B',
    pathTone: 'bull',
    collateral: 250,
    leverage: 1,
    exposure: 250,
    entryMultiplier: 1.85,
    entryTime: 0,
    estimatedPayout: 462.5,
    dissolved: false,
    claimed: false,
  },
  {
    id: '6-0',
    marketId: '6',
    marketIdNum: 6,
    marketState: 'settled',
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    pathId: 'path-0',
    pathIndex: 0,
    pathLabel: 'Path A',
    pathTone: 'ultra-bull',
    collateral: 50,
    leverage: 1,
    exposure: 50,
    entryMultiplier: 2.15,
    entryTime: 0,
    estimatedPayout: 107.5,
    dissolved: false,
    claimed: false,
  },
]

describe('PortfolioPage', () => {
  beforeEach(() => {
    setConnected(false)
    positionsRef.current = []
  })

  it('shows the connect-wallet empty state when disconnected', () => {
    render(withQueryClient(<PortfolioPage />))
    expect(screen.getByText(/please connect your wallet/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /active positions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /settled positions/i })).not.toBeInTheDocument()
  })

  it('renders active and settled sections when connected with empty positions', () => {
    setConnected(true)
    render(withQueryClient(<PortfolioPage />))
    expect(screen.getByRole('heading', { name: /active positions/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /settled positions/i })).toBeInTheDocument()
    expect(screen.getAllByText(/no open positions/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/no settled positions/i).length).toBeGreaterThan(0)
  })

  it('splits real positions into active vs settled by marketState', () => {
    setConnected(true)
    positionsRef.current = FIXTURE
    render(withQueryClient(<PortfolioPage />))
    // Path B is on the active SOL row, Path A on the settled BTC row.
    expect(screen.getByText('Path B')).toBeInTheDocument()
    expect(screen.getByText('Path A')).toBeInTheDocument()
    // Open Positions tile counts only active.
    const openCounter = screen.getByText('Open Positions').nextElementSibling
    expect(openCounter?.textContent).toContain('1')
  })
})
