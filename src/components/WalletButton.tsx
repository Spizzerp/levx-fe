import { useRef, useState } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

import { useWalletStore } from '@/stores/walletStore'
import { formatAddress } from '@/lib/format'
import { cn } from '@/lib/cn'
import { WalletDropdown } from '@/components/WalletDropdown'

// Pill styling for wallet button
const PILL = cn(
  'border-line-strong rounded-full border bg-transparent px-4 py-2',
  'text-[12px] text-ink font-mono tracking-wide uppercase leading-none',
  'duration-short ease-levx transition-[border-color]',
  'hover:border-ink',
)

export function WalletButton() {
  const connected = useWalletStore((s) => s.connected)
  const publicKey = useWalletStore((s) => s.publicKey)
  const cluster = useWalletStore((s) => s.cluster)
  const { setVisible } = useWalletModal()
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)

  if (!connected || !publicKey) {
    return (
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setVisible(true)}
        className={cn(PILL, 'relative z-10')}
      >
        Connect Wallet
      </button>
    )
  }

  const label = formatAddress(publicKey.toBase58())

  return (
    <div className="relative inline-block">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={PILL}
      >
        {label}
      </button>
      <WalletDropdown
        publicKey={publicKey}
        cluster={cluster ?? 'devnet'}
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}
