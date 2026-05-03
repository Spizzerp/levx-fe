import { useMemo, type PropsWithChildren } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { env, toSolanaCluster } from '@/env'
import { AnchorProgramProvider } from '@/lib/chain'
import { EventStreamProvider } from '@/lib/solana/EventStreamProvider'
import { SupabaseAuthProvider } from '@/lib/supabase/provider'
import { WalletSync } from '@/stores/walletStore'
import '@/style/wallet.css'

// Phantom + Solflare get explicit adapters because Wallet Standard auto-
// detection is unreliable in some browser/private-window combinations
// (Brave with strict shields, Firefox containers, fresh-install Phantom
// before its content script registers). Solflare in particular has a
// known WalletAccountError in StandardWalletAdapter._connect.
//
// Backpack and other Wallet Standard wallets continue to auto-detect on
// supported browsers — `WalletProvider` discovers them at mount time
// without explicit registration here.
const WALLETS = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

export function UIRoot({ children }: PropsWithChildren) {
  const endpoint = useMemo(
    () => env.APP_RPC_URL || clusterApiUrl(toSolanaCluster(env.APP_NETWORK)),
    [],
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/*
        autoConnect=true: on page refresh, the wallet-adapter reads the
        previously-selected wallet from localStorage and attempts a silent
        reconnect via `connect({ silent: true })`. Modern Phantom +
        Solflare honor the silent flag, so no approval popup fires on
        refresh — the wallet just rehydrates if the site is already
        trusted. Without this, every refresh disconnects the wallet,
        which in turn evicts the cached Supabase JWT and breaks the
        faucet ("sign in with your wallet first").
      */}
      <WalletProvider wallets={WALLETS} autoConnect>
        <WalletModalProvider>
          <AnchorProgramProvider>
            <WalletSync />
            <SupabaseAuthProvider>
              <EventStreamProvider>{children}</EventStreamProvider>
            </SupabaseAuthProvider>
          </AnchorProgramProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
