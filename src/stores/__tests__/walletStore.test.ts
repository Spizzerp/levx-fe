import { describe, it } from 'vitest'

describe('walletStore', () => {
  it.todo(
    'initializes with publicKey=null, connected=false, connecting=false, wrongNetwork=false, cluster=null',
  )
  it.todo('setWallet writes publicKey + connected + cluster into state')
  it.todo('reset returns state to initial values')
  it.todo('PublicKey comparisons inside the store use .equals() — not === (WALLET-07)')
})

describe('WalletSync', () => {
  it.todo('writes connecting=true when useWallet().connecting is true')
  it.todo('writes connected=true + publicKey after genesis hash check resolves (WALLET-05)')
  it.todo('sets wrongNetwork=true when genesis hash does not match APP_NETWORK (WALLET-06)')
  it.todo('sets wrongNetwork=false when genesis hash matches APP_NETWORK (WALLET-06)')
  it.todo('calls reset() when useWallet().connected becomes false')
  it.todo('does not write stale state when the component unmounts mid genesis-hash fetch')
})
