import type { PropsWithChildren } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

import { useWalletStore } from '@/stores/walletStore'
import { env } from '@/env'
import { cn } from '@/lib/cn'

/**
 * Action-surface gating wrapper.
 *
 * Wraps ONLY the submit-button slot (not the whole panel). The enclosing panel
 * — inputs, leverage, path selection — renders fully interactive when
 * disconnected; only this slot swaps to a prompt. This is the CONTEXT.md
 * WALLET-08 rule: preserve user-authored state across mid-flow disconnect.
 *
 * States:
 *   connected + right network → renders children
 *   !connected                → "Connect wallet to continue" → opens modal
 *   wrongNetwork              → "Switch to {cluster}" (advisory, disabled)
 */
export function ConnectGate({ children }: PropsWithChildren) {
  const connected = useWalletStore((s) => s.connected)
  const wrongNetwork = useWalletStore((s) => s.wrongNetwork)
  const { setVisible } = useWalletModal()

  const baseSlot = cn(
    'inline-flex min-h-11 w-full items-center justify-center rounded-full px-6 py-3.5',
    'text-caption font-mono font-bold tracking-wide uppercase',
    'duration-short ease-levx transition-[opacity,background,border-color,color]',
  )

  if (!connected) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={cn(
          baseSlot,
          // Primary CTA styling — matches the brand-gradient pill +
          // dither/glow used by the Button component's `primary`
          // variant. `btn-gradient-glow` is the shared class defined
          // in features/chart/ChartFrame.css; reusing it keeps the
          // hover effect identical to other gradient buttons.
          'from-brand-from to-brand-to text-surface bg-gradient-to-r',
          'btn-gradient-glow',
        )}
      >
        Connect wallet to continue
      </button>
    )
  }

  if (wrongNetwork) {
    const label = env.APP_NETWORK === 'mainnet' ? 'Mainnet' : 'Devnet'
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={cn(
          baseSlot,
          'border border-accent bg-transparent text-accent',
          'cursor-not-allowed opacity-80',
        )}
      >
        Switch to {label}
      </button>
    )
  }

  return <>{children}</>
}
