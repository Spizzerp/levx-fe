import { useState } from 'react'

import { Button } from '@/components/Button'
import { ConnectGate } from '@/components/ConnectGate'
import { DataTable, NUM_CELL, type DataTableColumn } from '@/components/DataTable'
import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { useExitPosition, useClaim } from '@/lib/solana/transactions'
import { PageLayout } from '@/layouts/PageLayout'

type PositionStatus = 'active' | 'sampling' | 'at-risk'

interface Position {
  id: string
  marketId: string
  /** Numeric on-chain market_id for transaction building */
  marketIdNum: number
  pathIndex: number
  pair: string
  pathName: string
  pathTone: string
  amount: number
  currentScore: number
  healthFactor?: number
  status: PositionStatus
  openedAt: number
  leverage?: number
}

// Mock positions data (will be replaced with real API data)
const MOCK_POSITIONS: Position[] = [
  {
    id: 'pos-1',
    marketId: 'market-1',
    marketIdNum: 0,
    pathIndex: 1,
    pair: 'SOL/USDC',
    pathName: 'Steady Bull',
    pathTone: 'bull',
    amount: 2500,
    currentScore: 87.3,
    healthFactor: 2.45,
    status: 'active',
    openedAt: Date.now() - 86400000 * 3,
    leverage: 2,
  },
  {
    id: 'pos-2',
    marketId: 'market-2',
    marketIdNum: 1,
    pathIndex: 2,
    pair: 'ETH/USDC',
    pathName: 'Neutral Drift',
    pathTone: 'neutral',
    amount: 5000,
    currentScore: 62.1,
    healthFactor: 1.82,
    status: 'active',
    openedAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'pos-3',
    marketId: 'market-3',
    marketIdNum: 2,
    pathIndex: 3,
    pair: 'BTC/USDC',
    pathName: 'Aggressive Bear',
    pathTone: 'bear',
    amount: 1000,
    currentScore: 34.8,
    healthFactor: 1.12,
    status: 'at-risk',
    openedAt: Date.now() - 86400000 * 1,
    leverage: 3,
  },
]

const STATUS_LABELS: Record<PositionStatus, string> = {
  active: 'Active',
  sampling: 'Sampling',
  'at-risk': 'At Risk',
}

const STATUS_DOT_COLORS: Record<PositionStatus, string> = {
  active: 'bg-success',
  sampling: 'bg-warning',
  'at-risk': 'bg-accent',
}

const NARROW_HIDE = '[@media(max-width:1200px)]:hidden'

function PositionStatusDot({ status }: { status: PositionStatus }) {
  const colorClass = STATUS_DOT_COLORS[status]
  return (
    <span className="text-label text-ink-muted inline-flex items-center gap-2 font-mono uppercase">
      <span className={cn('h-1.5 w-1.5 rounded-full', colorClass)} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PositionsPage() {
  const exitPosition = useExitPosition()
  const [closingPosId, setClosingPosId] = useState<string | null>(null)

  const handleCloseClick = (pos: Position) => {
    setClosingPosId(pos.id)
    exitPosition.mutate(
      { marketId: pos.marketIdNum, pathIndex: pos.pathIndex },
      { onSettled: () => setClosingPosId(null) },
    )
  }

  const columns: DataTableColumn<Position>[] = [
    {
      key: 'idx',
      header: 'IDX',
      cellClassName: 'text-ink-dim font-mono text-value',
      render: (_, idx) => `[ ${String(idx + 1).padStart(2, '0')} ]`,
    },
    {
      key: 'market',
      header: 'MARKET',
      cellClassName: 'text-ink-strong font-mono text-sm font-bold tracking-wide uppercase',
      render: (pos) => pos.pair.replace('/', ' / '),
    },
    {
      key: 'path',
      header: 'PATH',
      render: (pos) => (
        <span className="flex items-center gap-3">
          <PositionStatusDot status={pos.status} />
          <span className="text-ink-muted font-mono text-value">
            {pos.pathName}
          </span>
        </span>
      ),
    },
    {
      key: 'wagered',
      header: 'WAGERED',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => `${formatUSD(pos.amount)} USDC`,
    },
    {
      key: 'score',
      header: 'SCORE',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => pos.currentScore.toFixed(1),
    },
    {
      key: 'health',
      header: 'HEALTH',
      headerClassName: cn('text-right', NARROW_HIDE),
      cellClassName: cn(NUM_CELL, NARROW_HIDE),
      render: (pos) => (
        <span
          className={
            pos.healthFactor !== undefined && pos.healthFactor < 1.5
              ? 'text-accent'
              : 'text-ink'
          }
        >
          {pos.healthFactor?.toFixed(2) ?? '—'}
        </span>
      ),
    },
    {
      key: 'leverage',
      header: 'LEVERAGE',
      headerClassName: cn('text-right', NARROW_HIDE),
      cellClassName: cn(NUM_CELL, NARROW_HIDE),
      render: (pos) => (pos.leverage ? `${pos.leverage}x` : '—'),
    },
    {
      key: 'action',
      header: '',
      render: (pos) => (
        <ConnectGate>
          <Button
            variant="ghost"
            onClick={() => handleCloseClick(pos)}
            disabled={closingPosId === pos.id}
            className="text-micro min-h-0 h-8 px-3 py-1"
          >
            {closingPosId === pos.id ? 'Closing…' : 'Close'}
          </Button>
        </ConnectGate>
      ),
    },
  ]

  return (
    <PageLayout
      title="Positions"
      subtitle="Track your active positions and real-time performance"
      summaryBar={
        <div className="border-line flex items-center gap-12 border-0 border-b pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Total Wagered
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {formatUSD(MOCK_POSITIONS.reduce((sum, p) => sum + p.amount, 0))}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Avg Score
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {(
                MOCK_POSITIONS.reduce((sum, p) => sum + p.currentScore, 0) /
                MOCK_POSITIONS.length
              ).toFixed(1)}
            </div>
          </div>
          <div className="ml-auto">
            <div className="text-ink-dim font-mono text-caption uppercase">
              {MOCK_POSITIONS.length} {MOCK_POSITIONS.length === 1 ? 'POSITION' : 'POSITIONS'}
            </div>
          </div>
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={MOCK_POSITIONS}
        gridCols="grid-cols-[48px_140px_1fr_140px_120px_100px_24px]"
        gridColsWide="[@media(min-width:1201px)]:grid-cols-[56px_160px_1fr_160px_140px_120px_120px_24px]"
        keyExtractor={(pos) => pos.id}
        emptyMessage="[ NO OPEN POSITIONS ]"
      />
    </PageLayout>
  )
}
