import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { DataTable, NUM_CELL, type DataTableColumn } from '@/components/DataTable'
import { StatusDot } from '@/components/StatusDot'
import { Stub } from '@/components/Stub'
import { cn } from '@/lib/cn'
import { useMarkets } from '@/lib/api/hooks'
import { formatCountdown, formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'
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

// Hidden below 1200px (matches old @media rule that hid columns 6 & 7)
const NARROW_HIDE = '[@media(max-width:1200px)]:hidden'

const COLUMNS: DataTableColumn<Market>[] = [
  {
    key: 'idx',
    header: 'IDX',
    cellClassName: 'text-ink-dim font-mono text-[11px] tracking-[0.05em]',
    render: (_, idx) => `[ ${String(idx + 1).padStart(2, '0')} ]`,
  },
  {
    key: 'pair',
    header: 'PAIR',
    cellClassName: 'text-ink-strong font-mono text-sm font-bold tracking-[0.1em] uppercase',
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
  const { data: markets, isLoading, error } = useMarkets()
  const [filter, setFilter] = useState<StateFilter>('all')

  const visible = useMemo(
    () => (markets ?? []).filter((m) => matchesFilter(m.state, filter)),
    [markets, filter],
  )

  if (isLoading) return <Stub title="Loading Markets…" />
  if (error) return <Stub title="Error Loading Markets" />

  return (
    <PageLayout
      title="Markets"
      subtitle="Predict the path, not the destination. Five AI-generated routes per market."
      headerActions={
        <div className="border-line flex items-center gap-2 border-0 border-b pb-5">
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
      }
    >
      <DataTable
        columns={COLUMNS}
        data={visible}
        gridCols="grid-cols-[48px_140px_1fr_160px_160px_24px]"
        gridColsWide="[@media(min-width:1201px)]:grid-cols-[56px_160px_1fr_200px_200px_160px_120px_24px]"
        keyExtractor={(m) => m.id}
        onRowClick={(m) => navigate({ to: '/market/$id', params: { id: m.id } })}
        emptyMessage="[ NO MARKETS MATCH FILTER ]"
      />
    </PageLayout>
  )
}
