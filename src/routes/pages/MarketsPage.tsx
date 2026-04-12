import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { StatusDot } from '@/components/StatusDot'
import { Stub } from '@/components/Stub'
import { cn } from '@/lib/cn'
import { useMarkets } from '@/lib/api/hooks'
import { formatCountdown, formatUSD } from '@/lib/format'
import type { Market, MarketState } from '@/types/market'

type StateFilter = 'all' | 'active' | 'pending' | 'settled'

const STATE_LABELS: Record<MarketState, string> = {
  pending: 'Pending',
  active: 'Active',
  sampling: 'Sampling',
  settling: 'Settling',
  maturing: 'Maturing',
  settled: 'Settled',
  void: 'Void',
}

const FILTERS: { id: StateFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'settled', label: 'Settled' },
]

function matchesFilter(state: MarketState, filter: StateFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'active') return state === 'active' || state === 'sampling'
  if (filter === 'pending') return state === 'pending'
  if (filter === 'settled') {
    return state === 'settling' || state === 'maturing' || state === 'settled'
  }
  return false
}

function endsInLabel(m: Market): string {
  const now = Date.now()
  if (m.state === 'pending') {
    const diff = m.startTime - now
    return diff > 0 ? `STARTS IN ${formatCountdown(diff)}` : 'STARTS SOON'
  }
  if (m.state === 'settled') return 'SETTLED'
  const diff = m.endTime - now
  return diff > 0 ? formatCountdown(diff) : 'ENDED'
}

// Responsive grid: full columns on desktop, collapsed below 1200px.
// Matches the old .markets__head / .markets__row grid:
//   desktop: 56px 160px 1fr 200px 200px 160px 120px 24px
//   narrow:  48px 140px 1fr 160px 160px      —     —   24px
const ROW_GRID = cn(
  'grid items-center gap-4 px-4',
  'grid-cols-[48px_140px_1fr_160px_160px_24px]',
  '[@media(min-width:1201px)]:grid-cols-[56px_160px_1fr_200px_200px_160px_120px_24px]',
)

const NUM_CELL =
  'text-right whitespace-nowrap font-mono text-xs uppercase tracking-[0.08em] text-ink'

// Hidden below 1200px (matches old @media rule that hid columns 6 & 7)
const NARROW_HIDE = '[@media(max-width:1200px)]:hidden'

export function MarketsPage() {
  const navigate = useNavigate()
  const { data: markets, isLoading, error } = useMarkets()
  const [filter, setFilter] = useState<StateFilter>('all')

  const visible = useMemo(
    () => (markets ?? []).filter((m) => matchesFilter(m.state, filter)),
    [markets, filter],
  )

  if (isLoading) return <Stub title="Loading Markets…" />
  if (error) return <Stub title="Error Loading Markets" />

  return (
    <main className="mx-auto max-w-[1680px] px-10 pt-14 pb-12">
      <header className="mb-12">
        <h1 className="font-display text-ink-strong mb-4 text-[56px] leading-none font-medium tracking-[-0.01em] [font-variation-settings:'ROND'_100]">
          Markets
        </h1>
        <p className="text-ink-muted font-mono text-xs tracking-[0.08em] uppercase">
          Predict the path, not the destination. Five AI-generated routes per market.
        </p>
      </header>

      <div className="border-line mb-8 flex items-center gap-2 border-0 border-b pb-5">
        {FILTERS.map((f) => {
          const isActive = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'cursor-pointer rounded-full border px-4 py-2.5',
                'font-mono text-[11px] tracking-[0.1em] uppercase',
                'duration-short ease-levx transition-[color,border-color,background]',
                isActive
                  ? 'border-ink-strong bg-ink-strong text-surface'
                  : 'border-line-strong text-ink-muted hover:border-ink hover:text-ink-strong bg-transparent',
              )}
            >
              [ {f.label.toUpperCase()} ]
            </button>
          )
        })}
        <div className="text-ink-dim ml-auto font-mono text-[10px] tracking-[0.1em] uppercase">
          {visible.length} {visible.length === 1 ? 'MARKET' : 'MARKETS'}
        </div>
      </div>

      <div className="flex flex-col">
        <div
          className={cn(
            ROW_GRID,
            'border-line-strong h-10 border-0 border-b',
            'text-ink-dim font-mono text-[10px] tracking-[0.12em] uppercase',
          )}
        >
          <span>IDX</span>
          <span>PAIR</span>
          <span>STATE</span>
          <span className="text-right">ENDS</span>
          <span className="text-right">POOL</span>
          <span className={cn('text-right', NARROW_HIDE)}>CHECKPOINTS</span>
          <span className={cn('text-right', NARROW_HIDE)}>TRADERS</span>
          <span />
        </div>

        {visible.map((m, idx) => (
          <button
            key={m.id}
            type="button"
            onClick={() => navigate({ to: '/market/$id', params: { id: m.id } })}
            className={cn(
              ROW_GRID,
              'group border-line h-[68px] cursor-pointer border-0 border-b border-l-2 border-l-transparent bg-transparent text-left',
              'duration-short ease-levx transition-[background,border-left-color]',
              'hover:border-l-ink-strong hover:bg-white/[0.02]',
            )}
          >
            <span className="text-ink-dim font-mono text-[11px] tracking-[0.05em]">
              [ {String(idx + 1).padStart(2, '0')} ]
            </span>
            <span className="text-ink-strong font-mono text-sm font-bold tracking-[0.1em] uppercase">
              {m.pair.replace('/', ' / ')}
            </span>
            <span>
              <StatusDot status={m.state}>{STATE_LABELS[m.state]}</StatusDot>
            </span>
            <span className={NUM_CELL}>{endsInLabel(m)}</span>
            <span className={NUM_CELL}>{formatUSD(m.pool)} USDC</span>
            <span className={cn(NUM_CELL, NARROW_HIDE)}>
              {m.completedCheckpoints} / {m.totalCheckpoints}
            </span>
            <span className={cn(NUM_CELL, NARROW_HIDE)}>{m.traders.toLocaleString()}</span>
            <span
              className={cn(
                'text-ink-dim text-right font-mono text-sm',
                'duration-short ease-levx transition-[color,transform]',
                'group-hover:text-ink-strong group-hover:translate-x-1',
              )}
            >
              →
            </span>
          </button>
        ))}

        {visible.length === 0 && (
          <div className="text-ink-dim py-24 text-center font-mono text-[11px] tracking-[0.14em] uppercase">
            <span>[ NO MARKETS MATCH FILTER ]</span>
          </div>
        )}
      </div>
    </main>
  )
}
