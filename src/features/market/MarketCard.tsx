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

  const startPricePoint = market.history.reduce((prev, curr) =>
    Math.abs(curr.time - market.startTime) < Math.abs(prev.time - market.startTime)
      ? curr
      : prev
  )

  const latestPrice = market.history[market.history.length - 1].value
  const startPrice = startPricePoint.value
  if (startPrice === 0) return { value: 0, isPositive: true }

  const diff = ((latestPrice - startPrice) / startPrice) * 100
  return { value: Math.abs(diff), isPositive: diff >= 0 }
}

export function MarketCard({ market, onClick }: MarketCardProps) {
  const { data: realHistory } = useBenchmarksHistory({
    pair: market.pair,
    interval: '1h',
  })

  const historyToUse = realHistory && realHistory.length > 0 ? realHistory : market.history
  const { value: pctChange, isPositive } = calculatePctChange({ ...market, history: historyToUse })
  const isActive = market.state === 'active' || market.state === 'sampling'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col',
        'overflow-hidden',
        'h-[280px]',
        'rounded-2xl border',
        'text-left',
        'duration-medium ease-levx transition-all',
        'hover:scale-[1.01] hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]',
        isActive
          ? 'border-line-strong bg-surface-1 hover:border-success/30'
          : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      {/* ── Background Vignette ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 transition-opacity duration-500 group-hover:opacity-60"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 0%, var(--surface) 100%)`,
        }}
      />

      {/* Top edge accent — on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: isPositive
            ? 'linear-gradient(90deg, transparent 0%, #5CF78B 45%, #F4FA4D 55%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, #FF483B 50%, transparent 100%)',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex h-full w-full flex-col">
        
        {/* Top Section: Title & Status */}
        <div className="flex items-start justify-between p-5 pb-0">
          <div className="flex flex-col gap-1">
            <span className="text-ink-strong font-display text-2xl font-bold leading-none tracking-tight">
              {market.base}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-ink-dim text-[10px] font-mono tracking-widest uppercase">
                {market.quote} Protocol
              </span>
              <div className="h-1 w-1 rounded-full bg-line-strong" />
              <span className="text-ink-muted text-[10px] font-mono tracking-widest uppercase">
                v1.0
              </span>
            </div>
          </div>
          <StatusDot status={market.state}>{STATE_LABELS[market.state]}</StatusDot>
        </div>

        {/* Middle Section: Chart */}
        <div
          className="relative min-h-0 flex-1 px-2"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          }}
        >
          <MarketMiniChart
            history={historyToUse}
            paths={market.paths.length > 0 ? market.paths : undefined}
          />
        </div>

        {/* Bottom Section: Metrics (Glassmorphism Panel) */}
        <div className={cn(
          "relative mt-auto flex items-center justify-between px-5 py-4",
          "border-t border-line/50 bg-surface/40 backdrop-blur-md",
          "transition-colors duration-300 group-hover:bg-surface/60"
        )}>
          {/* Token pair */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <TokenPairIcon base={market.base} quote={market.quote} size={28} />
              <div className="absolute -inset-1 rounded-full bg-ink-strong/5 blur-[2px]" />
            </div>
            <div className="flex flex-col">
              <span className="text-ink-muted font-mono text-[11px] font-bold tracking-wider uppercase leading-none">
                {market.base}/{market.quote}
              </span>
              <span className="text-ink-dim text-[9px] font-mono uppercase tracking-tight">
                Pair Index
              </span>
            </div>
          </div>

          {/* % change */}
          <div className="flex flex-col items-end">
            <span className="text-ink-dim text-[10px] font-mono uppercase tracking-wide leading-none mb-1">
              Performance
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  'font-mono text-lg font-bold leading-none tracking-tighter',
                  isPositive ? 'text-success' : 'text-accent',
                )}
                style={{
                  textShadow: isPositive
                    ? '0 0 12px rgba(92,247,139,0.3)'
                    : '0 0 12px rgba(255,72,59,0.3)',
                }}
              >
                {isPositive ? '+' : '-'}{pctChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Subtle bottom-right glow on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -right-12 z-0 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background: isPositive ? 'rgba(92,247,139,0.08)' : 'rgba(255,72,59,0.08)',
        }}
      />
    </button>
  )
}
