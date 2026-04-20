import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useWalletStore } from '@/stores/walletStore'
import { WrongNetworkBanner } from '@/features/wallet/WrongNetworkBanner'

let mockNetwork: 'devnet' | 'mainnet' = 'devnet'
vi.mock('@/env', () => ({
  get env() {
    return { APP_NETWORK: mockNetwork }
  },
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

describe('WrongNetworkBanner', () => {
  beforeEach(() => {
    resetStore()
    mockNetwork = 'devnet'
  })

  it('renders nothing when walletStore.wrongNetwork=false', () => {
    render(<WrongNetworkBanner />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders banner with role="alert" when walletStore.wrongNetwork=true', () => {
    act(() => {
      useWalletStore.setState({ wrongNetwork: true })
    })
    render(<WrongNetworkBanner />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('banner label includes the expected cluster from APP_NETWORK', () => {
    mockNetwork = 'mainnet'
    act(() => {
      useWalletStore.setState({ wrongNetwork: true })
    })
    render(<WrongNetworkBanner />)
    expect(screen.getByRole('alert').textContent).toMatch(/mainnet/i)
  })

  it('banner is non-dismissable — no close button', () => {
    act(() => {
      useWalletStore.setState({ wrongNetwork: true })
    })
    render(<WrongNetworkBanner />)
    expect(screen.queryByRole('button', { name: /close|dismiss|^x$/i })).not.toBeInTheDocument()
  })
})
