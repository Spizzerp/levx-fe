import { useMemo, type PropsWithChildren } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import { env, toSolanaCluster } from '@/env'
import { AnchorProgramProvider } from '@/lib/chain'
import { WalletSync } from '@/stores/walletStore'
import '@solana/wallet-adapter-react-ui/styles.css'

// Wallet Standard: Phantom / Solflare / Backpack auto-detect when installed.
// Empty array — no manual adapter instantiation needed.
const WALLETS: never[] = []

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
            {children}
          </AnchorProgramProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
