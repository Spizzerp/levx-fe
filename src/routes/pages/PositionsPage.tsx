import { useState } from 'react'

import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'

type PositionStatus = 'active' | 'sampling' | 'at-risk'

interface Position {
  id: string
  marketId: string
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

// Row grid matching MarketsPage pattern
const ROW_GRID = cn(
  'grid items-center gap-4 px-4',
  'grid-cols-[48px_140px_1fr_140px_120px_100px_24px]',
  '[@media(min-width:1201px)]:grid-cols-[56px_160px_1fr_160px_140px_120px_120px_24px]',
)

const NUM_CELL =
  'text-right whitespace-nowrap font-mono text-xs uppercase tracking-[0.08em] text-ink'

const NARROW_HIDE = '[@media(max-width:1200px)]:hidden'

function PositionStatusDot({ status }: { status: PositionStatus }) {
  const colorClass = STATUS_DOT_COLORS[status]
  return (
    <span className="text-label text-ink-muted inline-flex items-center gap-2 font-mono tracking-[0.1em] uppercase">
      <span className={cn('h-1.5 w-1.5 rounded-full', colorClass)} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PositionsPage() {
  const [closingPosId, setClosingPosId] = useState<string | null>(null)

  const handleCloseClick = (posId: string) => {
    setClosingPosId(posId)
    // TODO: Implement close position logic
    setTimeout(() => setClosingPosId(null), 1000)
  }

  return (
    <PageLayout
      title="Positions"
      subtitle="Track your active positions and real-time performance"
      summaryBar={
        <div className="border-line flex items-center gap-12 border-0 border-b pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
              Total Wagered
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {formatUSD(MOCK_POSITIONS.reduce((sum, p) => sum + p.amount, 0))}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
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
            <div className="text-ink-dim font-mono text-[10px] tracking-[0.1em] uppercase">
              {MOCK_POSITIONS.length} {MOCK_POSITIONS.length === 1 ? 'POSITION' : 'POSITIONS'}
            </div>
          </div>
        </div>
      }
    >
      {MOCK_POSITIONS.length > 0 ? (
        <div className="flex flex-col">
          {/* Header Row */}
          <div
            className={cn(
              ROW_GRID,
              'border-line-strong h-10 border-0 border-b',
              'text-ink-dim font-mono text-[10px] tracking-[0.12em] uppercase',
            )}
          >
            <span>IDX</span>
            <span>MARKET</span>
            <span>PATH</span>
            <span className="text-right">WAGERED</span>
            <span className="text-right">SCORE</span>
            <span className={cn('text-right', NARROW_HIDE)}>HEALTH</span>
            <span className={cn('text-right', NARROW_HIDE)}>LEVERAGE</span>
            <span />
          </div>

          {/* Position Rows */}
          {MOCK_POSITIONS.map((pos, idx) => (
            <div
              key={pos.id}
              className={cn(
                ROW_GRID,
                'group border-line h-[68px] border-0 border-b border-l-2 border-l-transparent',
                'duration-short ease-levx transition-[background,border-left-color]',
                'hover:border-l-ink-strong hover:bg-white/[0.02]',
              )}
            >
              <span className="text-ink-dim font-mono text-[11px] tracking-[0.05em]">
                [ {String(idx + 1).padStart(2, '0')} ]
              </span>
              <span className="text-ink-strong font-mono text-sm font-bold tracking-[0.1em] uppercase">
                {pos.pair.replace('/', ' / ')}
              </span>
              <span>
                <div className="flex items-center gap-3">
                  <PositionStatusDot status={pos.status} />
                  <span className="text-ink-muted font-mono text-[11px] tracking-[0.05em]">
                    {pos.pathName}
                  </span>
                </div>
              </span>
              <span className={NUM_CELL}>{formatUSD(pos.amount)} USDC</span>
              <span className={NUM_CELL}>{pos.currentScore.toFixed(1)}</span>
              <span className={cn(NUM_CELL, NARROW_HIDE)}>
                <span
                  className={
                    pos.healthFactor !== undefined && pos.healthFactor < 1.5
                      ? 'text-accent'
                      : 'text-ink'
                  }
                >
                  {pos.healthFactor?.toFixed(2) ?? '—'}
                </span>
              </span>
              <span className={cn(NUM_CELL, NARROW_HIDE)}>
                {pos.leverage ? `${pos.leverage}x` : '—'}
              </span>
              <span>
                <Button
                  variant="ghost"
                  onClick={() => handleCloseClick(pos.id)}
                  disabled={closingPosId === pos.id}
                  className="min-h-0 h-8 px-3 py-1 text-[10px]"
                >
                  {closingPosId === pos.id ? 'Closing...' : 'Close'}
                </Button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-ink-dim py-24 text-center font-mono text-[11px] tracking-[0.14em] uppercase">
          <span>[ NO OPEN POSITIONS ]</span>
        </div>
      )}
    </PageLayout>
  )
}
