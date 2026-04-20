import { useMemo, type PropsWithChildren } from 'react'
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

export function UIRoot({ children }: PropsWithChildren) {
  const endpoint = useMemo(
    () => env.APP_RPC_URL || clusterApiUrl(toSolanaCluster(env.APP_NETWORK)),
    [],
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={WALLETS} autoConnect>
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
