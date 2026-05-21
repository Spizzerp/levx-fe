import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

import { cn } from '@/lib/cn'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { WalletButton } from '@/features/wallet/WalletButton'
import { explorerAddressUrl, formatAddress } from '@/lib/format'
import { useWalletStore } from '@/stores/walletStore'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { MENU_ITEM } from '@/ui/styles'

const links = [
  { to: '/markets', label: 'Markets' },
  { to: '/vault', label: 'Vault' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/providers', label: 'Providers' },
] as const

const LINK_BASE = cn(
  'group relative block py-1.5 font-mono text-xs uppercase tracking-wide text-ink-muted',
  'transition-colors duration-short ease-levx',
  'hover:text-ink-muted',
)

const UNDERLINE = cn(
  'absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-ink-strong',
  'transition-transform duration-short ease-levx',
  'group-hover:scale-x-100',
)

const LINK_ACTIVE = 'text-ink-strong'

const MOBILE_LINK_BASE = cn(
  'group relative block py-3 font-mono text-sm uppercase tracking-wide text-ink-muted',
  'transition-colors duration-short ease-levx',
)

const MOBILE_LINK_ACTIVE = 'text-ink-strong'

const EASE_VALUE = 'cubic-bezier(.77,0,.18,1)'

/* ─── Mobile wallet section (inline, no popup) ─────────────── */
function MobileWalletSection({ onAction }: { onAction: () => void }) {
  const connected = useWalletStore((s) => s.connected)
  const publicKey = useWalletStore((s) => s.publicKey)
  const cluster = useWalletStore((s) => s.cluster)
  const { disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()

  if (!connected || !publicKey) {
    return (
      <div className="border-line border-t px-4 py-3">
        <button
          type="button"
          onClick={() => {
            setVisible(true)
            onAction()
          }}
          className={cn(
            'border-line-strong w-full rounded-full border py-2.5',
            'text-ink font-mono text-xs tracking-wide uppercase',
            'duration-short ease-levx transition-[border-color]',
            'hover:border-ink',
          )}
        >
          Connect Wallet
        </button>
      </div>
    )
  }

  const base58 = publicKey.toBase58()
  const label = formatAddress(base58)

  return (
    <div className="border-line border-t">
      <div className="px-4 py-2.5">
        <span className="text-ink-dim font-mono text-[10px] tracking-wide uppercase">{label}</span>
      </div>
      <hr className="border-line mx-4" />
      <button
        type="button"
        className={MENU_ITEM}
        onClick={() => {
          onAction()
          void navigate({ to: '/profile' })
        }}
      >
        Profile
      </button>
      {isAdmin && (
        <>
          <button
            type="button"
            className={MENU_ITEM}
            onClick={() => {
              onAction()
              void navigate({ to: '/admin' })
            }}
          >
            Manage markets
          </button>
          <button
            type="button"
            className={MENU_ITEM}
            onClick={() => {
              onAction()
              void navigate({ to: '/admin/providers' })
            }}
          >
            Provider ops
          </button>
        </>
      )}
      <hr className="border-line mx-4" />
      <button
        type="button"
        className={MENU_ITEM}
        onClick={() => {
          void navigator.clipboard?.writeText(base58)
          onAction()
        }}
      >
        Copy address
      </button>
      <hr className="border-line mx-4" />
      <button
        type="button"
        className={MENU_ITEM}
        onClick={() => {
          window.open(
            explorerAddressUrl(base58, cluster ?? 'devnet'),
            '_blank',
            'noopener,noreferrer',
          )
          onAction()
        }}
      >
        View on explorer
      </button>
      <hr className="border-line mx-4" />
      <button
        type="button"
        className={cn(MENU_ITEM, 'mb-1 text-red-400 hover:text-red-400')}
        onClick={() => {
          void disconnect()
          onAction()
        }}
      >
        Disconnect
      </button>
    </div>
  )
}

/* ─── Animated hamburger / X button ───────────────────────── */
function HamburgerButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  const barBase: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    height: '1.5px',
    width: '18px',
    transform: 'translateX(-50%)',
    borderRadius: '9999px',
    backgroundColor: 'currentColor',
    transition: `all 300ms ${EASE_VALUE}`,
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex size-10 items-center justify-center rounded-full',
        'text-ink-muted duration-short ease-levx transition-colors',
        'hover:text-ink-strong',
        isOpen && 'text-ink-strong',
      )}
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      <span
        style={{
          ...barBase,
          ...(isOpen
            ? { top: '50%', transform: 'translateX(-50%) translateY(-50%) rotate(45deg)' }
            : { top: 'calc(50% - 4px)' }),
        }}
      />
      <span
        style={{
          ...barBase,
          ...(isOpen
            ? { top: '50%', transform: 'translateX(-50%) translateY(-50%) rotate(-45deg)' }
            : { top: 'calc(50% + 3px)' }),
        }}
      />
    </button>
  )
}

