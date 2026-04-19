import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/cn'
import { ThemeToggle } from '@/components/ThemeToggle'
import { WalletButton } from '@/components/WalletButton'


const links = [
  { to: '/markets', label: 'Markets' },
  { to: '/vault', label: 'Vault' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/leaderboard', label: 'Leaderboard' },
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

export function Nav() {
  return (
    <div className="sticky top-0 z-[9999] w-full bg-gradient-to-b from-surface from-60% to-transparent px-6 pt-3 pb-3">
    <nav className="pill-glow mx-auto flex w-full max-w-[1400px] items-center justify-between rounded-full border border-line-strong bg-surface px-6 py-3 relative">
      <img src="/logo_color.png" alt="LevX" className="relative z-10 h-12 -my-1 w-auto" />
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
  )
}
