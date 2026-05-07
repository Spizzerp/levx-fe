import { useMemo } from 'react'

import { StatusDot } from '@/ui/StatusDot'
import { TokenPairIcon } from '@/ui/TokenPairIcon'
import { cn } from '@/lib/cn'
import { formatCountdown, formatMarketDurationLabel, formatShortDate } from '@/lib/format'

import type { Market, MarketState } from '@/types/market'
import type { PythTick } from '@/lib/pyth/types'
import { feedIdForPair } from '@/lib/pyth/feedIds'
import { useLatestPrice } from '@/lib/pyth/hooks'
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
  now: number
  onClick: () => void
}

function appendLiveTick(
  history: Market['history'],
  latestTick: PythTick | null,
): Market['history'] {
  if (!latestTick || !Number.isFinite(latestTick.value)) return history

  const lastHistoryPoint = history[history.length - 1]
  if (lastHistoryPoint && latestTick.time <= lastHistoryPoint.time) return history
  return [...history, { time: latestTick.time, value: latestTick.value }]
}

function calculatePctChange(args: { history: Market['history']; marketStart: number }): {
  value: number
  isPositive: boolean
} {
  if (args.history.length === 0) return { value: 0, isPositive: true }

  const startPricePoint = args.history.reduce((prev, curr) =>
    Math.abs(curr.time - args.marketStart) < Math.abs(prev.time - args.marketStart) ? curr : prev,
  )

  const latestPrice = args.history[args.history.length - 1].value
  const startPrice = startPricePoint.value
  if (startPrice === 0) return { value: 0, isPositive: true }

  const diff = ((latestPrice - startPrice) / startPrice) * 100
  return { value: Math.abs(diff), isPositive: diff >= 0 }
}

function marketTimeLabel(market: Market, now: number): { label: string; value: string } | null {
  if (market.state === 'pending' || market.startTime > now) {
    return { label: 'Opens in:', value: formatCountdown(Math.max(0, market.startTime - now)) }
  }

  if (market.state !== 'settled' && market.state !== 'void' && market.endTime > now) {
    return { label: 'Ends in:', value: formatCountdown(market.endTime - now) }
  }

  return null
}

export function MarketCard({ market, now, onClick }: MarketCardProps) {
  const feedId = feedIdForPair(market.pair)
  const latestTick = useLatestPrice(feedId)
  const { data: realHistory } = useBenchmarksHistory({
    pair: market.pair,
    interval: '1h',
  })

  const historyToUse = realHistory && realHistory.length > 0 ? realHistory : market.history
  const liveHistory = useMemo(
    () => appendLiveTick(historyToUse, latestTick),
    [historyToUse, latestTick],
  )
  const { value: pctChange, isPositive } = calculatePctChange({
    history: liveHistory,
    marketStart: market.startTime,
  })
  const timeLabel = marketTimeLabel(market, now)
  const durationLabel = formatMarketDurationLabel(market.startTime, market.endTime)
  const endDateLabel = formatShortDate(market.endTime)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full flex-col',
        'overflow-hidden',
        'h-[290px]',
        'border-line from-surface-1 to-surface-2 rounded-[24px] border bg-gradient-to-b',
        'text-left',
        'duration-medium ease-levx transition-all',
        'market-card-hover-glow',
        'hover:-translate-y-1.5 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)]',
        isPositive ? 'hover:border-success/50' : 'hover:border-accent/50',
      )}
    >
      {/* ── Background Noise Texture ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Background Dot Pattern ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] transition-opacity duration-500 group-hover:opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--ink-strong) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }}
      />

      {/* ── Background Vignette ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 transition-opacity duration-500 group-hover:opacity-50"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 0%, var(--surface) 100%)`,
        }}
      />

      {/* ── Hover Shine Sweep ── */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <div className="absolute inset-0 h-full w-[200%] -translate-x-full rotate-[35deg] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent transition-transform duration-500 ease-in-out group-hover:translate-x-full" />
      </div>

      {/* Top edge accent — on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-60"
        style={{
          background: isPositive
            ? 'linear-gradient(90deg, transparent 0%, #5CF78B 45%, #F4FA4D 55%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, #FF483B 50%, transparent 100%)',
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex h-full w-full flex-col">
        {/* Top Section: Title & ID */}
        <div className="flex flex-col gap-1 p-6 pb-0">
          <span className="text-ink-strong font-display text-xl leading-tight font-bold">
            Where will {market.base} be by {endDateLabel}?
          </span>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span
              className={cn(
                'flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1',
                'font-mono text-[10px] leading-none',
              )}
            >
              <span className="text-ink-dim">{durationLabel}</span>
              {timeLabel && (
                <>
                  <span aria-hidden className="bg-line-strong h-2.5 w-px opacity-70" />
                  <span>
                    <span className="text-ink-dim">{timeLabel.label}</span>{' '}
                    <span className="text-ink-muted">{timeLabel.value}</span>
                  </span>
                </>
              )}
            </span>
            <span className="text-ink-dim shrink-0 font-mono text-[10px] leading-none tracking-[0.12em] uppercase opacity-60">
              ID: {market.marketId}
            </span>
          </div>
        </div>

        {/* Middle Section: Chart */}
        <div
          className="relative min-h-0 flex-1 px-4"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          }}
        >
          <MarketMiniChart
            history={liveHistory}
            paths={market.paths.length > 0 ? market.paths : undefined}
            nowTime={now}
            marketStart={market.startTime}
            marketEnd={market.endTime}
          />
        </div>

        {/* Bottom Section: Metrics (Glassmorphism Panel) */}
        <div
          className={cn(
            'relative mt-auto flex items-center justify-between px-6 py-4',
            'bg-surface/40 backdrop-blur-xl',
            'group-hover:bg-surface/80 transition-all duration-500',
          )}
        >
          {/* Dashed Top Border (Tech Detail) */}
          <div className="absolute inset-x-0 top-0 h-px bg-[radial-gradient(circle_at_center,_var(--color-line-strong)_1px,_transparent_1px)] bg-[length:4px_1px] opacity-30" />

          {/* Token pair */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <TokenPairIcon base={market.base} quote={market.quote} size={30} />
            </div>
            <div className="flex flex-col">
              <span className="text-ink-muted font-mono text-[11px] leading-none font-bold tracking-widest uppercase">
                {market.base}/{market.quote}
              </span>
              <StatusDot status={market.state} size="compact" className="mt-1">
                {STATE_LABELS[market.state]}
              </StatusDot>
            </div>
          </div>

          {/* % change */}
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  'font-mono text-xl leading-none font-bold tracking-tighter',
                  isPositive ? 'text-success' : 'text-accent',
                )}
                style={{
                  textShadow: isPositive
                    ? '0 0 12px rgba(92,247,139,0.24)'
                    : '0 0 12px rgba(255,72,59,0.24)',
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
          background: isPositive ? 'rgba(92,247,139,0.04)' : 'rgba(255,72,59,0.04)',
        }}
      />
    </button>
  )
}
