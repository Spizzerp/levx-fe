import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { PublicKey } from '@solana/web3.js'
import { useWalletStore, WalletSync } from '@/stores/walletStore'

// Known genesis hashes — must match walletStore.ts constants.
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
const BOGUS_GENESIS = '1111111111111111111111111111111111111111111'

// Controllable state for mocked wallet-adapter hooks.
interface UseWalletMock {
  publicKey: PublicKey | null
  connected: boolean
  connecting: boolean
}

let walletState: UseWalletMock = {
  publicKey: null,
  connected: false,
  connecting: false,
}

let getGenesisHashImpl: () => Promise<string> = () => Promise.resolve(DEVNET_GENESIS)

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => walletState,
  useConnection: () => ({
    connection: {
      getGenesisHash: () => getGenesisHashImpl(),
    },
  }),
}))

// Env mock — force APP_NETWORK=devnet by default; individual tests can override.
let mockNetwork: 'devnet' | 'mainnet' = 'devnet'
vi.mock('@/env', () => ({
  get env() {
    return { APP_NETWORK: mockNetwork }
  },
}))

function resetState() {
  walletState = { publicKey: null, connected: false, connecting: false }
  mockNetwork = 'devnet'
  getGenesisHashImpl = () => Promise.resolve(DEVNET_GENESIS)
  useWalletStore.setState({
    publicKey: null,
    connected: false,
    connecting: false,
    wrongNetwork: false,
    cluster: null,
  })
}

// Stable System-Program public key for tests.
const SYSTEM_KEY = new PublicKey('11111111111111111111111111111111')
const OTHER_KEY = new PublicKey('So11111111111111111111111111111111111111112')

describe('walletStore', () => {
  beforeEach(() => {
    resetState()
  })

  it('initializes with publicKey=null, connected=false, connecting=false, wrongNetwork=false, cluster=null', () => {
    const s = useWalletStore.getState()
    expect(s.publicKey).toBeNull()
    expect(s.connected).toBe(false)
    expect(s.connecting).toBe(false)
    expect(s.wrongNetwork).toBe(false)
    expect(s.cluster).toBeNull()
  })

  it('setWallet writes publicKey + connected + cluster into state', () => {
    act(() => {
      useWalletStore.getState().setWallet({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: false,
        cluster: 'devnet',
      })
    })
    const s = useWalletStore.getState()
    expect(s.publicKey?.equals(SYSTEM_KEY)).toBe(true)
    expect(s.connected).toBe(true)
    expect(s.cluster).toBe('devnet')
  })

  it('reset returns state to initial values', () => {
    act(() => {
      useWalletStore.getState().setWallet({
        publicKey: SYSTEM_KEY,
        connected: true,
        connecting: false,
        wrongNetwork: true,
        cluster: 'mainnet',
      })
    })
    act(() => {
      useWalletStore.getState().reset()
    })
    const s = useWalletStore.getState()
    expect(s.publicKey).toBeNull()
    expect(s.connected).toBe(false)
    expect(s.connecting).toBe(false)
    expect(s.wrongNetwork).toBe(false)
    expect(s.cluster).toBeNull()
  })

  it('PublicKey comparisons inside the store use .equals() — not === (WALLET-07)', async () => {
    // Two distinct PublicKey instances with same base58 must be considered equal.
    walletState = { publicKey: SYSTEM_KEY, connected: true, connecting: false }
    getGenesisHashImpl = () => Promise.resolve(DEVNET_GENESIS)

    const { rerender, unmount } = renderHook(() => WalletSync())
    // Wait for the effect's promise to resolve.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useWalletStore.getState().publicKey?.equals(SYSTEM_KEY)).toBe(true)

    // Swap to a brand-new instance with the SAME base58 — store should skip the re-fetch.
    const sameKeyDifferentInstance = new PublicKey(SYSTEM_KEY.toBase58())
    expect(sameKeyDifferentInstance === SYSTEM_KEY).toBe(false) // sanity: different refs
    expect(sameKeyDifferentInstance.equals(SYSTEM_KEY)).toBe(true)

    let callCount = 0
    getGenesisHashImpl = () => {
      callCount++
      return Promise.resolve(DEVNET_GENESIS)
    }
    walletState = { publicKey: sameKeyDifferentInstance, connected: true, connecting: false }
    rerender()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // Key was the same by .equals(), so no new genesis-hash fetch occurred.
    expect(callCount).toBe(0)
    unmount()
  })
})

