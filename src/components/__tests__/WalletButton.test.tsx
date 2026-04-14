import { describe, it } from 'vitest'

describe('WalletButton', () => {
  it.todo('renders "Connect Wallet" label when walletStore.connected=false (WALLET-01)')
  it.todo('clicking the disconnected button calls useWalletModal().setVisible(true) (WALLET-01)')
  it.todo('renders truncated first4···last4 pill when connected (WALLET-02)')
  it.todo('clicking the connected pill opens the dropdown popover (WALLET-02)')
  it.todo('dropdown renders Disconnect, Copy address, and View on explorer actions (WALLET-02)')
  it.todo('Disconnect action invokes useWallet().disconnect (WALLET-02)')
  it.todo('Copy address action writes publicKey.toBase58() to navigator.clipboard (WALLET-02)')
  it.todo('View on explorer opens explorer.solana.com with cluster query param (WALLET-02)')
  it.todo('dropdown closes on outside click')
  it.todo('dropdown closes on Escape key')
})
