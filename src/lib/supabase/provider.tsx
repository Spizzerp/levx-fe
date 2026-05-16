import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'

import { useWalletStore } from '@/stores/walletStore'
import { SupabaseAuthContext, type AuthContextValue } from './auth-context'
import type { AuthStatus, JWTRecord } from './types'
import {
  cacheJWT,
  clearJWT,
  loadCachedJWT,
  requestNonce,
  verifyAndGetJWT,
  __setActiveWallet,
} from './auth'

type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>

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
  // In-flight guard. React 18 strict mode runs mount effects twice in dev,
  // and any consumer-triggered re-call of `authenticate()` could overlap with
  // an already-running flow. Without this guard, both invocations would
  // request a nonce + open a wallet sign popup, burning two nonces and
  // surfacing two prompts to the user.
  const authInFlightRef = useRef(false)

  const wallet = publicKey?.toBase58() ?? null

  const signMessage: SignMessageFn = useCallback(
    async (msg) => {
      if (signOverride) return signOverride(msg)
      if (!adapter.signMessage) throw new Error('wallet does not support signMessage')
      return adapter.signMessage(msg)
    },
    [adapter, signOverride],
  )

  const authenticate = useCallback(async () => {
    if (!wallet) return
    if (authInFlightRef.current) return
    authInFlightRef.current = true
    setStatus('pending')
    try {
      const { nonce, message } = await requestNonce()
      const sig = await signMessage(new TextEncoder().encode(message))
      const signature = bs58.encode(sig)
      const rec = await verifyAndGetJWT({ pubkey: wallet, nonce, signature })
      cacheJWT(rec)
      setRecord(rec)
      setStatus('authenticated')
    } catch (e) {
      console.error('[supabase auth]', e)
      setStatus('error')
      throw e
    } finally {
      authInFlightRef.current = false
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
    setRecord(null)
    setStatus('idle')
  }, [connected, wallet])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      jwt: record?.jwt ?? null,
      wallet: wallet,
      expiresAt: record?.expiresAt ?? null,
      authenticate,
      signOut,
    }),
    [status, record, wallet, authenticate, signOut],
  )

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>
}