describe('WalletSync', () => {
  beforeEach(() => {
    resetState()
  })

  afterEach(() => {
    resetState()
  })

  it('writes connecting=true when useWallet().connecting is true', () => {
    walletState = { publicKey: null, connected: false, connecting: true }
    renderHook(() => WalletSync())
    expect(useWalletStore.getState().connecting).toBe(true)
  })

  it('writes connected=true + publicKey after genesis hash check resolves (WALLET-05)', async () => {
    walletState = { publicKey: SYSTEM_KEY, connected: true, connecting: false }
    mockNetwork = 'devnet'
    getGenesisHashImpl = () => Promise.resolve(DEVNET_GENESIS)

    renderHook(() => WalletSync())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const s = useWalletStore.getState()
    expect(s.connected).toBe(true)
    expect(s.publicKey?.equals(SYSTEM_KEY)).toBe(true)
    expect(s.cluster).toBe('devnet')
  })

  it('sets wrongNetwork=true when genesis hash does not match APP_NETWORK (WALLET-06)', async () => {
    walletState = { publicKey: SYSTEM_KEY, connected: true, connecting: false }
    mockNetwork = 'devnet'
    // Wallet returns mainnet hash but APP_NETWORK=devnet → mismatch.
    getGenesisHashImpl = () => Promise.resolve(MAINNET_GENESIS)

    renderHook(() => WalletSync())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useWalletStore.getState().wrongNetwork).toBe(true)
  })

  it('sets wrongNetwork=false when genesis hash matches APP_NETWORK (WALLET-06)', async () => {
    walletState = { publicKey: SYSTEM_KEY, connected: true, connecting: false }
    mockNetwork = 'mainnet'
    getGenesisHashImpl = () => Promise.resolve(MAINNET_GENESIS)

    renderHook(() => WalletSync())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const s = useWalletStore.getState()
    expect(s.wrongNetwork).toBe(false)
    expect(s.cluster).toBe('mainnet')
  })

  it('calls reset() when useWallet().connected becomes false', async () => {
    // First: connected with a key.
    walletState = { publicKey: SYSTEM_KEY, connected: true, connecting: false }
    getGenesisHashImpl = () => Promise.resolve(DEVNET_GENESIS)
    const { rerender } = renderHook(() => WalletSync())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useWalletStore.getState().connected).toBe(true)

    // Then: wallet disconnects.
    walletState = { publicKey: null, connected: false, connecting: false }
    rerender()
    await act(async () => {
      await Promise.resolve()
    })
    const s = useWalletStore.getState()
    expect(s.connected).toBe(false)
    expect(s.publicKey).toBeNull()
    expect(s.cluster).toBeNull()
  })

  it('does not write stale wrongNetwork state when the component unmounts mid genesis-hash fetch', async () => {
    // Deferred promise — we control when it resolves. Resolve to a BOGUS genesis
    // so that, absent cancellation, the .then handler would set wrongNetwork=true.
    let resolveHash: (v: string) => void = () => {}
    const deferred = new Promise<string>((res) => {
      resolveHash = res
    })
    getGenesisHashImpl = () => deferred

    walletState = { publicKey: SYSTEM_KEY, connected: true, connecting: false }
    const { unmount } = renderHook(() => WalletSync())

    // The component synchronously mirrors connection BEFORE the genesis-hash
    // promise resolves (this is intentional — see walletStore.ts line ~76).
    // The cancellation guard protects only the post-fetch wrongNetwork update.
    expect(useWalletStore.getState().connected).toBe(true)
    expect(useWalletStore.getState().wrongNetwork).toBe(false)

    // Unmount before the promise resolves.
    unmount()
    // Now resolve the promise with a bogus hash — the cancelled flag should
    // block the would-be `wrongNetwork: true` write.
    resolveHash(BOGUS_GENESIS)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // wrongNetwork must still be false — the post-fetch update was cancelled.
    expect(useWalletStore.getState().wrongNetwork).toBe(false)
  })

  // Additional coverage: unrelated test to exercise differentiated publicKey
  // (ensures OTHER_KEY import is used and the store updates on real key change).
  it('re-fetches when publicKey changes to a different key', async () => {
    walletState = { publicKey: SYSTEM_KEY, connected: true, connecting: false }
    let callCount = 0
    getGenesisHashImpl = () => {
      callCount++
      return Promise.resolve(DEVNET_GENESIS)
    }
    const { rerender } = renderHook(() => WalletSync())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(callCount).toBe(1)

    walletState = { publicKey: OTHER_KEY, connected: true, connecting: false }
    rerender()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(callCount).toBe(2)
    expect(useWalletStore.getState().publicKey?.equals(OTHER_KEY)).toBe(true)
  })

  it('handles bogus genesis hash as wrongNetwork=true', async () => {
    walletState = { publicKey: SYSTEM_KEY, connected: true, connecting: false }
    mockNetwork = 'devnet'
    getGenesisHashImpl = () => Promise.resolve(BOGUS_GENESIS)

    renderHook(() => WalletSync())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useWalletStore.getState().wrongNetwork).toBe(true)
  })
})