/* ─── Nav ─────────────────────────────────────────────────── */
export function Nav() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!isMobileMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobileMenuOpen])

  const closeMobile = () => setIsMobileMenuOpen(false)

  return (
    <>
      {/* ── Desktop nav ─────────────────────────────────── */}
      <div className="z-nav from-surface sticky top-0 w-full bg-gradient-to-b from-60% to-transparent px-6 pt-3 pb-3 sm:hidden">
        <nav className="pill-glow border-line-strong bg-surface relative mx-auto flex w-full max-w-[1400px] items-center justify-between rounded-full border px-6 py-3">
          <img src="/logo_color.png" alt="LevX" className="relative z-10 -my-1 h-12 w-auto" />
          <ul className="absolute inset-0 flex items-center justify-center gap-9">
            {links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className={LINK_BASE}
                  activeProps={{ className: cn(LINK_BASE, LINK_ACTIVE, '[&>span]:scale-x-100') }}
                >
                  {l.label}
                  <span className={UNDERLINE} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="relative z-10 flex items-center gap-3">
            <WalletButton />
            <ThemeToggle />
          </div>
        </nav>
      </div>

      {/* ── Mobile nav ──────────────────────────────────── */}
      {/*
        sticky wrapper has a fixed height — dropdown never pushes content.
        overflow:visible lets the absolutely-positioned panel appear below.
      */}
      <div
        className="z-nav sticky top-0 hidden sm:block"
        style={{ height: 52, overflow: 'visible' }}
      >
        {/* Gradient bg */}
        <div className="from-surface pointer-events-none absolute inset-x-0 top-0 h-[60px] bg-gradient-to-b from-60% to-transparent" />

        <div className="relative px-2 pt-2">
          {/* Pill bar — always fully rounded */}
          <div className="pill-glow border-line-strong bg-surface relative mx-auto flex w-full items-center justify-between rounded-full border px-3 py-1.5">
            <img src="/logo_color.png" alt="LevX" className="relative z-10 -my-0.5 h-9 w-auto" />
            <HamburgerButton
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            />
          </div>

          {/* Dropdown panel — absolutely below the pill, no clipping */}
          <div
            className="border-line-strong bg-surface absolute inset-x-2 top-full mt-1 overflow-hidden rounded-2xl border"
            style={{
              opacity: isMobileMenuOpen ? 1 : 0,
              transform: isMobileMenuOpen ? 'translateY(0)' : 'translateY(-8px)',
              pointerEvents: isMobileMenuOpen ? 'auto' : 'none',
              transition: `opacity 250ms ${EASE_VALUE}, transform 300ms ${EASE_VALUE}`,
            }}
          >
            {/* Nav links */}
            <nav className="px-4 pt-4 pb-2">
              <ul className="flex flex-col gap-0.5">
                {links.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className={MOBILE_LINK_BASE}
                      activeProps={{ className: cn(MOBILE_LINK_BASE, MOBILE_LINK_ACTIVE) }}
                      onClick={closeMobile}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Wallet section — inline, no popup */}
            <MobileWalletSection onAction={closeMobile} />

            {/* Theme toggle */}
            <div className="border-line flex items-center justify-between border-t px-4 py-3">
              <span className="text-ink-dim font-mono text-[10px] tracking-wide uppercase">
                Theme
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--z-nav)-1)] hidden bg-black/40 backdrop-blur-sm sm:block"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}
    </>
  )
}
