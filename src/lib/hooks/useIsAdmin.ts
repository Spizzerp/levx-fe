import { env } from '@/env/env.config'
import { useWalletStore } from '@/stores/walletStore'

/** Returns true if the connected wallet is in APP_ADMIN_WALLETS. */
export function useIsAdmin(): boolean {
  const publicKey = useWalletStore((s) => s.publicKey)
  return publicKey ? env.APP_ADMIN_WALLETS.includes(publicKey.toBase58()) : false
}
