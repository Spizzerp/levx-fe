import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, Filter, LayoutGrid, List, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ChartFrame } from '@/features/chart/ChartFrame'
import { MarketCard } from '@/features/market/MarketCard'
import { TokenPairIcon } from '@/ui/TokenPairIcon'
import { DataTable, NUM_CELL, type DataTableColumn } from '@/ui/DataTable'
import { ExpandPill } from '@/ui/ExpandPill'
import { MarketsTableSkeleton } from '@/features/market/MarketsTableSkeleton'
import { QueryErrorState } from '@/ui/QueryErrorState'
import { StatusDot } from '@/ui/StatusDot'
import { cn } from '@/lib/cn'
import { useMarkets } from '@/lib/chain'
import { getMarketDisplayState } from '@/lib/market/status'
import { feedIdForPair } from '@/lib/pyth/feedIds'
import { usePythFeed } from '@/lib/pyth/hooks'
import { formatCountdown, formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'
import type { Market, MarketState } from '@/types/market'

type StateFilter = 'all' | MarketState
type ViewMode = 'table' | 'grid'

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

function endsInLabel(m: Market, now: number): string {
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

function useNowTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function PythFeedSubscription({ feedId }: { feedId: string }) {
  usePythFeed(feedId)
  return null
}

function MarketGridPythSubscriptions({ markets }: { markets: Market[] }) {
  const feedIds = useMemo(
    () =>
      Array.from(
        new Set(
          markets
            .map((market) => feedIdForPair(market.pair))
            .filter((feedId): feedId is string => feedId !== null),
        ),
      ),
    [markets],
  )

  return (
    <>
      {feedIds.map((feedId) => (
        <PythFeedSubscription key={feedId} feedId={feedId} />
      ))}
    </>
  )
}

function buildColumns(now: number): DataTableColumn<Market>[] {
  return [
    {
      key: 'pair',
      header: 'MARKET',
      headerClassName: 'pl-6',
      cellClassName: 'pl-6',
      render: (m) => (
        <span className="flex items-center gap-3">
          <span className="text-ink-strong font-mono text-sm font-bold tracking-wide uppercase">
            {m.base}
          </span>
          <TokenPairIcon base={m.base} quote={m.quote} size={32} />
        </span>
      ),
    },
    {
      key: 'state',
      header: 'STATE',
      render: (m) => {
        const displayState = getMarketDisplayState(m)
        return <StatusDot status={displayState}>{STATE_LABELS[displayState]}</StatusDot>
      },
    },
    {
      key: 'ends',
      header: 'EXPIRES',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (m) => endsInLabel(m, now),
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
            <span className="bg-line-strong relative h-1.5 w-16 overflow-hidden rounded-full">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #F4FA4D, #5CF78B)',
                }}
              />
            </span>
            <span className="text-value text-ink-muted font-mono">
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
        'text-ink-dim flex justify-end',
        'duration-short ease-levx transition-[color,transform]',
        'group-hover:text-ink-strong group-hover:translate-x-1',
      ),
      render: () => <ArrowRight size={16} strokeWidth={1.75} aria-hidden />,
    },
  ]
}

