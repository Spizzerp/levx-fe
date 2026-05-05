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
    Math.abs(curr.time - market.startTime) < Math.abs(prev.time - market.startTime) ? curr : prev,
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
        'hover:-translate-y-1 hover:shadow-[0_20px_48px_-12px_rgba(0,0,0,0.6)]',
        isActive
          ? 'border-line-strong bg-surface-1 hover:border-success/40'
          : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      {/* ── Background Dot Pattern ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] transition-opacity duration-500 group-hover:opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--ink-strong) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }}
      />

      {/* ── Background Vignette ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 transition-opacity duration-500 group-hover:opacity-60"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 0%, var(--surface) 100%)`,
        }}
      />

      {/* ── Hover Shine Sweep ── */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <div className="absolute inset-0 h-full w-[200%] -translate-x-full rotate-[35deg] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />
      </div>

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
            <span className="text-ink-strong font-display text-2xl leading-none font-bold tracking-tight">
              {market.base}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-ink-dim font-mono text-[10px] tracking-widest uppercase">
                {market.quote} Protocol
              </span>
              <div className="bg-line-strong h-1 w-1 rounded-full" />
              <span className="text-ink-muted font-mono text-[10px] tracking-widest uppercase">
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
            maskImage:
              'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          }}
        >
          <MarketMiniChart
            history={historyToUse}
            paths={market.paths.length > 0 ? market.paths : undefined}
          />
        </div>

        {/* Bottom Section: Metrics (Glassmorphism Panel) */}
        <div
          className={cn(
            'relative mt-auto flex items-center justify-between px-5 py-4',
            'border-line/50 bg-surface/40 border-t backdrop-blur-md',
            'group-hover:bg-surface/80 group-hover:border-t-line-strong/50 transition-all duration-500',
          )}
        >
          {/* Token pair */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <TokenPairIcon base={market.base} quote={market.quote} size={28} />
              <div className="bg-ink-strong/5 absolute -inset-1 rounded-full blur-[2px]" />
            </div>
            <div className="flex flex-col">
              <span className="text-ink-muted font-mono text-[11px] leading-none font-bold tracking-wider uppercase">
                {market.base}/{market.quote}
              </span>
              <span className="text-ink-dim font-mono text-[9px] tracking-tight uppercase">
                Pair Index
              </span>
            </div>
          </div>

          {/* % change */}
          <div className="flex flex-col items-end">
            <span className="text-ink-dim mb-1 font-mono text-[10px] leading-none tracking-wide uppercase">
              Performance
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  'font-mono text-lg leading-none font-bold tracking-tighter',
                  isPositive ? 'text-success' : 'text-accent',
                )}
                style={{
                  textShadow: isPositive
                    ? '0 0 12px rgba(92,247,139,0.3)'
                    : '0 0 12px rgba(255,72,59,0.3)',
                }}
              >
                {isPositive ? '+' : '-'}
                {pctChange.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle bottom-right glow on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -bottom-12 z-0 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background: isPositive ? 'rgba(92,247,139,0.08)' : 'rgba(255,72,59,0.08)',
        }}
      />
    </button>
  )
}
