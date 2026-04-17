import { useNavigate } from '@tanstack/react-router'
import { Filter } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ChartFrame } from '@/components/ChartFrame'
import { TokenPairIcon } from '@/components/TokenPairIcon'
import { DataTable, NUM_CELL, type DataTableColumn } from '@/components/DataTable'
import { ExpandPill } from '@/components/ExpandPill'
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
    key: 'pair',
    header: 'MARKET',
    headerClassName: 'pl-6',
    cellClassName: 'pl-6',
    render: (m) => (
      <span className="flex items-center gap-3">
        <span className="text-ink-strong font-mono text-sm font-bold tracking-wide uppercase">{m.base}</span>
        <TokenPairIcon base={m.base} quote={m.quote} size={32} />
      </span>
    ),
  },
  {
    key: 'state',
    header: 'STATE',
    render: (m) => <StatusDot status={m.state}>{STATE_LABELS[m.state]}</StatusDot>,
  },
  {
    key: 'ends',
    header: 'EXPIRES',
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
    header: 'PROGRESS',
    headerClassName: cn('text-right', NARROW_HIDE),
    cellClassName: cn(NARROW_HIDE, 'flex items-center justify-end gap-2'),
    render: (m) => {
      const pct = m.totalCheckpoints > 0 ? (m.completedCheckpoints / m.totalCheckpoints) * 100 : 0
      return (
        <span className="flex items-center gap-2">
          <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-line-strong">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #F4FA4D, #5CF78B)',
              }}
            />
          </span>
          <span className="font-mono text-value text-ink-muted">
            {m.completedCheckpoints}/{m.totalCheckpoints}
          </span>
        </span>
      )
    },
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
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  const visible = useMemo(
    () =>
      (markets ?? [])
        .filter((m) => matchesFilter(m.state, filter))
        .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]),
    [markets, filter],
  )

  const totalPages = Math.ceil(visible.length / PAGE_SIZE)
  const paged = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page when filter changes
  const handleFilterChange = (id: StateFilter) => {
    setFilter(id)
    setPage(0)
  }

  const hasAnyMarkets = !isLoading && !isError && (markets?.length ?? 0) > 0

  return (
    <PageLayout
      title="Markets"
      subtitle="Predict the path, not the destination."
      subtitleInline
      summaryBar={hasAnyMarkets ? (
        <div className="flex items-end gap-4 pb-5">
          {/* Stats */}
          <div className="flex items-center gap-12">
            <div>
              <div className="text-label text-ink-dim mb-1 font-mono uppercase">Volume</div>
              <div className="text-ink-strong font-mono text-4xl font-bold tracking-snug">
                {formatUSD(markets?.reduce((s, m) => s + m.pool, 0) ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-dim mb-1 font-mono uppercase">Active</div>
              <div className="text-ink-strong font-mono text-4xl font-bold tracking-snug flex items-center gap-2">
                {markets?.filter((m) => m.state === 'active').length ?? 0}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-success text-[10px] font-normal tracking-wide">Live</span>
                </span>
              </div>
            </div>
            <div>
              <div className="text-label text-ink-dim mb-1 font-mono uppercase">Markets</div>
              <div className="text-ink-strong font-mono text-4xl font-bold tracking-snug">
                {markets?.length ?? 0}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-dim mb-1 font-mono uppercase">Traders</div>
              <div className="text-ink-strong font-mono text-4xl font-bold tracking-snug">
                {(markets?.reduce((s, m) => s + m.traders, 0) ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          <ExpandPill
            options={FILTERS}
            value={filter}
            onChange={handleFilterChange}
            icon={<Filter size={14} strokeWidth={1.5} />}
            className="ml-auto"
          />

        </div>
      ) : undefined}
    >
      {isLoading && <MarketsTableSkeleton />}

      {isError && (
        <QueryErrorState
          title="We couldn't load markets"
          message="The feed hiccupped. Try again."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && !hasAnyMarkets && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 border border-dashed border-line-strong rounded-2xl">
          <p className="text-ink-muted font-mono text-label uppercase">
            [ No active markets ]
          </p>
        </div>
      )}

      {hasAnyMarkets && (
        <ChartFrame glow>
          <DataTable
            columns={COLUMNS}
            data={paged}
            gridCols="grid-cols-[160px_1fr_160px_160px_80px_24px]"
            gridColsWide="[@media(min-width:1201px)]:grid-cols-[200px_1fr_200px_200px_120px_160px_120px_24px]"
            keyExtractor={(m) => m.id}
            onRowClick={(m) => navigate({ to: '/market/$id', params: { id: m.id } })}
            emptyMessage="[ NO MARKETS MATCH FILTER ]"
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 border-t border-line bg-surface-1 px-4 py-3 rounded-b-2xl">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className={cn(
                  'font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full border border-line-strong',
                  'duration-short ease-levx transition-colors',
                  page === 0 ? 'text-ink-dim cursor-not-allowed' : 'text-ink-muted hover:text-ink-strong hover:border-ink',
                )}
              >
                Prev
              </button>
              <span className="font-mono text-[10px] text-ink-muted uppercase tracking-wider">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className={cn(
                  'font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full border border-line-strong',
                  'duration-short ease-levx transition-colors',
                  page >= totalPages - 1 ? 'text-ink-dim cursor-not-allowed' : 'text-ink-muted hover:text-ink-strong hover:border-ink',
                )}
              >
                Next
              </button>
            </div>
          )}
        </ChartFrame>
      )}
    </PageLayout>
  )
}
