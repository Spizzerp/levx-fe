import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PublicKey } from '@solana/web3.js'
import { useWalletStore } from '@/stores/walletStore'
import { WalletButton } from '@/components/WalletButton'

// Mocks for wallet-adapter hooks
const setVisible = vi.fn()
const disconnect = vi.fn(() => Promise.resolve())

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible, visible: false }),
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ disconnect }),
}))

const SYSTEM_KEY = new PublicKey('11111111111111111111111111111111')

function resetStore() {
  useWalletStore.setState({
    publicKey: null,
    connected: false,
    connecting: false,
    wrongNetwork: false,
    cluster: null,
  })
}

describe('WalletButton', () => {
  beforeEach(() => {
    resetStore()
    setVisible.mockClear()
    disconnect.mockClear()
    // jsdom lacks clipboard by default
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('renders "Connect Wallet" label when walletStore.connected=false (WALLET-01)', () => {
    render(<WalletButton />)
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('clicking the disconnected button calls useWalletModal().setVisible(true) (WALLET-01)', () => {
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    expect(setVisible).toHaveBeenCalledWith(true)
  })

  it('renders truncated first4···last4 pill when connected (WALLET-02)', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    render(<WalletButton />)
    // System Program base58 = "11111111111111111111111111111111" → first4 "1111" last4 "1111"
    expect(screen.getByRole('button', { name: /1111···1111/ })).toBeInTheDocument()
  })

  it('clicking the connected pill opens the dropdown popover (WALLET-02)', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /1111···1111/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('dropdown renders Disconnect, Copy address, and View on explorer actions (WALLET-02)', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /1111···1111/ }))
    expect(screen.getByRole('menuitem', { name: /disconnect/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /copy address/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /view on explorer/i })).toBeInTheDocument()
  })

  it('Disconnect action invokes useWallet().disconnect (WALLET-02)', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /1111···1111/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /disconnect/i }))
    expect(disconnect).toHaveBeenCalled()
  })

  it('Copy address action writes publicKey.toBase58() to navigator.clipboard (WALLET-02)', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /1111···1111/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /copy address/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SYSTEM_KEY.toBase58())
  })

  it('View on explorer opens explorer.solana.com with cluster query param (WALLET-02)', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /1111···1111/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /view on explorer/i }))
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('https://explorer.solana.com/address/'),
      '_blank',
      'noopener,noreferrer',
    )
    const url = (window.open as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('cluster=devnet')
    expect(url).toContain(SYSTEM_KEY.toBase58())
  })

  it('dropdown closes on outside click', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /1111···1111/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('dropdown closes on Escape key', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    render(<WalletButton />)
    fireEvent.click(screen.getByRole('button', { name: /1111···1111/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
