import { useState, useMemo } from 'react'

import { Lock } from 'lucide-react'

import { Button } from '@/ui/Button'
import { ChartFrame } from '@/features/chart/ChartFrame'
import { ConnectGate } from '@/features/wallet/ConnectGate'
import { DataTable, NUM_CELL, type DataTableColumn } from '@/ui/DataTable'
import { TokenPairIcon } from '@/ui/TokenPairIcon'
import { cn } from '@/lib/cn'
import { DOT_GRADIENT } from '@/lib/constants'
import { formatUSD } from '@/lib/format'
import { useUserPositions } from '@/lib/chain'
import { useUsdcBalance } from '@/lib/api/useUsdcBalance'
import { useExitPosition, useClaim } from '@/lib/solana/transactions'
import { PageLayout } from '@/layouts/PageLayout'
import { useWalletStore } from '@/stores/walletStore'
import { RequestUsdcButton } from '@/features/wallet/RequestUsdcButton'
import type { MarketState, UserPosition } from '@/types/market'

const PORTFOLIO_SUBTITLE = 'Active & settled positions · P&L · Claims'
const NARROW_HIDE = '[@media(max-width:1200px)]:hidden'

const ACTIVE_STATES: ReadonlySet<MarketState> = new Set([
  'pending',
  'active',
  'sampling',
  'settling',
  'maturing',
])
const TERMINAL_STATES: ReadonlySet<MarketState> = new Set(['settled', 'void'])

/**
 * Mirrors `exit_position.rs:91-93` — the program rejects exits in any
 * other state. Surface a status label instead of a Close button on
 * Settling/Maturing/Pending rows so users don't fire txs that will
 * deterministically revert.
 */
const EXITABLE_STATES: ReadonlySet<MarketState> = new Set(['active', 'sampling'])

function awaitingLabel(state: MarketState): string {
  switch (state) {
    case 'pending':
      return 'Awaiting paths'
    case 'settling':
      return 'Awaiting scoring'
    case 'maturing':
      return 'Awaiting finalize'
    default:
      return 'Awaiting'
  }
}

interface ActionStatus {
  /** Stable id of the row currently in flight (or null). */
  id: string | null
  /** What action is happening — drives the button label. */
  kind: 'closing' | 'claiming' | null
}

function PositionStatusDot({ state }: { state: MarketState }) {
  const tone =
    state === 'active' || state === 'sampling'
      ? DOT_GRADIENT.positive
      : state === 'maturing' || state === 'settling'
        ? 'var(--color-warning)'
        : DOT_GRADIENT.negative
  return (
    <span className="text-label text-ink-strong inline-flex items-center gap-2 font-mono uppercase">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} aria-hidden />
      {state}
    </span>
  )
}

