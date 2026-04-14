import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/cn'
import { WalletButton } from '@/components/WalletButton'

const links = [
  { to: '/markets', label: 'Markets' },
  { to: '/positions', label: 'Positions' },
  { to: '/vault', label: 'Vault' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/leaderboard', label: 'Leaderboard' },
] as const

const LINK_BASE = cn(
  'block border-b-2 border-transparent py-1.5 font-mono text-xs uppercase tracking-wide text-ink-dim',
  'transition-[color,border-color] duration-short ease-levx',
  'hover:text-ink-muted',
)

const LINK_ACTIVE = 'border-ink-strong text-ink-strong'

export function Nav() {
  return (
    <nav className="border-line sticky top-0 z-nav flex items-center justify-between border-0 border-b bg-surface px-8 py-5">
      <img src="/logo_white.png" alt="LevX" className="h-11 w-auto" />
      <ul className="flex gap-9">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className={LINK_BASE}
              activeProps={{ className: cn(LINK_BASE, LINK_ACTIVE) }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      <WalletButton />
    </nav>
  )
}
