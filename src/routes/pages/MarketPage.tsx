import { useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { DrawingLayer } from '@/components/DrawingLayer'
import { Input } from '@/components/Input'
import { Label } from '@/components/Label'
import { LevXChart } from '@/components/LevXChart'
import { TimeRangePicker, type CandleInterval } from '@/components/TimeRangePicker'
import { PathRow } from '@/components/PathRow'
import { SegmentedSlider } from '@/components/SegmentedSlider'
import { StatusDot } from '@/components/StatusDot'
import { Stub } from '@/components/Stub'
import { UserPositionCard } from '@/components/UserPositionCard'
import { cn } from '@/lib/cn'
import { useMarket, useUserPosition } from '@/lib/api/hooks'
import { usePythFeed, useLatestPrice } from '@/lib/pyth/hooks'
import { feedIdForPair } from '@/lib/pyth/feedIds'
import { useBenchmarksHistory } from '@/lib/pyth/useBenchmarksHistory'
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'

import { useDrawingStore } from '@/stores/drawingStore'
import {
  formatCountdown,
  formatDeltaBps,
  formatMarketDurationLabel,
  formatUSD,
  maxLeverageByDuration,
} from '@/lib/format'
import type { MarketState } from '@/types/market'

/* ── Market duration options ─────────────────────────────── */

type DurationOption = '1d' | '3d' | '7d' | '30d' | '90d'

const DURATION_OPTIONS: { id: DurationOption; label: string; ms: number }[] = [
  { id: '1d', label: '1 Day', ms: 1 * 24 * 60 * 60 * 1000 },
  { id: '3d', label: '3 Days', ms: 3 * 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: '90d', label: '90 Days', ms: 90 * 24 * 60 * 60 * 1000 },
]

/* ── Checkpoint interval options (seconds) ───────────────── */

type IntervalOption = '5m' | '15m' | '30m' | '1h' | '2h' | '4h'

const INTERVAL_OPTIONS: { id: IntervalOption; label: string; sec: number }[] = [
  { id: '5m', label: '5 Min', sec: 5 * 60 },
  { id: '15m', label: '15 Min', sec: 15 * 60 },
  { id: '30m', label: '30 Min', sec: 30 * 60 },
  { id: '1h', label: '1 Hour', sec: 60 * 60 },
  { id: '2h', label: '2 Hours', sec: 2 * 60 * 60 },
  { id: '4h', label: '4 Hours', sec: 4 * 60 * 60 },
]

const STATE_TO_STATUS: Record<MarketState, MarketState> = {
  pending: 'pending',
  active: 'active',
  sampling: 'sampling',
  settling: 'settling',
  maturing: 'maturing',
  settled: 'settled',
  void: 'void',
}

const STATE_LABELS: Record<MarketState, string> = {
  pending: 'Pending',
  active: 'Active',
  sampling: 'Active · Sampling',
  settling: 'Settling',
  maturing: 'Maturing',
  settled: 'Settled',
  void: 'Void',
}

const META_SEP = <span className="text-line-strong mx-0.5">·</span>

export function MarketPage() {
  const { id } = useParams({ from: '/market/$id' })
  const { data: market, isLoading, error } = useMarket(id)
  const { data: userPosition } = useUserPosition(id)

  const pair = market?.pair ?? null
  const feedId = pair ? feedIdForPair(pair) : null
  usePythFeed(feedId)
  const latestTick = useLatestPrice(feedId)

  const [candleInterval, setCandleInterval] = useState<CandleInterval>('1h')

  const { data: benchmarksHistory, isLoading: isBenchmarksLoading } = useBenchmarksHistory({
    pair,
    interval: candleInterval,
  })

  const drawingPhase = useDrawingStore((s) => s.state.phase)
  const enterDrawMode = useDrawingStore((s) => s.enterDrawMode)
  const exitDrawMode = useDrawingStore((s) => s.exitDrawMode)

  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [leverage, setLeverage] = useState(22)
  const [collateral, setCollateral] = useState('25.00')
  const [mountTime] = useState(() => Date.now())
  const [marketDuration, setMarketDuration] = useState<DurationOption | null>(null)
  const [checkpointIntervalId, setCheckpointIntervalId] = useState<IntervalOption | null>(null)
  const [showOtherPositions, setShowOtherPositions] = useState(false)

  // Exit draw mode on unmount so a user navigating away doesn't leave the store in sweeping state.
  useEffect(() => () => exitDrawMode(), [exitDrawMode])

  const now = mountTime

  // Whether both market params are selected — AI paths require both
  const marketParamsReady = marketDuration != null && checkpointIntervalId != null

  // Derive chart schedule. On Active markets the user picks duration+interval
  // (the market is being configured client-side until creation); on every
  // other state the schedule is fixed on-chain, so we read it from `market`.
  const selectedDuration = marketDuration ? DURATION_OPTIONS.find((d) => d.id === marketDuration)! : null
  const selectedInterval = checkpointIntervalId ? INTERVAL_OPTIONS.find((i) => i.id === checkpointIntervalId)! : null
  const isActiveConfig = market?.state === 'active'
  const chartMarketStart = isActiveConfig
    ? (latestTick ? latestTick.time : now)
    : (market?.startTime ?? now)
  const chartMarketEnd = isActiveConfig
    ? chartMarketStart + (selectedDuration?.ms ?? 0)
    : (market?.endTime ?? chartMarketStart)
  const chartCheckpointInterval = isActiveConfig
    ? (selectedInterval?.sec ?? 3600)
    : (market?.checkpointInterval ?? 3600)
  const chartTotalCheckpoints = isActiveConfig
    ? (selectedDuration ? Math.floor(selectedDuration.ms / 1000 / chartCheckpointInterval) : 0)
    : (market?.totalCheckpoints ?? 0)

  const durationMs = isActiveConfig ? (selectedDuration?.ms ?? 0) : Math.max(0, chartMarketEnd - chartMarketStart)
  const msRemaining = Math.max(0, chartMarketEnd - now)
  const leverageCap = maxLeverageByDuration(durationMs)

  // Prefer real Benchmarks candles; fall back to mock history while loading
  const chartHistory =
    benchmarksHistory && benchmarksHistory.length > 0 ? benchmarksHistory : (market?.history ?? [])

  // Live price from Pyth tick; fall back to last history point
  const priceDisplay =
    latestTick?.value ?? chartHistory[chartHistory.length - 1]?.value ?? 0

  // Generate 5 AI prediction paths anchored to current price + market params.
  // When a real backend exists, these come from on-chain PathOutcome accounts.
  const aiPaths = useMemo(() => {
    // For non-Active states, on-chain paths would come from `market.paths`.
    // Until the indexer lands, generate fixture paths from the market schedule
    // so the chart isn't empty.
    const ready = isActiveConfig
      ? marketParamsReady && priceDisplay > 0
      : chartTotalCheckpoints > 0 && priceDisplay > 0
    if (!ready) return []
    const paths = buildAiPathFixture({
      startTime: chartMarketStart,
      checkpointInterval: chartCheckpointInterval,
      totalCheckpoints: chartTotalCheckpoints,
      basePrice: priceDisplay,
    })
    // Mock opponent wagers on a few paths so the "Show Other Positions" toggle
    // has something to render. Remove this when real on-chain data flows in.
    paths[0].totalWagered = 4_250  // ultra-bull
    paths[1].totalWagered = 12_800 // bull — most popular
    paths[3].totalWagered = 1_900  // bear
    return paths
  }, [isActiveConfig, marketParamsReady, chartMarketStart, chartCheckpointInterval, chartTotalCheckpoints, priceDisplay])

  // Default selection = the middle (neutral) path on first load
  const activePathId = selectedPathId ?? aiPaths[2]?.id ?? null
  const selectedPath = aiPaths.find((p) => p.id === activePathId)
  const lastPoint = selectedPath?.data[selectedPath.data.length - 1]
  const firstPoint = selectedPath?.data[0]
  const isLong = lastPoint && firstPoint ? lastPoint.value >= firstPoint.value : true

  // Delta is only available from the mock layer (not from live Pyth ticks in Phase 1)
  const deltaDisplay = 0
  const deltaColor = deltaDisplay >= 0 ? 'text-success' : 'text-accent'

  const isInDrawMode = drawingPhase !== 'idle'

  /* ── Early returns AFTER all hooks ─────────────────────────── */
  if (isLoading) return <Stub title="Loading Market..." />
  if (error || !market) return <Stub title="Market Not Found" subtitle={id} />

  // Only Active markets expose the full draw + wager control rail. Other
  // states (pending, sampling, settling, maturing, settled, void) show a
  // chart-dominated layout. If the user holds a position on a non-Active
  // market, a slim position card occupies the rail in its place.
  const showWagerRail = market.state === 'active'
  const showPositionRail = !showWagerRail && !!userPosition
  const showRail = showWagerRail || showPositionRail

  return (
    <main
      className={cn(
        'mx-auto grid max-w-[1680px] grid-cols-1 gap-14 px-10 pt-14 pb-12',
        showRail && '[@media(min-width:1181px)]:grid-cols-[1fr_400px] [@media(min-width:1181px)]:gap-[72px]',
      )}
    >
      {/* ── Chart column ─────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center gap-4">
          <span className="text-ink-muted font-mono text-xs tracking-widest uppercase">
            {market.pair.replace('/', ' / ')}
          </span>
          <StatusDot status={STATE_TO_STATUS[market.state]}>{STATE_LABELS[market.state]}</StatusDot>
        </div>

        <h1 className="font-display text-ink-strong my-[6px] mb-[10px] text-[56px] leading-none font-medium tracking-[-0.01em] [font-variation-settings:'ROND'_100]">
          {formatUSD(priceDisplay)}
        </h1>

        <div className="text-ink-muted flex items-baseline gap-3 font-mono text-[13px]">
          <span className={cn('font-bold', deltaColor)}>{formatDeltaBps(deltaDisplay)}</span>
          <span>24H</span>
        </div>

        <div className="text-ink-dim mt-8 flex flex-nowrap items-center gap-2 overflow-hidden font-mono text-caption tracking-normal whitespace-nowrap uppercase">
          {market.state === 'pending' ? (
            <>
              <span>MARKET STARTS IN</span>
              <span className="text-ink-muted ml-1">
                {formatCountdown(Math.max(0, market.startTime - now))}
              </span>
            </>
          ) : (
            <>
              <span>MARKET ENDS</span>
              <span className="text-ink-muted ml-1">{formatCountdown(msRemaining)}</span>
            </>
          )}
          {META_SEP}
          <span>POOL</span>
          <span className="text-ink-muted ml-1">{formatUSD(market.pool)} USDC</span>
          {META_SEP}
          <span>CHECKPOINTS</span>
          <span className="text-ink-muted ml-1">
            {market.completedCheckpoints} / {chartTotalCheckpoints}
          </span>
          {META_SEP}
          <span>TRADERS</span>
          <span className="text-ink-muted ml-1">{market.traders.toLocaleString()}</span>
          {META_SEP}
          <span>ENTRY FEE</span>
          <span className="text-ink-muted ml-1">{(market.entryFeeBps / 100).toFixed(1)}%</span>
        </div>

        <div className="mt-8">
          <TimeRangePicker value={candleInterval} onChange={setCandleInterval} />
        </div>

        <div className="mt-4 h-[420px] [@media(min-width:1181px)]:h-[520px]">
          <LevXChart
            history={chartHistory}
            predictions={aiPaths}
            nowTime={latestTick ? latestTick.time : now}
            marketStart={chartMarketStart}
            marketEnd={chartMarketEnd}
            selectedPathId={activePathId}
            selectionInteractive={showWagerRail}
            showOtherPositions={showOtherPositions}
            pair={market.pair}
            isLoading={isBenchmarksLoading}
            error={null}
            market={{
              startTime: chartMarketStart,
              checkpointInterval: chartCheckpointInterval,
              totalCheckpoints: chartTotalCheckpoints,
            }}
            renderDrawingOverlay={({ xScale, yScale, innerWidth, innerHeight, checkpointXs, marketStart, margin }) => (
              <DrawingLayer
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                xScale={xScale as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                yScale={yScale as any}
                innerWidth={innerWidth}
                innerHeight={innerHeight}
                margin={margin}
                checkpointXs={checkpointXs}
                marketStart={marketStart}
              />
            )}
          />
        </div>
      </section>

      {/* ── Right rail (Active markets only) ───────────────────── */}
      {showWagerRail && (
      <aside className="flex flex-col">
        {/* ── Market Duration ─────────────────────── */}
        <Label>Market Duration</Label>
        <div className="mt-3 inline-flex flex-wrap gap-1 font-mono text-tag uppercase">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setMarketDuration(d.id)}
              className={cn(
                'border px-3 py-1 transition-opacity',
                marketDuration === d.id
                  ? 'border-line-strong text-ink-strong'
                  : 'border-line text-ink-muted hover:text-ink-strong',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* ── Checkpoint Interval ─────────────────── */}
        <Label className="mt-6">Checkpoint Interval</Label>
        <div className="mt-3 inline-flex flex-wrap gap-1 font-mono text-tag uppercase">
          {INTERVAL_OPTIONS.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setCheckpointIntervalId(i.id)}
              className={cn(
                'border px-3 py-1 transition-opacity',
                checkpointIntervalId === i.id
                  ? 'border-line-strong text-ink-strong'
                  : 'border-line text-ink-muted hover:text-ink-strong',
              )}
            >
              {i.label}
            </button>
          ))}
        </div>
        <p className="text-ink-dim mt-2 font-mono text-caption tracking-[0.06em]">
          {marketParamsReady ? `${chartTotalCheckpoints} checkpoints` : 'Select duration & interval'}
        </p>

        <hr className="bg-line my-7 h-px border-0" />

        <Label>Select A Line</Label>

        <div className="border-line mt-5 border-0 border-t">
          {aiPaths.map((p, idx) => (
            <PathRow
              key={p.id}
              index={idx + 1}
              name={p.label}
              multiplier={`${p.multiplier.toFixed(2)}×`}
              wagered={p.totalWagered}
              active={activePathId === p.id}
              onClick={() => setSelectedPathId(p.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowOtherPositions((v) => !v)}
          className={cn(
            'mt-4 flex w-full items-center gap-2.5 py-2 font-mono text-label uppercase',
            'duration-short ease-levx transition-colors',
            showOtherPositions ? 'text-ink-strong' : 'text-ink-dim hover:text-ink-muted',
          )}
        >
          <span
            className={cn(
              'flex h-3.5 w-3.5 items-center justify-center border',
              showOtherPositions ? 'border-ink-strong bg-ink-strong' : 'border-line-strong bg-transparent',
            )}
          >
            {showOtherPositions && (
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                <path d="M1 3L3 5L7 1" stroke="var(--color-surface, #000)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          Show Other Positions
        </button>

        {/*
          ── Draw button — desktop only (mobile gate: pure Tailwind CSS) ──
          This project uses DESKTOP-FIRST custom variants in src/style/customVariants.css:
          `md:` = `@media (max-width: 1024px)`. So base classes apply on desktop
          and `md:` variants override on viewports ≤1024px.
        */}
        <div data-testid="draw-button-wrapper" className="block md:hidden">
          <Button
            variant={isInDrawMode ? 'primary' : 'dashed'}
            fullWidth
            className="mt-5"
            disabled={!marketParamsReady && !isInDrawMode}
            onClick={() => {
              if (drawingPhase === 'idle') {
                enterDrawMode(chartTotalCheckpoints)
              } else {
                exitDrawMode()
              }
            }}
          >
            {isInDrawMode ? 'Cancel Drawing' : '+ Draw Custom Path'}
          </Button>
        </div>
        <div
          data-testid="drawing-desktop-notice"
          className="mt-5 hidden md:block font-mono text-sm text-[color:var(--color-ink-dim,#666)]"
        >
          Drawing requires desktop
        </div>

        {market.leverageEnabled && (
          <>
            <hr className="bg-line my-9 mb-8 h-px border-0" />

            <div className="mb-8">
              <div className="mb-[14px] flex items-baseline justify-between">
                <Label>Leverage</Label>
                <span className="text-ink-strong font-mono text-[15px] font-bold">
                  {Math.min(leverage, leverageCap)}×
                </span>
              </div>
              <SegmentedSlider
                value={Math.min(leverage, leverageCap)}
                max={leverageCap}
                onChange={setLeverage}
              />
              <div className="text-ink-dim mt-2.5 flex justify-between font-mono text-caption uppercase">
                <span>1×</span>
                <span>
                  {leverageCap}× MAX · {formatMarketDurationLabel(market.startTime, market.endTime)}
                </span>
              </div>
            </div>
          </>
        )}

        {!market.leverageEnabled && <hr className="bg-line my-9 mb-8 h-px border-0" />}

        <Input
          label="Collateral"
          value={collateral}
          onChange={(e) => setCollateral(e.target.value)}
          unit="USDC"
          inputMode="decimal"
          className="mb-8"
        />

        <Button
          variant="primary"
          fullWidth
          className="mt-2"
          disabled={market.state !== 'active'}
        >
          Open {isLong ? 'Long' : 'Short'} Position
        </Button>
      </aside>
      )}

      {/* ── Right rail (non-Active markets with a user position) ── */}
      {showPositionRail && userPosition && (
        <aside className="flex flex-col">
          <UserPositionCard position={userPosition} marketState={market.state} />
        </aside>
      )}
    </main>
  )
}
