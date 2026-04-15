import { useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { ChartFrame } from '@/components/ChartFrame'
import { ConnectGate } from '@/components/ConnectGate'
import { DrawingLayer } from '@/components/DrawingLayer'
import { Input } from '@/components/Input'
import { Label } from '@/components/Label'
import { LevXChart } from '@/components/LevXChart'
import { MarketMetaPanel } from '@/components/MarketMetaPanel'
import { MarketStateBadge } from '@/components/MarketStateBadge'
import { MaturityCountdownCard } from '@/components/MaturityCountdownCard'
import { QueryErrorState } from '@/components/QueryErrorState'
import { TimeRangePicker, type CandleInterval } from '@/components/TimeRangePicker'
import { PathRow } from '@/components/PathRow'
import { SegmentedSlider } from '@/components/SegmentedSlider'
import { Stub } from '@/components/Stub'
import { UserPositionCard } from '@/components/UserPositionCard'
import { cn } from '@/lib/cn'
import { useMarket, useUserPosition } from '@/lib/chain'
import { usePlaceWager, useClaim } from '@/lib/solana/transactions'
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
import type { Market, PredictionPath, PricePoint } from '@/types/market'

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

const META_SEP = <span className="text-line-strong mx-0.5">·</span>

/**
 * Placeholder claim action surfaced during Settled state. The real claim
 * transaction lands in Phase 5 (CLAIM-01); Phase 2 just ensures the button is
 * present, state-gated, and wallet-gated via ConnectGate.
 */
function ClaimButton({ market, pathIndex }: { market: Market; pathIndex?: number }) {
  const claim = useClaim()
  const idx = pathIndex ?? 0

  return (
    <div className="border-line flex flex-col gap-3 border p-6">
      <p className="text-ink-strong font-mono text-label tracking-wide uppercase">
        Claim available
      </p>
      <p className="text-ink-muted font-mono text-sm leading-relaxed">
        Market has settled. Claim your payout below.
      </p>
      <ConnectGate>
        <Button
          variant="primary"
          fullWidth
          disabled={claim.isPending}
          onClick={() => claim.mutate({ marketId: market.marketId, pathIndex: idx })}
        >
          {claim.isPending ? 'Confirming…' : 'Claim'}
        </Button>
      </ConnectGate>
      {claim.isError && (
        <p className="text-accent font-mono text-caption mt-1">
          {(claim.error as Error).message}
        </p>
      )}
    </div>
  )
}

export function MarketPage() {
  const { id } = useParams({ from: '/market/$id' })
  const { data: market, isLoading, isError, refetch } = useMarket(id)
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

  const placeWager = usePlaceWager()

  const drawingState = useDrawingStore((s) => s.state)
  const drawingPhase = drawingState.phase
  const enterDrawMode = useDrawingStore((s) => s.enterDrawMode)
  const exitDrawMode = useDrawingStore((s) => s.exitDrawMode)

  const [selectedPathIds, setSelectedPathIds] = useState<Set<string>>(new Set())
  const [userPaths, setUserPaths] = useState<PredictionPath[]>([])
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null)
  const [leverage, setLeverage] = useState(22)
  const [collateral, setCollateral] = useState('25.00')
  const [mountTime] = useState(() => Date.now())
  const [showOtherPositions, setShowOtherPositions] = useState(false)

  // Exit draw mode on unmount so a user navigating away doesn't leave the store in sweeping state.
  useEffect(() => () => exitDrawMode(), [exitDrawMode])

  const now = mountTime

  // Chart schedule from on-chain market params
  const chartMarketStart = market?.startTime ?? now
  const chartMarketEnd = market?.endTime ?? now
  const chartCheckpointInterval = market?.checkpointInterval ?? 3600
  const chartTotalCheckpoints = market?.totalCheckpoints ?? 0

  const durationMs = Math.max(0, chartMarketEnd - chartMarketStart)
  const msRemaining = Math.max(0, chartMarketEnd - now)
  const leverageCap = maxLeverageByDuration(durationMs)

  // Prefer real Benchmarks candles; fall back to mock history while loading
  const chartHistory =
    benchmarksHistory && benchmarksHistory.length > 0 ? benchmarksHistory : (market?.history ?? [])

  // Live price from Pyth tick; fall back to last history point
  const priceDisplay =
    latestTick?.value ?? chartHistory[chartHistory.length - 1]?.value ?? 0

  // Use on-chain paths when available (active markets always have AI paths assigned).
  // Fall back to fixture paths for display when market.paths is empty (mock mode).
  const aiPaths = useMemo(() => {
    if (market?.paths?.length > 0) return market.paths

    // Fallback: generate fixture paths for mock/demo
    // Paths span from market start to market end, anchored at the price
    // where the history line crosses the START marker
    if (chartTotalCheckpoints <= 0 || priceDisplay <= 0) return []

    // Find the price closest to marketStart from history
    let startPrice = priceDisplay
    if (chartHistory.length > 0) {
      let closest = chartHistory[0]
      let closestDist = Math.abs(closest.time - chartMarketStart)
      for (const pt of chartHistory) {
        const dist = Math.abs(pt.time - chartMarketStart)
        if (dist < closestDist) {
          closest = pt
          closestDist = dist
        }
      }
      startPrice = closest.value
    }

    const paths = buildAiPathFixture({
      startTime: chartMarketStart,
      checkpointInterval: chartCheckpointInterval,
      totalCheckpoints: chartTotalCheckpoints,
      basePrice: startPrice,
    })
    paths[0].totalWagered = 4_250
    paths[1].totalWagered = 12_800
    paths[3].totalWagered = 1_900
    return paths
  }, [market?.paths, chartHistory, chartMarketStart, chartCheckpointInterval, chartTotalCheckpoints, priceDisplay])

  // Combine AI paths + user-drawn paths for chart
  const allPaths = useMemo(() => [...aiPaths, ...userPaths], [aiPaths, userPaths])

  const handleConfirmDrawing = () => {
    if (drawingState.phase !== 'ready') return
    const values = drawingState.values
    const intervalMs = chartCheckpointInterval * 1000
    const data: PricePoint[] = values.map((v, i) => ({
      time: chartMarketStart + i * intervalMs,
      value: v,
    }))
    const userPath: PredictionPath = {
      id: `user-${Date.now()}`,
      label: 'Your Path',
      tone: 'custom',
      origin: 'user',
      multiplier: 0,
      data,
      pathIndex: allPaths.length,
      predictedPrices: values,
      numCheckpoints: values.length,
      initialProbabilityBps: 0,
      generationTimestamp: Date.now(),
      creator: '',
      cumulativeAction: 0,
      compositeScore: 0,
      peakAmplitude: 0,
      amplitudeAtDecoherence: 0,
      dissolved: false,
      dissolvedAtCheckpoint: 0,
      checkpointsProcessed: 0,
      totalWagered: 0,
      totalLeveragedExposure: 0,
      lmsrSharesOutstanding: 0,
      currentImpliedProbability: 0,
    }
    setUserPaths((prev) => [...prev, userPath])
    setSelectedPathIds((prev) => new Set([...prev, userPath.id]))
    exitDrawMode()
  }

  // Default selection = the middle (neutral) path on first load
  // For chart highlight, use first selected or default to middle path
  const activePathId = selectedPathIds.size > 0 ? [...selectedPathIds][0] : null
  const selectedPath = allPaths.find((p) => p.id === activePathId)
  const lastPoint = selectedPath?.data[selectedPath.data.length - 1]
  const firstPoint = selectedPath?.data[0]
  const isLong = lastPoint && firstPoint ? lastPoint.value >= firstPoint.value : true

  // Delta is only available from the mock layer (not from live Pyth ticks in Phase 1)
  const deltaDisplay = 0
  const deltaColor = deltaDisplay >= 0 ? 'text-success' : 'text-accent'

  const isInDrawMode = drawingPhase !== 'idle'

  /* ── Early returns AFTER all hooks ─────────────────────────── */
  if (isLoading) return <Stub title="Loading Market..." />
  if (isError || !market) {
    return (
      <main className="mx-auto max-w-[1680px] px-10 pt-14 pb-12">
        <QueryErrorState
          title="Market unavailable"
          message="We could not load this market. Please try again."
          onRetry={() => void refetch()}
        />
      </main>
    )
  }

  /* ── State-gated right-rail content ──────────────────────────
   *   active / sampling → WagerPanel (renders inline below)
   *   maturing         → MaturityCountdownCard
   *   settled          → ClaimButton (ConnectGate-wrapped)
   *   pending / settling / void → empty rail
   *   Non-active states with a user position also show the position card.
   */
  const showWagerRail = market.state === 'active' || market.state === 'sampling'
  const showMaturityCard = market.state === 'maturing'
  const showClaimCard = market.state === 'settled'
  const showPositionRail = !showWagerRail && !!userPosition
  const showRail =
    showWagerRail || showMaturityCard || showClaimCard || showPositionRail

  return (
    <main
      className={cn(
        'mx-auto grid max-w-[1680px] grid-cols-1 items-start gap-14 px-10 pt-6 pb-12',
        showRail && '[@media(min-width:1181px)]:grid-cols-[1fr_400px] [@media(min-width:1181px)]:gap-[72px]',
      )}
    >
      {/* ── Chart column ─────────────────────────────── */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-ink-muted font-mono text-xs tracking-widest uppercase">
            {market.pair.replace('/', ' / ')}
          </span>
          <MarketStateBadge market={market} />
        </div>

        <h1 className="font-display text-ink-strong text-display-lg my-1.5 mb-2.5 leading-none font-medium tracking-tighter [font-variation-settings:'ROND'_100]">
          {formatUSD(priceDisplay)}
        </h1>

        <div className="text-ink-muted text-caption flex items-baseline gap-3 font-mono">
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

        <ChartFrame glow className="mt-8">
          <LevXChart
            height={520}
            history={chartHistory}
            predictions={allPaths}
            nowTime={latestTick ? latestTick.time : now}
            marketStart={chartMarketStart}
            marketEnd={chartMarketEnd}
            selectedPathId={hoveredPathId ?? activePathId}
            selectedPathIds={selectedPathIds}
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
        </ChartFrame>

        <div className="mt-4">
          <TimeRangePicker value={candleInterval} onChange={setCandleInterval} />
        </div>
      </section>

      {/* ── Right rail (Active markets only) ───────────────────── */}
      {showWagerRail && (
      <aside className="mt-[180px] flex flex-col">
        <Label>Select Paths</Label>

        <div className="border-line mt-5 border-0 border-t">
          {allPaths.map((p, idx) => (
            <PathRow
              key={p.id}
              index={idx + 1}
              name={p.label}
              multiplier={`${p.multiplier.toFixed(2)}×`}
              wagered={p.totalWagered}
              active={selectedPathIds.has(p.id)}
              onMouseEnter={() => setHoveredPathId(p.id)}
              onMouseLeave={() => setHoveredPathId(null)}
              onClick={() => setSelectedPathIds((prev) => {
                const next = new Set(prev)
                if (next.has(p.id)) next.delete(p.id)
                else next.add(p.id)
                return next
              })}
            />
          ))}
        </div>

        {/*
          ── Draw button — desktop only (mobile gate: pure Tailwind CSS) ──
          This project uses DESKTOP-FIRST custom variants in src/style/customVariants.css:
          `md:` = `@media (max-width: 1024px)`. So base classes apply on desktop
          and `md:` variants override on viewports ≤1024px.
        */}
        <div data-testid="draw-button-wrapper" className="block md:hidden">
          {isInDrawMode ? (
            <div className="mt-5 flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => exitDrawMode()}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleConfirmDrawing}
              >
                Confirm
              </Button>
            </div>
          ) : (
            <Button
              variant="dashed"
              fullWidth
              className="mt-5"
              disabled={chartTotalCheckpoints <= 0}
              onClick={() => enterDrawMode(chartTotalCheckpoints)}
            >
              + Draw Custom Path
            </Button>
          )}
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
              <div className="mb-3.5 flex items-baseline justify-between">
                <Label>Leverage</Label>
                <span className="text-ink-strong text-body-sm font-mono font-bold">
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

        <ConnectGate>
          <Button
            variant="primary"
            fullWidth
            className="mt-2"
            disabled={market.state !== 'active' || !selectedPath || placeWager.isPending}
            onClick={() => {
              if (!selectedPath) return
              placeWager.mutate({
                marketId: market.marketId,
                pathIndex: selectedPath.pathIndex,
                amount: parseFloat(collateral) || 0,
              })
            }}
          >
            {placeWager.isPending ? 'Confirming…' : `Open ${isLong ? 'Long' : 'Short'} Position`}
          </Button>
        </ConnectGate>
        {placeWager.isError && (
          <p className="text-accent font-mono text-caption mt-2">
            {(placeWager.error as Error).message}
          </p>
        )}
      </aside>
      )}

      {/* ── Right rail (Maturing) — countdown card in wager-slot position ── */}
      {showMaturityCard && (
        <aside className="flex flex-col gap-6">
          <MaturityCountdownCard market={market} />
          {userPosition && (
            <UserPositionCard position={userPosition} marketState={market.state} />
          )}
        </aside>
      )}

      {/* ── Right rail (Settled) — claim button (ConnectGate-wrapped) ── */}
      {showClaimCard && (
        <aside className="flex flex-col gap-6">
          <ClaimButton market={market} pathIndex={userPosition ? parseInt(userPosition.pathId.replace('path-', ''), 10) : undefined} />
          {userPosition && (
            <UserPositionCard position={userPosition} marketState={market.state} />
          )}
        </aside>
      )}

      {/* ── Right rail (non-Active markets with a user position) ── */}
      {showPositionRail && !showMaturityCard && !showClaimCard && userPosition && (
        <aside className="flex flex-col">
          <UserPositionCard position={userPosition} marketState={market.state} />
        </aside>
      )}

      {/* ── Market details (collapsible) — spans full width below chart/rail ── */}
      <div className="[@media(min-width:1181px)]:col-span-full">
        <MarketMetaPanel market={market} />
      </div>
    </main>
  )
}
