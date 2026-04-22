import { useCallback, useEffect, useMemo, useRef, type PropsWithChildren } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { env, toSolanaCluster } from '@/env'
import { AnchorProgramProvider } from '@/lib/chain'
import { SupabaseAuthProvider } from '@/lib/supabase/provider'
import { WalletSync } from '@/stores/walletStore'
import '@/style/wallet.css'

// Wallet Standard auto-detects Phantom/Backpack. Solflare needs explicit adapter
// due to WalletAccountError in StandardWalletAdapter._connect (known issue).
const WALLETS = [new SolflareWalletAdapter()]

// Drop any wallet name persisted from a previous session so the mount-time
// silent reconnect never runs against a stale selection (some wallets, notably
// Phantom on dev origins, ignore `silent:true` and pop their approval UI).
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('walletName')
  } catch {
    // localStorage may be unavailable (SSR, privacy mode); safe to ignore.
  }
}

export function UIRoot({ children }: PropsWithChildren) {
  const endpoint = useMemo(
    () => env.APP_RPC_URL || clusterApiUrl(toSolanaCluster(env.APP_NETWORK)),
    [],
  )

  // Gate `autoConnect` so that only user-initiated wallet selections from the
  // modal trigger a connection. The library's mount-time silent reconnect is
  // suppressed — without this, wallets can flash their approval popup on first
  // visit when `silent:true` isn't honored by the extension.
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
  }, [])
  const autoConnect = useCallback(async () => mountedRef.current, [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={WALLETS} autoConnect={autoConnect}>
        <WalletModalProvider>
          <AnchorProgramProvider>
            <WalletSync />
            <SupabaseAuthProvider>
              {children}
            </SupabaseAuthProvider>
          </AnchorProgramProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
