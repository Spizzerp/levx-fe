import { useEffect, useRef } from 'react'
import type { PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { useNavigate } from '@tanstack/react-router'

import { cn } from '@/lib/cn'
import { explorerAddressUrl } from '@/lib/format'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { MENU_ITEM } from '@/ui/styles'

interface WalletDropdownProps {
  publicKey: PublicKey
  cluster: string
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
}

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
  const isAdmin = useIsAdmin()

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
        'border-line-strong bg-surface-1 z-overlay absolute top-[calc(100%+8px)] right-0',
        'min-w-[200px] overflow-hidden rounded-md border',
      )}
    >
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM}
        onClick={() => {
          onClose()
          void navigate({ to: '/profile' })
        }}
      >
        Profile
      </button>
      <hr className="border-line mx-2 my-1" />
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
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM}
            onClick={() => {
              onClose()
              void navigate({ to: '/admin/providers' })
            }}
          >
            Provider ops
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
