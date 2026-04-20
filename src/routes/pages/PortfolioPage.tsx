import { useState } from 'react'

import { Lock } from 'lucide-react'

import { Button } from '@/components/Button'
import { ChartFrame } from '@/components/ChartFrame'
import { ConnectGate } from '@/components/ConnectGate'
import { DataTable, NUM_CELL, type DataTableColumn } from '@/components/DataTable'
import { TokenPairIcon } from '@/components/TokenPairIcon'
import { cn } from '@/lib/cn'
import { DOT_GRADIENT } from '@/lib/constants'
import { formatUSD } from '@/lib/format'
import { useExitPosition } from '@/lib/solana/transactions'
import { PageLayout } from '@/layouts/PageLayout'
import { useWalletStore } from '@/stores/walletStore'

type PositionStatus = 'active' | 'sampling' | 'at-risk'

// TODO: replace these mock-only shapes with UserPosition from @/types/market
// once the wallet + indexer layer is wired up.
interface Position {
  id: string
  marketId: string
  /** Numeric on-chain market_id for transaction building */
  marketIdNum: number
  pathIndex: number
  pair: string
  providerNames: string[]
  amount: number
  currentScore: number
  healthFactor?: number
  status: PositionStatus
  openedAt: number
  leverage?: number
}

interface SettledPosition {
  id: string
  pair: string
  providerNames: string[]
  wagered: number
  payout: number
  score: number
  claimed: boolean
}

const MOCK_POSITIONS: Position[] = [
  {
    id: 'pos-1',
    marketId: 'market-1',
    marketIdNum: 0,
    pathIndex: 1,
    pair: 'SOL/USDC',
    providerNames: ['Chronos-2', 'TimesFM 2.5'],
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
    providerNames: ['GJR-GARCH'],
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
    providerNames: ['Merton Jump-Diffusion'],
    amount: 1000,
    currentScore: 34.8,
    healthFactor: 1.12,
    status: 'at-risk',
    openedAt: Date.now() - 86400000 * 1,
    leverage: 3,
  },
]

const SETTLED_POSITIONS: SettledPosition[] = [
  {
    id: 'set-1',
    pair: 'BTC/USDC',
    providerNames: ['Chronos-2', 'Copula Ensemble'],
    wagered: 3000,
    payout: 4250,
    score: 91.2,
    claimed: false,
  },
  {
    id: 'set-2',
    pair: 'ETH/USDC',
    providerNames: ['TimesFM 2.5'],
    wagered: 1500,
    payout: 980,
    score: 42.5,
    claimed: true,
  },
  {
    id: 'set-3',
    pair: 'SOL/USDC',
    providerNames: ['Monte Carlo K-Means'],
    wagered: 2000,
    payout: 3600,
    score: 88.7,
    claimed: false,
  },
  {
    id: 'set-4',
    pair: 'AVAX/USDC',
    providerNames: ['GJR-GARCH'],
    wagered: 500,
    payout: 0,
    score: 12.3,
    claimed: false,
  },
]

const TOTAL_PNL = SETTLED_POSITIONS.reduce((sum, p) => sum + (p.payout - p.wagered), 0)
const WIN_RATE =
  (SETTLED_POSITIONS.filter((p) => p.payout > p.wagered).length / SETTLED_POSITIONS.length) * 100

const STATUS_LABELS: Record<PositionStatus, string> = {
  active: 'Active',
  sampling: 'Sampling',
  'at-risk': 'At Risk',
}

const STATUS_DOT_BG: Record<PositionStatus, string> = {
  active: DOT_GRADIENT.positive,
  sampling: 'var(--color-warning)',
  'at-risk': DOT_GRADIENT.negative,
}

const NARROW_HIDE = '[@media(max-width:1200px)]:hidden'

function PositionStatusDot({ status }: { status: PositionStatus }) {
  return (
    <span className="text-label text-ink-strong inline-flex items-center gap-2 font-mono uppercase">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_DOT_BG[status] }} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}

const PORTFOLIO_SUBTITLE = 'Active & settled positions · P&L · Claims'

