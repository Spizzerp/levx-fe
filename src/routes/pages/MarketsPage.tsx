import { useNavigate } from '@tanstack/react-router'
import { Filter } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, useState } from 'react'

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
  const [filterOpen, setFilterOpen] = useState(false)

  const handleFilterSelect = useCallback((id: StateFilter) => {
    setFilter(id)
    setFilterOpen(false)
  }, [])

  const visible = useMemo(
    () =>
      (markets ?? [])
        .filter((m) => matchesFilter(m.state, filter))
        .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]),
    [markets, filter],
  )

  const hasAnyMarkets = !isLoading && !isError && (markets?.length ?? 0) > 0

  return (
    <PageLayout
      title="Markets"
      subtitle="Predict the path, not the destination."
      subtitleInline
      headerActions={hasAnyMarkets ? (
        <div className="flex items-center gap-4 pt-6 pb-5">
          {/* Stats */}
          <div className="flex items-center gap-12">
            <div>
              <div className="text-label text-ink-dim mb-1 font-mono uppercase">Volume</div>
              <div className="text-ink-strong font-mono text-2xl font-bold tracking-snug">
                {formatUSD(markets?.reduce((s, m) => s + m.pool, 0) ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-dim mb-1 font-mono uppercase">Active</div>
              <div className="text-ink-strong font-mono text-2xl font-bold tracking-snug flex items-center gap-2">
                {markets?.filter((m) => m.state === 'active').length ?? 0}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-success text-[10px] font-normal tracking-wide">Live</span>
                </span>
              </div>
            </div>
            <div>
              <div className="text-label text-ink-dim mb-1 font-mono uppercase">Markets</div>
              <div className="text-ink-strong font-mono text-2xl font-bold tracking-snug">
                {markets?.length ?? 0}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-dim mb-1 font-mono uppercase">Traders</div>
              <div className="text-ink-strong font-mono text-2xl font-bold tracking-snug">
                {(markets?.reduce((s, m) => s + m.traders, 0) ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Filter toggle — anchored right, expands left */}
          <div className="ml-auto">
            <div
              className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface"
              style={{ overflow: 'clip' }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {!filterOpen ? (
                  <motion.button
                    key="collapsed"
                    type="button"
                    onClick={() => setFilterOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-ink-muted hover:text-ink-strong"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <Filter size={14} strokeWidth={1.5} className="shrink-0" />
                    <span className="font-mono text-label uppercase whitespace-nowrap">
                      {FILTERS.find((f) => f.id === filter)?.label.toUpperCase()}
                    </span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="expanded"
                    className="flex items-center px-2"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    {[
                      FILTERS.find((f) => f.id === filter)!,
                      ...FILTERS.filter((f) => f.id !== filter),
                    ].map((f, i) => (
                      <motion.button
                        key={f.id}
                        type="button"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        onClick={() => handleFilterSelect(f.id)}
                        className={cn(
                          'whitespace-nowrap px-3 py-1 font-mono text-[10px] uppercase tracking-wider',
                          f.id === filter
                            ? 'text-ink-strong'
                            : 'text-ink-dim hover:text-ink-muted',
                        )}
                      >
                        {f.label.toUpperCase()}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

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
        <DataTable
          columns={COLUMNS}
          data={visible}
          gridCols="grid-cols-[48px_140px_1fr_160px_160px_80px_24px]"
          gridColsWide="[@media(min-width:1201px)]:grid-cols-[56px_160px_1fr_200px_200px_120px_160px_120px_24px]"
          keyExtractor={(m) => m.id}
          onRowClick={(m) => navigate({ to: '/market/$id', params: { id: m.id } })}
          emptyMessage="[ NO MARKETS MATCH FILTER ]"
        />
      )}
    </PageLayout>
  )
}
