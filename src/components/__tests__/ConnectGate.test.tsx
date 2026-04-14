import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { PublicKey } from '@solana/web3.js'

import { useWalletStore } from '@/stores/walletStore'
import { ConnectGate } from '@/components/ConnectGate'

const setVisible = vi.fn()

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible, visible: false }),
}))

vi.mock('@/env', () => ({
  env: { APP_NETWORK: 'devnet' },
}))

const TEST_KEY = new PublicKey('11111111111111111111111111111111')

function connect() {
  useWalletStore.setState({
    publicKey: TEST_KEY,
    connected: true,
    connecting: false,
    wrongNetwork: false,
    cluster: 'devnet',
  })
}

function disconnect() {
  useWalletStore.setState({
    publicKey: null,
    connected: false,
    connecting: false,
    wrongNetwork: false,
    cluster: null,
  })
}

beforeEach(() => {
  setVisible.mockClear()
  disconnect()
})

describe('ConnectGate', () => {
  it('renders children when walletStore.connected=true and wrongNetwork=false (WALLET-04)', () => {
    act(() => connect())
    render(
      <ConnectGate>
        <button type="button">Submit wager</button>
      </ConnectGate>,
    )
    expect(screen.getByRole('button', { name: /submit wager/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /connect wallet to continue/i }),
    ).not.toBeInTheDocument()
  })

  it('renders "Connect wallet to continue" prompt when walletStore.connected=false (WALLET-04)', () => {
    render(
      <ConnectGate>
        <button type="button">Submit wager</button>
      </ConnectGate>,
    )
    expect(
      screen.getByRole('button', { name: /connect wallet to continue/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /submit wager/i }),
    ).not.toBeInTheDocument()
  })

  it('clicking the prompt calls useWalletModal().setVisible(true) — no route change (WALLET-04)', () => {
    render(
      <ConnectGate>
        <button type="button">Submit wager</button>
      </ConnectGate>,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /connect wallet to continue/i }),
    )
    expect(setVisible).toHaveBeenCalledWith(true)
  })

  it('renders "Switch to {cluster}" prompt when walletStore.wrongNetwork=true', () => {
    act(() => {
      useWalletStore.setState({
        publicKey: TEST_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: true,
        cluster: 'mainnet',
      })
    })
    render(
      <ConnectGate>
        <button type="button">Submit wager</button>
      </ConnectGate>,
    )
    // env mock is APP_NETWORK=devnet → label is "Devnet"
    expect(screen.getByRole('button', { name: /switch to devnet/i })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /submit wager/i }),
    ).not.toBeInTheDocument()
  })

  it('does not unmount sibling user-authored state (drawn path, amount input) on disconnect (WALLET-08)', async () => {
    // ConnectGate only wraps the submit slot. Sibling inputs live outside it.
    // Assert: typing into a sibling input survives a store transition from
    // connected → disconnected (the gate swaps its own subtree only).
    function Panel() {
      const [value, setValue] = useState('')
      return (
        <div>
          <input
            aria-label="amount"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <ConnectGate>
            <button type="button">Submit wager</button>
          </ConnectGate>
        </div>
      )
    }

    act(() => connect())
    const user = userEvent.setup()
    render(<Panel />)
    const input = screen.getByLabelText('amount')
    await user.type(input, '25.00')
    expect((input as HTMLInputElement).value).toBe('25.00')

    // Simulate mid-flow disconnect
    act(() => disconnect())

    // Sibling user-authored state preserved:
    expect((screen.getByLabelText('amount') as HTMLInputElement).value).toBe('25.00')
    // Submit slot swapped to prompt:
    expect(
      screen.getByRole('button', { name: /connect wallet to continue/i }),
    ).toBeInTheDocument()
  })

  it('resets wallet-dependent UI when walletStore transitions connected→disconnected mid-flow (WALLET-08)', () => {
    act(() => connect())
    render(
      <ConnectGate>
        <button type="button">Submit wager</button>
      </ConnectGate>,
    )
    expect(screen.getByRole('button', { name: /submit wager/i })).toBeInTheDocument()

    act(() => disconnect())

    expect(
      screen.queryByRole('button', { name: /submit wager/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /connect wallet to continue/i }),
    ).toBeInTheDocument()
  })
})
