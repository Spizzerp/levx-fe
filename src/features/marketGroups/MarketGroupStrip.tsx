import { Link } from '@tanstack/react-router'
import { Activity, ArrowRight, Layers } from 'lucide-react'

import type { MarketGroupSummary } from '@/features/marketGroups/groupPresentation'
import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'

type MarketGroupStripProps = {
  groups: readonly MarketGroupSummary[]
  totalMarketCount: number
}

export function MarketGroupStrip({ groups, totalMarketCount }: MarketGroupStripProps) {
  if (groups.length === 0) return null

  return (
    <section className="mb-6 space-y-3" aria-labelledby="market-groups-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-label text-ink-dim mb-1 flex items-center gap-2 font-mono tracking-wider uppercase">
            <Layers size={14} strokeWidth={1.5} aria-hidden />
            Market groups
          </div>
          <h2 id="market-groups-heading" className="text-ink-strong font-display text-2xl">
            Browse active seasons
          </h2>
        </div>
        <Link
          to="/markets"
          className={cn(
            'inline-flex h-10 w-fit items-center gap-2 rounded-full border px-3',
            'border-line-strong text-ink-muted hover:border-ink hover:text-ink',
            'text-label font-mono tracking-wider uppercase',
            'duration-short ease-levx transition-[border-color,color]',
            'focus-visible:ring-ink-strong focus-visible:ring-offset-surface focus-visible:ring-2 focus-visible:ring-offset-2',
          )}
        >
          All markets
          <span className="text-ink-dim">{totalMarketCount}</span>
        </Link>
      </div>

      <nav className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Market groups">
        {groups.map((group) => (
          <Link
            key={group.groupKeyHash}
            to="/markets/group/$groupKeyHash"
            params={{ groupKeyHash: group.groupKeyHash }}
            className={cn(
              'group relative flex min-h-[156px] flex-col justify-between overflow-hidden rounded-2xl border p-4',
              'border-line bg-surface',
              'duration-medium ease-levx transition-all',
              'market-card-hover-glow hover:border-success/50 hover:-translate-y-1',
              'focus-visible:ring-ink-strong focus-visible:ring-offset-surface focus-visible:ring-2 focus-visible:ring-offset-2',
            )}
          >
            <div
              className={cn(
                'pointer-events-none absolute inset-0',
                'opacity-[0.03] transition-opacity duration-500 group-hover:opacity-[0.06]',
              )}
            >
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, var(--ink-strong) 1px, transparent 1px)',
                  backgroundSize: '12px 12px',
                }}
              />
            </div>

            <div className="relative z-10 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-ink-strong font-display truncate text-xl leading-tight font-bold">
                    {group.label}
                  </div>
                  <p className="text-ink-muted mt-1 line-clamp-2 font-mono text-xs uppercase">
                    {group.subtitle}
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  strokeWidth={1.5}
                  className={cn(
                    'text-ink-dim mt-1 shrink-0 transition-transform',
                    'group-hover:text-ink-strong group-hover:translate-x-1',
                  )}
                  aria-hidden
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'text-label inline-flex h-7 items-center rounded-full border px-2',
                    'border-line-strong text-ink-muted font-mono uppercase',
                  )}
                >
                  {group.totalMarkets} {group.totalMarkets === 1 ? 'market' : 'markets'}
                </span>
                {group.activeMarkets > 0 && (
                  <span
                    className={cn(
                      'text-label inline-flex h-7 items-center gap-1 rounded-full border px-2',
                      'border-success/30 text-success font-mono uppercase',
                    )}
                  >
                    <Activity size={12} strokeWidth={1.5} aria-hidden />
                    {group.activeMarkets} live
                  </span>
                )}
              </div>
            </div>

            <div
              className={cn(
                'relative z-10 mt-4 flex items-center justify-between border-t pt-3',
                'border-line',
              )}
            >
              <span className="text-label text-ink-dim font-mono uppercase">{group.shortHash}</span>
              <span className="text-label text-ink-muted font-mono uppercase">
                {formatUSD(group.totalPool)} USDC
              </span>
            </div>
          </Link>
        ))}
      </nav>
    </section>
  )
}
