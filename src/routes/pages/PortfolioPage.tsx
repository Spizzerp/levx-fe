import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'

interface SettledPosition {
  id: string
  pair: string
  pathName: string
  wagered: number
  payout: number
  score: number
  claimed: boolean
}

const SETTLED_POSITIONS: SettledPosition[] = [
  {
    id: 'set-1',
    pair: 'BTC/USDC',
    pathName: 'Steady Bull',
    wagered: 3000,
    payout: 4250,
    score: 91.2,
    claimed: false,
  },
  {
    id: 'set-2',
    pair: 'ETH/USDC',
    pathName: 'Neutral Drift',
    wagered: 1500,
    payout: 980,
    score: 42.5,
    claimed: true,
  },
  {
    id: 'set-3',
    pair: 'SOL/USDC',
    pathName: 'Aggressive Bear',
    wagered: 2000,
    payout: 3600,
    score: 88.7,
    claimed: false,
  },
  {
    id: 'set-4',
    pair: 'AVAX/USDC',
    pathName: 'Ultra Bull',
    wagered: 500,
    payout: 0,
    score: 12.3,
    claimed: false,
  },
]

const PERFORMANCE = {
  totalPnl: 4330,
  winRate: 67.5,
  accuracy: 72.8,
  totalWagered: 18500,
  marketsParticipated: 12,
}

const ROW_GRID = cn(
  'grid items-center gap-4 px-4',
  'grid-cols-[48px_140px_1fr_140px_120px_100px_72px]',
  '[@media(min-width:1201px)]:grid-cols-[56px_160px_1fr_160px_140px_120px_72px]',
)

const NUM_CELL =
  'text-right whitespace-nowrap font-mono text-xs uppercase tracking-[0.08em] text-ink'

export function PortfolioPage() {
  const handleClaim = (posId: string) => {
    // TODO: Implement claim logic
    console.log('Claiming position:', posId)
  }

  return (
    <PageLayout
      title="Portfolio"
      subtitle="P&L · Claims · Season Points"
      summaryBar={
        <div className="border-line flex items-center gap-12 border-0 border-b pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
              Total P&L
            </div>
            <div
              className={cn(
                'font-mono text-3xl font-bold tracking-[0.02em]',
                PERFORMANCE.totalPnl >= 0 ? 'text-success' : 'text-accent',
              )}
            >
              {PERFORMANCE.totalPnl >= 0 ? '+' : ''}
              {formatUSD(PERFORMANCE.totalPnl)}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
              Win Rate
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {PERFORMANCE.winRate}%
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
              Accuracy
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {PERFORMANCE.accuracy}%
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
              Markets
            </div>
            <div className="text-ink font-mono text-sm tracking-[0.05em]">
              {PERFORMANCE.marketsParticipated} participated · {formatUSD(PERFORMANCE.totalWagered)}{' '}
              wagered
            </div>
          </div>
        </div>
      }
    >
      <div className="border-line mb-8 border-0 border-b pb-4">
        <h2 className="text-ink-strong font-mono text-xs font-bold tracking-[0.1em] uppercase">
          Settled Positions
        </h2>
      </div>

      {SETTLED_POSITIONS.length > 0 ? (
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
            <span className="text-right">PAYOUT</span>
            <span className="text-right">SCORE</span>
            <span />
          </div>

          {/* Position Rows */}
          {SETTLED_POSITIONS.map((pos, idx) => {
            const pnl = pos.payout - pos.wagered
            const isProfit = pnl >= 0
            return (
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
                    <span className="text-ink-muted font-mono text-[11px] tracking-[0.05em]">
                      {pos.pathName}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[11px] tracking-[0.05em]',
                        isProfit ? 'text-success' : 'text-accent',
                      )}
                    >
                      {isProfit ? '+' : ''}
                      {formatUSD(pnl)}
                    </span>
                  </div>
                </span>
                <span className={NUM_CELL}>{formatUSD(pos.wagered)} USDC</span>
                <span className={NUM_CELL}>
                  <span className={isProfit ? 'text-success' : 'text-ink'}>
                    {formatUSD(pos.payout)} USDC
                  </span>
                </span>
                <span className={NUM_CELL}>{pos.score.toFixed(1)}</span>
                <span>
                  {pos.claimed ? (
                    <span className="text-ink-dim font-mono text-[10px] tracking-[0.1em] uppercase">
                      Claimed
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => handleClaim(pos.id)}
                      className="h-8 min-h-0 px-3 py-1 text-[10px]"
                    >
                      Claim
                    </Button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-ink-dim py-24 text-center font-mono text-[11px] tracking-[0.14em] uppercase">
          <span>[ NO SETTLED POSITIONS ]</span>
        </div>
      )}
    </PageLayout>
  )
}
