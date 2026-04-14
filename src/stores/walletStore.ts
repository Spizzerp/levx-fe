import { useEffect, useRef } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import type { PublicKey } from '@solana/web3.js'
import { create } from 'zustand'
import { env } from '@/env'

// Known genesis hashes (authoritative Solana constants).
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'

interface WalletStateSlice {
  publicKey: PublicKey | null
  connected: boolean
  connecting: boolean
  wrongNetwork: boolean
  cluster: string | null
}

interface WalletStateActions {
  setWallet: (slice: WalletStateSlice) => void
  reset: () => void
}

export type WalletState = WalletStateSlice & WalletStateActions

const INITIAL: WalletStateSlice = {
  publicKey: null,
  connected: false,
  connecting: false,
  wrongNetwork: false,
  cluster: null,
}

export const useWalletStore = create<WalletState>((set) => ({
  ...INITIAL,
  setWallet: (slice) => set(slice),
  reset: () => set(INITIAL),
}))

/**
 * Bridge component: reads useWallet() + useConnection() and mirrors into walletStore.
 * Must be mounted once inside the wallet adapter provider tree. Renders null.
 *
 * Genesis hash comparison implements WALLET-06 — the adapter does not surface
 * cluster mismatch natively. PublicKey identity is tracked via .equals() so
 * two instances with the same base58 don't retrigger the fetch (WALLET-07).
 */
export function WalletSync() {
  const { publicKey, connected, connecting } = useWallet()
  const { connection } = useConnection()
  const setWallet = useWalletStore((s) => s.setWallet)
  const reset = useWalletStore((s) => s.reset)
  const lastKeyRef = useRef<PublicKey | null>(null)

  // connecting transitions
  useEffect(() => {
    if (connecting) {
      setWallet({ ...INITIAL, connecting: true })
    }
  }, [connecting, setWallet])

  // connected → genesis hash check → mirror
  useEffect(() => {
    if (!connected || !publicKey) {
      if (lastKeyRef.current !== null) {
        lastKeyRef.current = null
        reset()
      }
      return
    }
    // Skip if we already mirrored this exact key (WALLET-07: .equals() not ===).
    if (lastKeyRef.current && lastKeyRef.current.equals(publicKey)) return
    lastKeyRef.current = publicKey

    // Immediately reflect connection while genesis hash check runs in background.
    setWallet({
      publicKey,
      connected: true,
      connecting: false,
      wrongNetwork: false,
      cluster: env.APP_NETWORK,
    })

    let cancelled = false
    connection
      .getGenesisHash()
      .then((hash) => {
        if (cancelled) return
        const expected = env.APP_NETWORK === 'mainnet' ? MAINNET_GENESIS : DEVNET_GENESIS
        if (hash !== expected) {
          setWallet({
            publicKey,
            connected: true,
            connecting: false,
            wrongNetwork: true,
            cluster: env.APP_NETWORK,
          })
        }
      })
      .catch(() => {
        // RPC failure — already set connected above, nothing to do.
      })

    return () => {
      cancelled = true
    }
  }, [connected, publicKey, connection, setWallet, reset])

  return null
}
