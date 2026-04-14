import { describe, it } from 'vitest'

describe('ConnectGate', () => {
  it.todo('renders children when walletStore.connected=true and wrongNetwork=false (WALLET-04)')
  it.todo(
    'renders "Connect wallet to continue" prompt when walletStore.connected=false (WALLET-04)',
  )
  it.todo('clicking the prompt calls useWalletModal().setVisible(true) — no route change (WALLET-04)')
  it.todo('renders "Switch to {cluster}" prompt when walletStore.wrongNetwork=true')
  it.todo(
    'does not unmount sibling user-authored state (drawn path, amount input) on disconnect (WALLET-08)',
  )
  it.todo(
    'resets wallet-dependent UI when walletStore transitions connected→disconnected mid-flow (WALLET-08)',
  )
})
