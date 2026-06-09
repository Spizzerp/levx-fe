import { Link } from '@tanstack/react-router'
import { Layers } from 'lucide-react'

import type { MarketGroupSummary } from '@/features/marketGroups/groupPresentation'
import { cn } from '@/lib/cn'

type MarketGroupStripProps = {
  groups: readonly MarketGroupSummary[]
}

export function MarketGroupStrip({ groups }: MarketGroupStripProps) {
  if (groups.length === 0) return null

  return (
    <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label="Market groups">
      <Link
        to="/markets"
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-full border px-3',
          'text-label font-mono tracking-wider uppercase',
          'duration-short ease-levx transition-[border-color,color]',
          'focus-visible:ring-ink-strong focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          'border-ink-strong text-ink-strong',
        )}
      >
        <Layers size={14} strokeWidth={1.5} aria-hidden />
        All groups
      </Link>

      {groups.map((group) => (
        <Link
          key={group.groupKeyHash}
          to="/markets/group/$groupKeyHash"
          params={{ groupKeyHash: group.groupKeyHash }}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-full border px-3',
            'text-label font-mono tracking-wider uppercase',
            'duration-short ease-levx transition-[border-color,color]',
            'focus-visible:ring-ink-strong focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            'border-line-strong text-ink-muted hover:border-ink hover:text-ink',
          )}
        >
          {group.label}
          <span className="text-ink-dim">{group.totalMarkets}</span>
        </Link>
      ))}
    </nav>
  )
}
