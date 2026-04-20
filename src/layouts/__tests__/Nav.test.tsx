import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useWalletStore } from '@/stores/walletStore'
import { Nav } from '@/layouts/Nav'

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn(), visible: false }),
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ disconnect: vi.fn() }),
}))

vi.mock('@/env', () => ({
  env: { APP_NETWORK: 'devnet' },
}))

// @tanstack/react-router's <Link> requires a router context. Replace with a
// plain anchor for the Nav test — we only care about wallet-button integration.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string
    children: React.ReactNode
    className?: string
    activeProps?: unknown
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

function resetStore() {
  useWalletStore.setState({
    publicKey: null,
    connected: false,
    connecting: false,
    wrongNetwork: false,
    cluster: null,
  })
}

describe('Nav', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders the WalletButton in place of the old hardcoded "7K4D···9XQ2" pill (FOUND-13)', () => {
    render(<Nav />)
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('does NOT render any literal "7K4D" string (regression check on the replaced fake button)', () => {
    render(<Nav />)
    expect(screen.queryByText(/7K4D/)).not.toBeInTheDocument()
  })

  it('retains all pre-Phase-2 nav items (logo, route links)', () => {
    render(<Nav />)
    expect(screen.getByAltText(/levx/i)).toBeInTheDocument()
    expect(screen.getByText(/markets/i)).toBeInTheDocument()
    expect(screen.getByText(/positions/i)).toBeInTheDocument()
    expect(screen.getByText(/vault/i)).toBeInTheDocument()
    expect(screen.getByText(/portfolio/i)).toBeInTheDocument()
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument()
  })
})