export function MarketsPage() {
  const navigate = useNavigate({ from: '/markets' })
  const { view: viewParam } = useSearch({ from: '/markets' })
  const viewMode = viewParam ?? 'table'

  const { data: markets, isLoading, isError, refetch } = useMarkets()
  const [filter, setFilter] = useState<StateFilter>('all')
  const [page, setPage] = useState(0)
  const [visibleCount, setVisibleCount] = useState(20) // Start with 20 for grid

  // Sync with localStorage for stickiness across navigations
  useEffect(() => {
    const stored = localStorage.getItem('levx-view-mode') as ViewMode | null

    if (!viewParam && stored && stored !== 'table') {
      // 1. URL has no param, but we have a stored preference (that isn't the default)
      navigate({ search: (prev) => ({ ...prev, view: stored }), replace: true })
    } else if (viewParam) {
      // 2. URL has a param (either 'table' or 'grid'), update the stored preference
      localStorage.setItem('levx-view-mode', viewParam)
    }
  }, [viewParam, navigate])

  const setViewMode = (view: ViewMode) => {
    navigate({ search: (prev) => ({ ...prev, view }) })
  }
  const PAGE_SIZE = 10
  const now = useNowTick(1000)
  const COLUMNS = useMemo(() => buildColumns(now), [now])

  const visible = useMemo(
    () =>
      (markets ?? [])
        .filter((m) => matchesFilter(getMarketDisplayState(m), filter))
        .sort(
          (a, b) => STATE_ORDER[getMarketDisplayState(a)] - STATE_ORDER[getMarketDisplayState(b)],
        ),
    [markets, filter],
  )

  const totalPages = Math.ceil(visible.length / PAGE_SIZE)
  const tableItems = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const gridItems = visible.slice(0, visibleCount)

  // Infinite Scroll Observer
  const loadMoreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (viewMode !== 'grid') return
    if (visibleCount >= visible.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20)
        }
      },
      { rootMargin: '200px' },
    )

    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [viewMode, visibleCount, visible.length])

  // Reset page when filter changes
  const handleFilterChange = (id: StateFilter) => {
    setFilter(id)
    setPage(0)
    setVisibleCount(20)
  }

  const hasAnyMarkets = !isLoading && !isError && (markets?.length ?? 0) > 0

  return (
    <PageLayout
      title="Markets"
      subtitle="Predict the path, not the destination."
      subtitleInline
      summaryBar={
        hasAnyMarkets ? (
          <div className="flex items-end gap-4 pb-5">
            {/* Stats */}
            <div className="flex items-center gap-12">
              <div>
                <div className="text-label text-ink-dim mb-1 font-mono uppercase">Volume</div>
                <div className="text-ink-strong tracking-snug font-mono text-4xl font-bold">
                  {formatUSD(markets?.reduce((s, m) => s + m.pool, 0) ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-label text-ink-dim mb-1 font-mono uppercase">Active</div>
                <div className="text-ink-strong tracking-snug flex items-center gap-2 font-mono text-4xl font-bold">
                  {markets?.filter((m) => getMarketDisplayState(m) === 'active').length ?? 0}
                  <span className="inline-flex items-center gap-1">
                    <span className="bg-success h-2 w-2 animate-pulse rounded-full" />
                    <span className="text-success text-label font-normal tracking-wide">Live</span>
                  </span>
                </div>
              </div>
              <div>
                <div className="text-label text-ink-dim mb-1 font-mono uppercase">Markets</div>
                <div className="text-ink-strong tracking-snug font-mono text-4xl font-bold">
                  {markets?.length ?? 0}
                </div>
              </div>
              <div>
                <div className="text-label text-ink-dim mb-1 font-mono uppercase">Traders</div>
                <div className="text-ink-strong tracking-snug font-mono text-4xl font-bold">
                  {(markets?.reduce((s, m) => s + m.traders, 0) ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <ExpandPill
                options={FILTERS}
                value={filter}
                onChange={handleFilterChange}
                icon={<Filter size={14} strokeWidth={1.5} />}
              />

              {/* View mode toggle */}
              <div className="border-line-strong bg-surface inline-flex h-9 items-center rounded-full border">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-label="Table view"
                  className={cn(
                    'flex h-full items-center rounded-l-full px-3',
                    'duration-short ease-levx transition-colors',
                    viewMode === 'table' ? 'text-ink-strong' : 'text-ink-dim hover:text-ink-muted',
                  )}
                >
                  <List size={14} strokeWidth={1.75} />
                </button>
                <span className="bg-line-strong h-4 w-px" aria-hidden />
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={cn(
                    'flex h-full items-center rounded-r-full px-3',
                    'duration-short ease-levx transition-colors',
                    viewMode === 'grid' ? 'text-ink-strong' : 'text-ink-dim hover:text-ink-muted',
                  )}
                >
                  <LayoutGrid size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        ) : undefined
      }
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
        <div className="border-line-strong flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-24">
          <p className="text-ink-muted text-label font-mono uppercase">[ No active markets ]</p>
        </div>
      )}

      {hasAnyMarkets && (
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === 'table' ? (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ChartFrame glow>
                <DataTable
                  columns={COLUMNS}
                  data={tableItems}
                  gridCols="grid-cols-[160px_1fr_160px_160px_80px_24px]"
                  gridColsWide="[@media(min-width:1201px)]:grid-cols-[200px_1fr_200px_200px_120px_160px_120px_24px]"
                  keyExtractor={(m) => m.id}
                  onRowClick={(m) => navigate({ to: '/market/$id', params: { id: m.id } })}
                  emptyMessage="[ NO MARKETS MATCH FILTER ]"
                />
                {totalPages > 1 && (
                  <div className="border-line bg-surface-1 flex items-center justify-center gap-3 rounded-b-2xl border-t px-4 py-3">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className={cn(
                        'text-label border-line-strong rounded-full border px-3 py-1 font-mono tracking-wider uppercase',
                        'duration-short ease-levx transition-colors',
                        page === 0
                          ? 'text-ink-dim cursor-not-allowed'
                          : 'text-ink-muted hover:text-ink-strong hover:border-ink',
                      )}
                    >
                      Prev
                    </button>
                    <span className="text-label text-ink-muted font-mono tracking-wider uppercase">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className={cn(
                        'text-label border-line-strong rounded-full border px-3 py-1 font-mono tracking-wider uppercase',
                        'duration-short ease-levx transition-colors',
                        page >= totalPages - 1
                          ? 'text-ink-dim cursor-not-allowed'
                          : 'text-ink-muted hover:text-ink-strong hover:border-ink',
                      )}
                    >
                      Next
                    </button>
                  </div>
                )}
              </ChartFrame>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <MarketGridPythSubscriptions markets={gridItems} />

              <motion.div
                layout
                className={cn(
                  'grid gap-6',
                  'grid-cols-1 sm:grid-cols-2 [@media(min-width:1201px)]:grid-cols-3',
                )}
              >
                <AnimatePresence mode="popLayout">
                  {gridItems.length > 0 ? (
                    gridItems.map((m, i) => (
                      <motion.div
                        key={m.id}
                        layout
                        className="w-full"
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: -8 }}
                        transition={{
                          duration: 0.3,
                          delay: i * 0.03,
                          ease: [0.25, 0.46, 0.45, 0.94],
                          layout: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
                        }}
                      >
                        <MarketCard
                          market={m}
                          now={now}
                          onClick={() => navigate({ to: '/market/$id', params: { id: m.id } })}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-line-strong col-span-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-24"
                    >
                      <p className="text-ink-muted text-label font-mono uppercase">
                        [ No markets match filter ]
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Infinite Scroll Trigger */}
              {visibleCount < visible.length && (
                <div ref={loadMoreRef} className="flex items-center justify-center py-12">
                  <Loader2 className="text-ink-dim h-6 w-6 animate-spin" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </PageLayout>
  )
}
