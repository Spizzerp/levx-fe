import { useWalletStore } from '@/stores/walletStore'
import { env } from '@/env'
import { cn } from '@/lib/cn'

/**
 * Non-dismissable banner rendered in CommonLayout between <Nav /> and the page
 * Outlet. Surfaces only when walletStore.wrongNetwork=true. Uses the accent
 * (red) token — the loudest available within Nothing's palette — while staying
 * layered against surface tokens.
 */
export function WrongNetworkBanner() {
  const wrongNetwork = useWalletStore((s) => s.wrongNetwork)
  if (!wrongNetwork) return null

  const expected = env.APP_NETWORK === 'mainnet' ? 'Mainnet' : 'Devnet'

  return (
    <div
      role="alert"
      className={cn(
        'bg-accent text-ink-strong w-full px-8 py-2.5',
        'text-center font-mono text-xs font-bold uppercase tracking-wide',
      )}
    >
      Wrong network — switch to {expected}
    </div>
  )
}
