import { StatusDot } from '@/ui/StatusDot'
import { TokenPairIcon } from '@/ui/TokenPairIcon'
import { cn } from '@/lib/cn'

import type { Market, MarketState } from '@/types/market'
import { useBenchmarksHistory } from '@/lib/pyth/useBenchmarksHistory'
import { MarketMiniChart } from './MarketMiniChart'

const STATE_LABELS: Record<MarketState, string> = {
  pending: 'Pending',
  active: 'Active',
  sampling: 'Sampling',
  settling: 'Settling',
  maturing: 'Maturing',
  settled: 'Settled',
  void: 'Void',
}



interface MarketCardProps {
  market: Market
  onClick: () => void
}

function calculatePctChange(market: Market): { value: number; isPositive: boolean } {
  if (market.history.length === 0) return { value: 0, isPositive: true }

  // Find the price point closest to startTime
  const startPricePoint = market.history.reduce((prev, curr) => {
    return Math.abs(curr.time - market.startTime) < Math.abs(prev.time - market.startTime)
      ? curr
      : prev
  })

  const latestPrice = market.history[market.history.length - 1].value
  const startPrice = startPricePoint.value

  if (startPrice === 0) return { value: 0, isPositive: true }

  const diff = ((latestPrice - startPrice) / startPrice) * 100
  return {
    value: Math.abs(diff),
    isPositive: diff >= 0,
  }
}

export function MarketCard({ market, onClick }: MarketCardProps) {
  const { data: realHistory } = useBenchmarksHistory({
    pair: market.pair,
    interval: '1h',
  })

  const historyToUse = realHistory && realHistory.length > 0 ? realHistory : market.history
  const { value: pctChange, isPositive } = calculatePctChange({ ...market, history: historyToUse })

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col',
        'overflow-hidden',
        'h-[280px]',
        'p-5',
        'border-line-strong rounded-2xl border',
        'bg-surface',
        'text-left',
        'duration-short ease-levx transition-[border-color,box-shadow,transform]',
        'hover:border-ink/20 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
      )}
    >
      {/* Subtle top-edge gradient accent */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px',
          'opacity-0 transition-opacity duration-300',
          'group-hover:opacity-100',
        )}
        style={{
          background: 'linear-gradient(90deg, #F4FA4D, #5CF78B)',
        }}
      />

      <div className="flex h-full w-full flex-col">
        {/* Row 1 — Market name/title top left */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-ink-strong font-display text-xl font-bold tracking-tight">
              {market.base}
            </span>
            <span className="text-ink-dim text-nano font-mono tracking-widest uppercase">
              {market.quote} Market
            </span>
          </div>
          <StatusDot status={market.state}>{STATE_LABELS[market.state]}</StatusDot>
        </div>

        {/* Row 2 — Chart in the middle with possible paths displayed */}
        <div className="my-4 min-h-0 flex-1">
          <MarketMiniChart history={historyToUse} />
        </div>

        {/* Row 3 — Bottom info */}
        <div className="flex items-end justify-between">
          {/* Bottom left token pair */}
          <div className="flex items-center gap-2.5">
            <TokenPairIcon base={market.base} quote={market.quote} size={28} />
            <span className="text-ink-muted font-mono text-sm font-bold tracking-wider uppercase">
              {market.base}/{market.quote}
            </span>
          </div>

          {/* Bottom right % change since market started */}
          <div className="flex flex-col items-end">
            <span className="text-ink-dim text-nano mb-0.5 font-mono uppercase">Change</span>
            <div
              className={cn(
                'font-mono text-base font-bold leading-none',
                isPositive ? 'text-success' : 'text-accent',
              )}
            >
              {isPositive ? '+' : '-'}
              {pctChange.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