export function PortfolioPage() {
  const connected = useWalletStore((s) => s.connected)
  const exitPosition = useExitPosition()
  const [closingPosId, setClosingPosId] = useState<string | null>(null)

  if (!connected) {
    return (
      <PageLayout title="Portfolio" subtitle={PORTFOLIO_SUBTITLE}>
        <div className="flex flex-col items-center justify-center gap-4 py-24 border border-dashed border-line-strong rounded-2xl">
          <Lock size={32} strokeWidth={1.5} className="text-ink-dim" />
          <p className="text-ink-muted font-mono text-label uppercase">
            [ Please connect your wallet to view page content ]
          </p>
        </div>
      </PageLayout>
    )
  }

  const handleCloseClick = (pos: Position) => {
    setClosingPosId(pos.id)
    exitPosition.mutate(
      { marketId: pos.marketIdNum, pathIndex: pos.pathIndex },
      { onSettled: () => setClosingPosId(null) },
    )
  }

  const handleClaim = (posId: string) => {
    // TODO: Implement claim logic
    console.log('Claiming position:', posId)
  }

  const totalWagered =
    MOCK_POSITIONS.reduce((sum, p) => sum + p.amount, 0) +
    SETTLED_POSITIONS.reduce((sum, p) => sum + p.wagered, 0)

  const activeColumns: DataTableColumn<Position>[] = [
    {
      key: 'market',
      header: 'MARKET',
      headerClassName: 'pl-6',
      cellClassName: 'pl-6',
      render: (pos) => {
        const [base, quote] = pos.pair.split('/')
        return (
          <span className="flex items-center gap-3">
            <span className="text-ink-strong font-mono text-sm font-bold tracking-wide uppercase">
              {base}
            </span>
            <TokenPairIcon base={base} quote={quote} size={32} />
          </span>
        )
      },
    },
    {
      key: 'providers',
      header: 'PROVIDERS',
      render: (pos) => (
        <span className="flex items-center gap-3">
          <PositionStatusDot status={pos.status} />
          <span className="text-ink-muted font-mono text-value">
            {pos.providerNames.join(', ')}
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

  const settledColumns: DataTableColumn<SettledPosition>[] = [
    {
      key: 'market',
      header: 'MARKET',
      headerClassName: 'pl-6',
      cellClassName: 'pl-6',
      render: (pos) => {
        const [base, quote] = pos.pair.split('/')
        return (
          <span className="flex items-center gap-3">
            <span className="text-ink-strong font-mono text-sm font-bold tracking-wide uppercase">
              {base}
            </span>
            <TokenPairIcon base={base} quote={quote} size={32} />
          </span>
        )
      },
    },
    {
      key: 'providers',
      header: 'PROVIDERS',
      render: (pos) => {
        const pnl = pos.payout - pos.wagered
        const isProfit = pnl >= 0
        return (
          <span className="flex items-center gap-3">
            <span className="text-ink-muted font-mono text-value">
              {pos.providerNames.join(', ')}
            </span>
            <span
              className={cn(
                'font-mono text-value',
                isProfit ? 'text-success' : 'text-accent',
              )}
            >
              {isProfit ? '+' : ''}
              {formatUSD(pnl)}
            </span>
          </span>
        )
      },
    },
    {
      key: 'wagered',
      header: 'WAGERED',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => `${formatUSD(pos.wagered)} USDC`,
    },
    {
      key: 'payout',
      header: 'PAYOUT',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => {
        const isProfit = pos.payout - pos.wagered >= 0
        return (
          <span className={isProfit ? 'text-success' : 'text-ink'}>
            {formatUSD(pos.payout)} USDC
          </span>
        )
      },
    },
    {
      key: 'score',
      header: 'SCORE',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => pos.score.toFixed(1),
    },
    {
      key: 'action',
      header: '',
      render: (pos) =>
        pos.claimed ? (
          <span className="text-ink-dim font-mono text-caption uppercase">
            Claimed
          </span>
        ) : (
          <Button
            variant="ghost"
            onClick={() => handleClaim(pos.id)}
            className="text-micro h-8 min-h-0 px-3 py-1"
          >
            Claim
          </Button>
        ),
    },
  ]

  return (
    <PageLayout
      title="Portfolio"
      subtitle={PORTFOLIO_SUBTITLE}
      summaryBar={
        <div className="flex items-center gap-12 pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Total P&L
            </div>
            <div
              className={cn(
                'font-mono text-3xl font-bold tracking-[0.02em]',
                TOTAL_PNL >= 0 ? 'text-success' : 'text-accent',
              )}
            >
              {TOTAL_PNL >= 0 ? '+' : ''}
              {formatUSD(TOTAL_PNL)}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Win Rate
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {WIN_RATE.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Open Positions
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {MOCK_POSITIONS.length}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Total Wagered
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {formatUSD(totalWagered)}
            </div>
          </div>
        </div>
      }
    >
      <section>
        <div className="mb-5">
          <h2 className="text-ink-strong font-mono text-caption font-bold tracking-wide uppercase">
            Active Positions
          </h2>
        </div>

        <ChartFrame glow>
          <DataTable
            columns={activeColumns}
            data={MOCK_POSITIONS}
            gridCols="grid-cols-[200px_1fr_140px_120px_100px]"
            gridColsWide="[@media(min-width:1201px)]:grid-cols-[240px_1fr_160px_140px_120px_120px_72px]"
            keyExtractor={(pos) => pos.id}
            emptyMessage="[ NO OPEN POSITIONS ]"
          />
        </ChartFrame>
      </section>

      <section className="mt-12">
        <div className="mb-5">
          <h2 className="text-ink-strong font-mono text-caption font-bold tracking-wide uppercase">
            Settled Positions
          </h2>
        </div>

        <ChartFrame glow>
          <DataTable
            columns={settledColumns}
            data={SETTLED_POSITIONS}
            gridCols="grid-cols-[200px_1fr_140px_140px_120px_72px]"
            gridColsWide="[@media(min-width:1201px)]:grid-cols-[240px_1fr_160px_160px_140px_72px]"
            keyExtractor={(pos) => pos.id}
            emptyMessage="[ NO SETTLED POSITIONS ]"
          />
        </ChartFrame>
      </section>
    </PageLayout>
  )
}
