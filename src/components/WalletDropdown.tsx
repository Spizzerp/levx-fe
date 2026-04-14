import { useEffect, useRef } from 'react'
import type { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { useNavigate } from '@tanstack/react-router'

import { env } from '@/env/env.config'
import { explorerAddressUrl } from '@/lib/format'
import { cn } from '@/lib/cn'

interface WalletDropdownProps {
  publicKey: PublicKey
  cluster: string
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
}

const MENU_ITEM = cn(
  'block w-full px-4 py-2.5 text-left font-mono text-xs uppercase tracking-wide text-ink',
  'duration-short ease-levx transition-[background-color,color]',
  'hover:bg-surface-2 hover:text-ink-strong',
)

export function WalletDropdown({
  publicKey,
  cluster,
  anchorRef,
  open,
  onClose,
}: WalletDropdownProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const { disconnect } = useWallet()
  const navigate = useNavigate()
  const isAdmin = env.APP_ADMIN_WALLETS.includes(publicKey.toBase58())

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, anchorRef, onClose])

  if (!open) return null

  const base58 = publicKey.toBase58()

  return (
    <div
      ref={panelRef}
      role="menu"
      className={cn(
        'border-line-strong bg-surface-1 absolute right-0 top-[calc(100%+8px)] z-overlay',
        'min-w-[200px] overflow-hidden rounded-md border',
      )}
    >
      {isAdmin && (
        <>
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM}
            onClick={() => {
              onClose()
              void navigate({ to: '/admin' })
            }}
          >
            Manage markets
          </button>
          <hr className="border-line mx-2 my-1" />
        </>
      )}
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM}
        onClick={() => {
          onClose()
          void disconnect()
        }}
      >
        Disconnect
      </button>
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM}
        onClick={() => {
          void navigator.clipboard?.writeText(base58)
          onClose()
        }}
      >
        Copy address
      </button>
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM}
        onClick={() => {
          window.open(explorerAddressUrl(base58, cluster), '_blank', 'noopener,noreferrer')
          onClose()
        }}
      >
        View on explorer
      </button>
    </div>
  )
}