export function PortfolioPage() {
  const connected = useWalletStore((s) => s.connected)
  const { data: positions = [], isLoading } = useUserPositions()
  const { data: usdcBalance } = useUsdcBalance()
  const exitPosition = useExitPosition()
  const claim = useClaim()
  const [action, setAction] = useState<ActionStatus>({ id: null, kind: null })

  const { active, settled } = useMemo(() => {
    const a: UserPosition[] = []
    const s: UserPosition[] = []
    for (const p of positions) {
      if (TERMINAL_STATES.has(p.marketState)) s.push(p)
      else if (ACTIVE_STATES.has(p.marketState)) a.push(p)
    }
    return { active: a, settled: s }
  }, [positions])

  const totalWagered = useMemo(
    () => positions.reduce((sum, p) => sum + p.collateral, 0),
    [positions],
  )
  const totalPnl = useMemo(
    () =>
      settled.reduce((sum, p) => sum + (p.estimatedPayout - p.collateral), 0),
    [settled],
  )
  const winRate = useMemo(() => {
    if (settled.length === 0) return 0
    const wins = settled.filter((p) => p.estimatedPayout > p.collateral).length
    return (wins / settled.length) * 100
  }, [settled])

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

  const handleCloseClick = (pos: UserPosition) => {
    setAction({ id: pos.id, kind: 'closing' })
    exitPosition.mutate(
      { marketId: pos.marketIdNum, pathIndex: pos.pathIndex },
      { onSettled: () => setAction({ id: null, kind: null }) },
    )
  }

  const handleClaim = (pos: UserPosition) => {
    setAction({ id: pos.id, kind: 'claiming' })
    claim.mutate(
      { marketId: pos.marketIdNum, pathIndex: pos.pathIndex },
      { onSettled: () => setAction({ id: null, kind: null }) },
    )
  }

  const activeColumns: DataTableColumn<UserPosition>[] = [
    {
      key: 'market',
      header: 'MARKET',
      headerClassName: 'pl-6',
      cellClassName: 'pl-6',
      render: (pos) => (
        <span className="flex items-center gap-3">
          <span className="text-ink-strong font-mono text-sm font-bold tracking-wide uppercase">
            {pos.base}
          </span>
          <TokenPairIcon base={pos.base} quote={pos.quote} size={32} />
        </span>
      ),
    },
    {
      key: 'state',
      header: 'STATE',
      render: (pos) => (
        <span className="flex items-center gap-3">
          <PositionStatusDot state={pos.marketState} />
          <span className="text-ink-muted font-mono text-value">{pos.pathLabel}</span>
        </span>
      ),
    },
    {
      key: 'collateral',
      header: 'WAGERED',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => `${formatUSD(pos.collateral)} USDC`,
    },
    {
      key: 'payout',
      header: 'EST PAYOUT',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => `${formatUSD(pos.estimatedPayout)} USDC`,
    },
    {
      key: 'multiplier',
      header: 'ENTRY ×',
      headerClassName: cn('text-right', NARROW_HIDE),
      cellClassName: cn(NUM_CELL, NARROW_HIDE),
      render: (pos) => `${pos.entryMultiplier.toFixed(2)}×`,
    },
    {
      key: 'leverage',
      header: 'LEVERAGE',
      headerClassName: cn('text-right', NARROW_HIDE),
      cellClassName: cn(NUM_CELL, NARROW_HIDE),
      render: (pos) => (pos.leverage > 1 ? `${pos.leverage}×` : '—'),
    },
    {
      key: 'action',
      header: '',
      render: (pos) => {
        if (!EXITABLE_STATES.has(pos.marketState)) {
          return (
            <span className="text-ink-dim font-mono text-caption uppercase">
              {awaitingLabel(pos.marketState)}
            </span>
          )
        }
        const closing = action.id === pos.id && action.kind === 'closing'
        const otherInFlight = action.id !== null && action.id !== pos.id
        return (
          <ConnectGate>
            <Button
              variant="ghost"
              onClick={() => handleCloseClick(pos)}
              disabled={closing || otherInFlight}
              className="text-micro min-h-0 h-8 px-3 py-1"
            >
              {closing ? 'Closing…' : 'Close'}
            </Button>
          </ConnectGate>
        )
      },
    },
  ]

  const settledColumns: DataTableColumn<UserPosition>[] = [
    {
      key: 'market',
      header: 'MARKET',
      headerClassName: 'pl-6',
      cellClassName: 'pl-6',
      render: (pos) => (
        <span className="flex items-center gap-3">
          <span className="text-ink-strong font-mono text-sm font-bold tracking-wide uppercase">
            {pos.base}
          </span>
          <TokenPairIcon base={pos.base} quote={pos.quote} size={32} />
        </span>
      ),
    },
    {
      key: 'pnl',
      header: 'PATH · P&L',
      render: (pos) => {
        const pnl = pos.estimatedPayout - pos.collateral
        const isProfit = pnl >= 0
        return (
          <span className="flex items-center gap-3">
            <span className="text-ink-muted font-mono text-value">{pos.pathLabel}</span>
            <span
              className={cn('font-mono text-value', isProfit ? 'text-success' : 'text-accent')}
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
      render: (pos) => `${formatUSD(pos.collateral)} USDC`,
    },
    {
      key: 'payout',
      header: 'PAYOUT',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => {
        const isProfit = pos.estimatedPayout >= pos.collateral
        return (
          <span className={isProfit ? 'text-success' : 'text-ink'}>
            {formatUSD(pos.estimatedPayout)} USDC
          </span>
        )
      },
    },
    {
      key: 'state',
      header: 'STATE',
      headerClassName: 'text-right',
      cellClassName: NUM_CELL,
      render: (pos) => (
        <span className="text-ink-dim font-mono text-caption uppercase">{pos.marketState}</span>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (pos) => {
        if (pos.claimed) {
          return (
            <span className="text-ink-dim font-mono text-caption uppercase">Claimed</span>
          )
        }
        const claiming = action.id === pos.id && action.kind === 'claiming'
        const otherInFlight = action.id !== null && action.id !== pos.id
        // void markets reclaim collateral; settled markets pay out via the same `claim` ix.
        const label = pos.marketState === 'void' ? 'Reclaim' : 'Claim'
        return (
          <Button
            variant="ghost"
            onClick={() => handleClaim(pos)}
            disabled={claiming || otherInFlight}
            className="text-micro h-8 min-h-0 px-3 py-1"
          >
            {claiming ? 'Claiming…' : label}
          </Button>
        )
      },
    },
  ]

  return (
    <PageLayout
      title="Portfolio"
      subtitle={PORTFOLIO_SUBTITLE}
      summaryBar={
        <div className="flex items-center gap-12 pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">Total P&L</div>
            <div
              className={cn(
                'font-mono text-3xl font-bold tracking-[0.02em]',
                totalPnl >= 0 ? 'text-success' : 'text-accent',
              )}
            >
              {totalPnl >= 0 ? '+' : ''}
              {formatUSD(totalPnl)}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">Win Rate</div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {winRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">Open Positions</div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {active.length}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">Total Wagered</div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {formatUSD(totalWagered)}
            </div>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            <div>
              <div className="text-label text-ink-muted mb-2 font-mono uppercase">USDC Balance</div>
              <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
                {usdcBalance ? formatUSD(usdcBalance.balance) : '—'}
              </div>
            </div>
            <RequestUsdcButton />
          </div>
        </div>
      }
    >
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-ink-strong font-mono text-caption font-bold tracking-wide uppercase">
            Active Positions
          </h2>
        </div>

        <ChartFrame glow>
          <DataTable
            columns={activeColumns}
            data={active}
            gridCols="grid-cols-[200px_1fr_140px_140px_120px]"
            gridColsWide="[@media(min-width:1201px)]:grid-cols-[240px_1fr_160px_160px_120px_120px_72px]"
            keyExtractor={(pos) => pos.id}
            emptyMessage={isLoading ? '[ LOADING POSITIONS… ]' : '[ NO OPEN POSITIONS ]'}
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
            data={settled}
            gridCols="grid-cols-[200px_1fr_140px_140px_120px_72px]"
            gridColsWide="[@media(min-width:1201px)]:grid-cols-[240px_1fr_160px_160px_140px_72px]"
            keyExtractor={(pos) => pos.id}
            emptyMessage={isLoading ? '[ LOADING POSITIONS… ]' : '[ NO SETTLED POSITIONS ]'}
          />
        </ChartFrame>
      </section>
    </PageLayout>
  )
}
