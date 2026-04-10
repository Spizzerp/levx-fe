import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/cn'

const links = [
  { to: '/markets', label: 'Markets' },
  { to: '/positions', label: 'Positions' },
  { to: '/vault', label: 'Vault' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/leaderboard', label: 'Leaderboard' },
] as const

const LINK_BASE = cn(
  'block border-b-2 border-transparent py-1.5 font-mono text-xs uppercase tracking-[0.1em] text-ink-dim',
  'transition-[color,border-color] duration-short ease-levx',
  'hover:text-ink-muted',
)

const LINK_ACTIVE = 'border-ink-strong text-ink-strong'

export function Nav() {
  return (
    <nav className="border-line flex items-center justify-between border-0 border-b px-8 py-5">
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
      <button
        className={cn(
          'border-line-strong rounded-full border bg-transparent px-[18px] py-2.5',
          'text-label text-ink font-mono tracking-[0.08em] uppercase',
          'duration-short ease-levx transition-[border-color]',
          'hover:border-ink',
        )}
      >
        7K4D ··· 9XQ2
      </button>
    </nav>
  )
}
