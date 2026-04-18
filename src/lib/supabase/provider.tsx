import { createContext, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

import { useWalletStore } from '@/stores/walletStore'
import type { AuthStatus, JWTRecord } from './types'
import {
  cacheJWT, clearJWT, loadCachedJWT, requestNonce, verifyAndGetJWT, __setActiveWallet,
} from './auth'

type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>

export type AuthContextValue = {
  status:      AuthStatus
  jwt:         string | null
  wallet:      string | null
  expiresAt:   number | null
  authenticate(): Promise<void>
  signOut():   void
}

export const SupabaseAuthContext = createContext<AuthContextValue | null>(null)

type Props = PropsWithChildren<{
  /** Optional override for tests — defaults to the wallet adapter's signMessage. */
  signMessage?: SignMessageFn
}>

export function SupabaseAuthProvider({ children, signMessage: signOverride }: Props) {
  const adapter = useWallet()
  const connected = useWalletStore((s) => s.connected)
  const publicKey = useWalletStore((s) => s.publicKey)

  const [status, setStatus] = useState<AuthStatus>('idle')
  const [record, setRecord] = useState<JWTRecord | null>(null)
  const prevWalletRef = useRef<string | null>(null)

  const wallet = publicKey?.toBase58() ?? null

  const signMessage: SignMessageFn = useCallback(async (msg) => {
    if (signOverride) return signOverride(msg)
    if (!adapter.signMessage) throw new Error('wallet does not support signMessage')
    return adapter.signMessage(msg)
  }, [adapter, signOverride])

  const authenticate = useCallback(async () => {
    if (!wallet) return
    setStatus('pending')
    try {
      const { nonce, message } = await requestNonce()
      const sig = await signMessage(new TextEncoder().encode(message))
      const { default: bs58 } = await import('bs58')
      const signature = bs58.encode(sig)
      const rec = await verifyAndGetJWT({ pubkey: wallet, nonce, signature })
      cacheJWT(rec)
      setRecord(rec)
      setStatus('authenticated')
    } catch (e) {
      console.error('[supabase auth]', e)
      setStatus('error')
    }
  }, [wallet, signMessage])

  const signOut = useCallback(() => {
    if (wallet) clearJWT(wallet)
    setRecord(null)
    setStatus('idle')
    __setActiveWallet(null)
  }, [wallet])

  useEffect(() => {
    const prev = prevWalletRef.current
    prevWalletRef.current = wallet

    if (!connected || !wallet) {
      // Symmetric purge on disconnect.
      if (prev) clearJWT(prev)
      setRecord(null)
      setStatus('idle')
      __setActiveWallet(null)
      return
    }

    if (prev && prev !== wallet) clearJWT(prev)

    __setActiveWallet(wallet)
    const cached = loadCachedJWT(wallet)
    if (cached) {
      setRecord(cached)
      setStatus('authenticated')
      return
    }
    void authenticate()
  }, [connected, wallet, authenticate])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    jwt:       record?.jwt ?? null,
    wallet:    wallet,
    expiresAt: record?.expiresAt ?? null,
    authenticate,
    signOut,
  }), [status, record, wallet, authenticate, signOut])

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  )
}
