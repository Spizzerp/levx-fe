import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { DataTable, NUM_CELL, type DataTableColumn } from '@/components/DataTable'
import { MarketsTableSkeleton } from '@/components/MarketsTableSkeleton'
import { QueryErrorState } from '@/components/QueryErrorState'
import { StatusDot } from '@/components/StatusDot'
import { cn } from '@/lib/cn'
import { useMarkets } from '@/lib/chain'
import { formatCountdown, formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'
import type { Market, MarketState } from '@/types/market'

type StateFilter = 'all' | MarketState

const STATE_LABELS: Record<MarketState, string> = {
  pending: 'Pending',
  active: 'Active',
  sampling: 'Sampling',
  settling: 'Settling',
  maturing: 'Maturing',
  settled: 'Settled',
  void: 'Void',
}

/**
 * Display order for the markets table — active trading first, then
 * in-flight lifecycle states, settled/void last. Locked per Phase 2 CONTEXT.
 */
const STATE_ORDER: Record<MarketState, number> = {
  active: 0,
  sampling: 1,
  pending: 2,
  settling: 3,
  maturing: 4,
  settled: 5,
  void: 6,
}

const FILTERS: { id: StateFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'active', label: 'Active' },
  { id: 'sampling', label: 'Sampling' },
  { id: 'settling', label: 'Settling' },
  { id: 'maturing', label: 'Maturing' },
  { id: 'settled', label: 'Settled' },
  { id: 'void', label: 'Void' },
]

function matchesFilter(state: MarketState, filter: StateFilter): boolean {
  return filter === 'all' || state === filter
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

// Hidden below 1200px (matches old @media rule that hid columns 6 & 7)
const NARROW_HIDE = '[@media(max-width:1200px)]:hidden'

const COLUMNS: DataTableColumn<Market>[] = [
  {
    key: 'idx',
    header: 'IDX',
    cellClassName: 'text-ink-dim font-mono text-value',
    render: (_, idx) => `[ ${String(idx + 1).padStart(2, '0')} ]`,
  },
  {
    key: 'pair',
    header: 'PAIR',
    cellClassName: 'text-ink-strong font-mono text-sm font-bold tracking-wide uppercase',
    render: (m) => m.pair.replace('/', ' / '),
  },
  {
    key: 'state',
    header: 'STATE',
    render: (m) => <StatusDot status={m.state}>{STATE_LABELS[m.state]}</StatusDot>,
  },
  {
    key: 'ends',
    header: 'ENDS',
    headerClassName: 'text-right',
    cellClassName: NUM_CELL,
    render: (m) => endsInLabel(m),
  },
  {
    key: 'pool',
    header: 'POOL',
    headerClassName: 'text-right',
    cellClassName: NUM_CELL,
    render: (m) => `${formatUSD(m.pool)} USDC`,
  },
  {
    key: 'paths',
    header: 'PATHS',
    headerClassName: 'text-right',
    cellClassName: NUM_CELL,
    render: (m) => (m.paths.length > 0 ? String(m.paths.length) : '—'),
  },
  {
    key: 'checkpoints',
    header: 'CHECKPOINTS',
    headerClassName: cn('text-right', NARROW_HIDE),
    cellClassName: cn(NUM_CELL, NARROW_HIDE),
    render: (m) => `${m.completedCheckpoints} / ${m.totalCheckpoints}`,
  },
  {
    key: 'traders',
    header: 'TRADERS',
    headerClassName: cn('text-right', NARROW_HIDE),
    cellClassName: cn(NUM_CELL, NARROW_HIDE),
    render: (m) => m.traders.toLocaleString(),
  },
  {
    key: 'arrow',
    header: '',
    cellClassName: cn(
      'text-ink-dim text-right font-mono text-sm',
      'duration-short ease-levx transition-[color,transform]',
      'group-hover:text-ink-strong group-hover:translate-x-1',
    ),
    render: () => '→',
  },
]

export function MarketsPage() {
  const navigate = useNavigate()
  const { data: markets, isLoading, isError, refetch } = useMarkets()
  const [filter, setFilter] = useState<StateFilter>('all')

  const visible = useMemo(
    () =>
      (markets ?? [])
        .filter((m) => matchesFilter(m.state, filter))
        .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]),
    [markets, filter],
  )

  if (isLoading) {
    return (
      <PageLayout
        title="Markets"
        subtitle="Predict the path, not the destination. Five AI-generated routes per market."
      >
        <MarketsTableSkeleton />
      </PageLayout>
    )
  }

  if (isError) {
    return (
      <PageLayout
        title="Markets"
        subtitle="Predict the path, not the destination. Five AI-generated routes per market."
      >
        <QueryErrorState
          title="We couldn't load markets"
          message="The feed hiccupped. Try again."
          onRetry={() => void refetch()}
        />
      </PageLayout>
    )
  }

  const hasAnyMarkets = (markets?.length ?? 0) > 0

  // True empty state — no markets exist at all.
  if (!hasAnyMarkets) {
    return (
      <PageLayout
        title="Markets"
        subtitle="Predict the path, not the destination. Five AI-generated routes per market."
      >
        <div className="text-ink-dim border-line border border-dashed py-24 text-center font-mono text-label tracking-widest uppercase">
          [ NO ACTIVE MARKETS ]
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Markets"
      subtitle="Predict the path, not the destination. Five AI-generated routes per market."
      headerActions={
        <div className="border-line flex items-center gap-2 border-0 border-b pb-5 text-sm">
          {FILTERS.map((f) => {
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'cursor-pointer rounded-full border px-4 py-2.5',
                  'text-label font-mono uppercase',
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
          <div className="text-ink-dim text-caption ml-auto font-mono uppercase">
            {visible.length} {visible.length === 1 ? 'MARKET' : 'MARKETS'}
          </div>
        </div>
      }
    >
      <DataTable
        columns={COLUMNS}
        data={visible}
        gridCols="grid-cols-[48px_140px_1fr_160px_160px_80px_24px]"
        gridColsWide="[@media(min-width:1201px)]:grid-cols-[56px_160px_1fr_200px_200px_120px_160px_120px_24px]"
        keyExtractor={(m) => m.id}
        onRowClick={(m) => navigate({ to: '/market/$id', params: { id: m.id } })}
        emptyMessage="[ NO MARKETS MATCH FILTER ]"
      />
    </PageLayout>
  )
}
