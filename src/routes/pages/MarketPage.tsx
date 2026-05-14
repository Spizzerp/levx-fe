import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'

import { Button } from '@/ui/Button'
import { ChartFrame } from '@/features/chart/ChartFrame'
import { ConnectGate } from '@/features/wallet/ConnectGate'
import { RequestUsdcButton } from '@/features/wallet/RequestUsdcButton'
import { UsdcBalance } from '@/features/wallet/UsdcBalance'
import { DrawingLayer } from '@/features/chart/DrawingLayer'
import { MarketComments } from '@/features/market/MarketComments'
import { Input } from '@/ui/Input'
import { Label } from '@/ui/Label'
import { LevXChart } from '@/features/chart/LevXChart'
import { MarketMetaPanel } from '@/features/market/MarketMetaPanel'
import { MarketStateBadge } from '@/features/market/MarketStateBadge'
import { MarketTimeProgress } from '@/features/market/MarketTimeProgress'
import { MaturityCountdownCard } from '@/features/market/MaturityCountdownCard'
import { PendingPathsBanner } from '@/features/market/PendingPathsBanner'
import { VoidMarketPanel } from '@/features/market/VoidMarketPanel'
import { QueryErrorState } from '@/ui/QueryErrorState'
import { TimeRangePicker, type CandleInterval } from '@/features/chart/TimeRangePicker'
import { PathRow } from '@/features/market/PathRow'
import { SegmentedSlider } from '@/ui/SegmentedSlider'
import { SlippageSelector } from '@/ui/SlippageSelector'
import { Stub } from '@/ui/Stub'
import { UserPositionCard } from '@/features/market/UserPositionCard'
import { cn } from '@/lib/cn'
import { useMarket, useUserPosition } from '@/lib/chain'
import { parseMarketState } from '@/lib/api/adapters'
import { isMarketWageringOpen } from '@/lib/market/status'
import { useProgram } from '@/lib/solana/program'
import { deriveMarketPda } from '@/lib/solana/pda'
import {
  PathRelayError,
  useAddPath,
  useCancelPathUpload,
  usePlaceBatchWager,
  useClaim,
} from '@/lib/solana/transactions'
import { useUsdcBalance } from '@/lib/api/useUsdcBalance'
import { toast } from '@/stores/toastStore'
import { usePythFeed, useLatestPrice } from '@/lib/pyth/hooks'
import { feedIdForPair } from '@/lib/pyth/feedIds'
import { useBenchmarksHistory, useLazyHistoryTrigger } from '@/lib/pyth/useBenchmarksHistory'
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'

import { useDrawingStore } from '@/stores/drawingStore'
import { useWalletStore } from '@/stores/walletStore'
import {
  formatCountdown,
  formatDeltaBps,
  formatMarketDurationLabel,
  formatPrice,
  formatUSD,
  maxLeverageByDuration,
} from '@/lib/format'
import type { Market, PredictionPath, PricePoint } from '@/types/market'

const META_SEP = <span className="text-line-strong mx-0.5">·</span>

function isLiveUserDrawingState(state: Market['state'] | undefined): boolean {
  return state === 'active' || state === 'sampling'
}

function closestHistoryValue(
  history: readonly PricePoint[],
  targetTime: number,
  fallbackValue: number,
): number | null {
  let closestValue = Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : null
  let closestDistance = Number.POSITIVE_INFINITY

  for (const point of history) {
    if (!Number.isFinite(point.value) || point.value <= 0) continue
    const distance = Math.abs(point.time - targetTime)
    if (distance < closestDistance) {
      closestDistance = distance
      closestValue = point.value
    }
  }

  return closestValue
}

function buildDrawingInitialValues({
  totalCheckpoints,
  completedCheckpoints,
  marketStart,
  checkpointIntervalMs,
  history,
  fallbackValue,
  live,
}: {
  totalCheckpoints: number
  completedCheckpoints: number
  marketStart: number
  checkpointIntervalMs: number
  history: readonly PricePoint[]
  fallbackValue: number
  live: boolean
}): (number | null)[] {
  const values = new Array(totalCheckpoints).fill(null) as (number | null)[]
  if (!live) return values

  const elapsed = Math.min(completedCheckpoints, totalCheckpoints)
  for (let i = 0; i < elapsed; i++) {
    values[i] = closestHistoryValue(history, marketStart + i * checkpointIntervalMs, fallbackValue)
  }

  return values
}

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
      <p className="text-ink-strong text-label font-mono tracking-wide uppercase">
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
        <p className="text-accent text-caption mt-1 font-mono">{(claim.error as Error).message}</p>
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

  const {
    data: benchmarksHistory,
    isLoading: isBenchmarksLoading,
    fetchOlder,
    hasMoreHistory,
    isFetchingOlder,
  } = useBenchmarksHistory({
    pair,
    interval: candleInterval,
  })

  const onChartViewportChange = useLazyHistoryTrigger({
    history: benchmarksHistory,
    hasMoreHistory,
    isFetchingOlder,
    fetchOlder,
  })

  const program = useProgram()
  const addPath = useAddPath()
  const cancelPathUpload = useCancelPathUpload()
  const placeBatchWager = usePlaceBatchWager()
  const { data: usdcBalance } = useUsdcBalance()
  const selfWallet = useWalletStore((s) => s.publicKey?.toBase58() ?? null)

  const drawingState = useDrawingStore((s) => s.state)
  const drawingPhase = drawingState.phase
  const enterDrawMode = useDrawingStore((s) => s.enterDrawMode)
  const exitDrawMode = useDrawingStore((s) => s.exitDrawMode)
  const confirmDrawing = useDrawingStore((s) => s.confirm)
  const onTxSuccess = useDrawingStore((s) => s.onTxSuccess)
  const onTxError = useDrawingStore((s) => s.onTxError)

  const [selectedPathIds, setSelectedPathIds] = useState<Set<string>>(new Set())
  const [userPaths, setUserPaths] = useState<PredictionPath[]>([])
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null)
  const [pathUploadStatus, setPathUploadStatus] = useState<'authorizing' | 'uploading' | null>(
    null,
  )
  const [leverage, setLeverage] = useState(22)
  const [collateral, setCollateral] = useState('25.00')
  const [now, setNow] = useState(() => Date.now())
  const [showOtherPositions] = useState(false)

  // Update `now` every second so countdowns tick in real time.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Exit draw mode on unmount so a user navigating away doesn't leave the store in sweeping state.
  useEffect(() => () => exitDrawMode(), [exitDrawMode])

  // Chart schedule from on-chain market params.
  //
  // We treat the LAST CHECKPOINT as "market end" everywhere user-facing
  // (chart bar, countdown, leverage-cap duration). The on-chain
  // `market.endTime` is a free input to `create_market` and is then only
  // used to derive `total_checkpoints = floor((end - start) / interval)`;
  // no on-chain control flow keys off it. Settling triggers when
  // `completed_checkpoints == total_checkpoints` (last sample), at which
  // point `maturity_end_time` is freshly stamped from the on-chain clock.
  // So the last checkpoint is the real "end" for every event a user
  // cares about; surfacing `endTime` would just produce a "ENDS IN 1h"
  // countdown that ticks after settling has already started.
  const chartMarketStart = market?.startTime ?? now
  const chartCheckpointInterval = market?.checkpointInterval ?? 3600
  const chartTotalCheckpoints = market?.totalCheckpoints ?? 0
  const chartCheckpointIntervalMs = chartCheckpointInterval * 1000
  const chartMarketEnd = market
    ? market.startTime +
      Math.max(0, market.totalCheckpoints - 1) * chartCheckpointIntervalMs
    : now

  const durationMs = Math.max(0, chartMarketEnd - chartMarketStart)
  const msRemaining = Math.max(0, chartMarketEnd - now)
  const leverageCap = maxLeverageByDuration(durationMs)

  // Prefer real Benchmarks candles; fall back to mock history while loading
  const chartHistory = useMemo(
    () =>
      benchmarksHistory && benchmarksHistory.length > 0
        ? benchmarksHistory
        : (market?.history ?? []),
    [benchmarksHistory, market?.history],
  )

  // Live price from Pyth tick; fall back to last history point
  const priceDisplay = latestTick?.value ?? chartHistory[chartHistory.length - 1]?.value ?? 0

  const drawingInitialValues = useMemo(
    () =>
      buildDrawingInitialValues({
        totalCheckpoints: chartTotalCheckpoints,
        completedCheckpoints: market?.completedCheckpoints ?? 0,
        marketStart: chartMarketStart,
        checkpointIntervalMs: chartCheckpointIntervalMs,
        history: chartHistory,
        fallbackValue: priceDisplay,
        live: isLiveUserDrawingState(market?.state),
      }),
    [
      chartTotalCheckpoints,
      market?.completedCheckpoints,
      market?.state,
      chartMarketStart,
      chartCheckpointIntervalMs,
      chartHistory,
      priceDisplay,
    ],
  )

  const drawingStartCheckpoint =
    market && isLiveUserDrawingState(market.state) && chartTotalCheckpoints > 0
      ? Math.min(market.completedCheckpoints, chartTotalCheckpoints - 1)
      : 0
  const drawingStartTime = chartMarketStart + drawingStartCheckpoint * chartCheckpointIntervalMs

  // Use on-chain paths when available. Fall back to fixture paths only
  // in mock mode (APP_USE_MOCK=true) — in real-chain mode an empty
  // market.paths array is meaningful (Pending market awaiting pipeline,
  // or a market with all paths dissolved). Fixture-painting those would
  // mislead the user into thinking AI submissions exist when they
  // don't; PendingPathsBanner / VoidMarketPanel handle the real states.
  const useMockPaths = import.meta.env.APP_USE_MOCK === 'true'
  const aiPaths = useMemo(() => {
    const marketPaths = market?.paths ?? []
    if (marketPaths.length > 0) return marketPaths
    if (!useMockPaths) return []

    // Fixture path generation — mock mode only.
    if (chartTotalCheckpoints <= 0 || priceDisplay <= 0) return []
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
  }, [
    useMockPaths,
    market?.paths,
    chartHistory,
    chartMarketStart,
    chartCheckpointInterval,
    chartTotalCheckpoints,
    priceDisplay,
  ])

  // Hide optimistic user-drawn entries once the on-chain refetch lands the
  // matching `PathOutcome`. Without this, the path renders twice on the
  // chart and twice in the path list (once as "Your Path", once with the
  // adapter's default label) until the user navigates away.
  // Match by the optimistic row's own (creator, pathIndex) — not by the
  // currently-connected wallet — so a wallet flip between submission and
  // refetch can't dedupe against an unrelated path. Falls back to
  // selfWallet only for legacy rows whose creator was never populated.
  // Only fires once `onChainStatus === 'confirmed'`, guarding against a
  // stale market refetch interleaving with an in-flight tx and dropping a
  // still-pending row by accident.
  // Derived (not stateful) so React doesn't see this as a separate write.
  const visibleUserPaths = useMemo(() => {
    if (!market || !selfWallet) return userPaths
    return userPaths.filter((opt) => {
      if (opt.onChainStatus === 'pending') return true
      const optCreator = opt.creator || selfWallet
      return !market.paths.some(
        (p) =>
          p.origin === 'user' &&
          p.creator === optCreator &&
          p.pathIndex === opt.pathIndex,
      )
    })
  }, [userPaths, market, selfWallet])

  // Combine AI paths + user-drawn paths for chart
  const allPaths = useMemo(
    () => [...aiPaths, ...visibleUserPaths],
    [aiPaths, visibleUserPaths],
  )

  const handleConfirmDrawing = async () => {
    if (drawingState.phase !== 'ready' || !market) return
    if (!program) {
      toast.error('Wallet required', { message: 'Connect a wallet to create your path.' })
      return
    }
    const values = drawingState.values
    confirmDrawing()

    // Pre-fetch pathIndex so the pending row has a real index, AND defend
    // against a stale FE state cache by re-checking the 80% completion
    // cutoff right before we sign. `add_path` reverts above the cutoff;
    // without this, the user could spend gas on a tx that's guaranteed
    // to fail after a state flip between FE polling cycles.
    const [marketPda] = deriveMarketPda(market.marketId)
    let pathIndex: number
    try {
      const marketAcc = await program.account.market.fetch(marketPda)
      const wageringOpen = isMarketWageringOpen({
        state: parseMarketState(marketAcc.state as Record<string, unknown>),
        completedCheckpoints: marketAcc.completedCheckpoints as number,
        totalCheckpoints: marketAcc.totalCheckpoints as number,
      })
      if (!wageringOpen) {
        exitDrawMode()
        toast.error('Path submission closed', {
          message: 'Market is more than 80% complete; new paths are no longer accepted.',
        })
        return
      }
      pathIndex = marketAcc.numPaths
    } catch (err) {
      onTxError((err as Error).message)
      return
    }

    const tempId = `user-${Date.now()}`
    const intervalMs = chartCheckpointInterval * 1000
    const data: PricePoint[] = values.map((v, i) => ({
      time: chartMarketStart + i * intervalMs,
      value: v,
    }))
    const pendingPath: PredictionPath = {
      id: tempId,
      label: 'Your Path',
      tone: 'custom',
      origin: 'user',
      multiplier: 0,
      data,
      pathIndex,
      predictedPrices: values,
      numCheckpoints: values.length,
      generationTimestamp: Date.now(),
      creator: selfWallet ?? '',
      cumulativeAction: 0,
      compositeScore: 0,
      peakAmplitude: 0,
      amplitudeAtDecoherence: 0,
      dissolved: false,
      dissolvedAtCheckpoint: 0,
      checkpointsProcessed: isLiveUserDrawingState(market.state) ? market.completedCheckpoints : 0,
      createdAtCheckpoint: isLiveUserDrawingState(market.state) ? market.completedCheckpoints : 0,
      firstActiveCheckpoint: isLiveUserDrawingState(market.state) ? market.completedCheckpoints : 0,
      totalWagered: 0,
      totalLeveragedExposure: 0,
      lmsrSharesOutstanding: 0,
      totalTimeWeightedExposure: 0,
      currentImpliedProbability: 0,
      initialAmplitude: 0,
      onChainStatus: 'pending',
    }
    setUserPaths((prev) => [...prev, pendingPath])
    setSelectedPathIds((prev) => new Set([...prev, tempId]))

    try {
      const { sig, pathIndex: confirmedIndex } = await addPath.mutateAsync({
        marketId: market.marketId,
        predictedPrices: values,
        numCheckpoints: values.length,
        onStatus: setPathUploadStatus,
        pathIndex,
      })
      setUserPaths((prev) =>
        prev.map((p) =>
          p.id === tempId
            ? {
                ...p,
                onChainStatus: 'confirmed' as const,
                pathIndex: confirmedIndex,
                firstActiveCheckpoint: isLiveUserDrawingState(market.state)
                  ? Math.min(market.completedCheckpoints + 1, market.totalCheckpoints)
                  : 0,
              }
            : p,
        ),
      )
      onTxSuccess(sig)
    } catch (err) {
      if (err instanceof PathRelayError) {
        setUserPaths((prev) =>
          prev.map((p) =>
            p.id === tempId
              ? {
                  ...p,
                  label: 'Pending Upload',
                  onChainStatus: 'relay_failed' as const,
                  uploadIntentPda: err.intentPda,
                  uploadNonce: err.nonce,
                  uploadExpiresAt: err.expiresAt,
                }
              : p,
          ),
        )
        toast.error('Path upload pending', {
          message:
            'Your signed intent is on-chain. If the relayer does not finish, cancel it after expiry.',
        })
      } else {
        setUserPaths((prev) => prev.filter((p) => p.id !== tempId))
        setSelectedPathIds((prev) => {
          const next = new Set(prev)
          next.delete(tempId)
          return next
        })
        onTxError((err as Error).message)
      }
    } finally {
      setPathUploadStatus(null)
    }
  }

  // All selected paths and the subset eligible for wagering
  const selectedPaths = allPaths.filter((p) => selectedPathIds.has(p.id))
  const wagerablePaths = selectedPaths.filter(
    (p) =>
      (p.onChainStatus === undefined || p.onChainStatus === 'confirmed') &&
      (market?.completedCheckpoints ?? 0) >= p.firstActiveCheckpoint,
  )
  const numWagerable = wagerablePaths.length

  // Chart highlight: last-added path in the set (most recent click)
  const activePathId = selectedPathIds.size > 0 ? [...selectedPathIds].at(-1)! : null

  const isPathLong = (p?: PredictionPath) => {
    if (!p) return true
    const last = p.data.at(-1)
    const first = p.data[0]
    return last && first ? last.value >= first.value : true
  }

  // Delta is only available from the mock layer (not from live Pyth ticks in Phase 1)
  const deltaDisplay = 0
  const deltaColor = deltaDisplay >= 0 ? 'text-success' : 'text-accent'

  const isInDrawMode = drawingPhase !== 'idle'
  const confirmPathLabel =
    pathUploadStatus === 'uploading'
      ? 'Uploading…'
      : addPath.isPending
        ? 'Authorizing…'
        : 'Confirm'

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
   *   pending / active / sampling → WagerPanel (renders inline below)
   *     pending shows a "AI is generating paths…" indicator at top
   *     and disables Place-Wager until numPaths reaches targetNumPaths.
   *   maturing         → MaturityCountdownCard
   *   settled          → ClaimButton (ConnectGate-wrapped)
   *   settling / void  → empty rail
   *   Non-wager states with a user position also show the position card.
   */
  const wageringOpen = isMarketWageringOpen(market)
  const showWagerRail = market.state === 'pending' || wageringOpen
  const showMaturityCard = market.state === 'maturing'
  const showClaimCard = market.state === 'settled'
  const showVoidPanel = market.state === 'void'
  const pendingPathTarget = market.targetNumPaths
  const showPendingIndicator =
    market.state === 'pending' && market.numPaths < pendingPathTarget
  const showPositionRail = !showWagerRail && !showVoidPanel && !!userPosition
  const showRail =
    showWagerRail || showMaturityCard || showClaimCard || showVoidPanel || showPositionRail
  const relayFailedPaths = visibleUserPaths.filter((p) => p.onChainStatus === 'relay_failed')

  return (
    <main
      className={cn(
        'mx-auto grid max-w-[1680px] grid-cols-1 items-start gap-14 px-10 pt-6 pb-12',
        showRail &&
          '[@media(min-width:1181px)]:grid-cols-[minmax(0,1fr)_400px] [@media(min-width:1181px)]:gap-[72px]',
      )}
    >
      {/* ── Chart column ─────────────────────────────── */}
      <section className="min-w-0">
        <Link
          to="/markets"
          className="group text-ink-dim hover:text-ink-strong mb-5 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft
            size={14}
            strokeWidth={2}
            className="duration-short ease-levx transition-transform group-hover:-translate-x-0.5"
          />
          <span className="text-micro font-mono tracking-wider uppercase">Markets</span>
        </Link>

        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-ink-muted font-mono text-xs tracking-widest uppercase">
            {market.pair.replace('/', ' / ')}
          </span>
          <MarketStateBadge market={market} />
        </div>

        <div className="my-1.5 mb-2.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <h1 className="font-display text-ink-strong text-display-lg leading-none font-medium tracking-tighter [font-variation-settings:'ROND'_100]">
            {formatPrice(priceDisplay)}
          </h1>
          <div className="text-ink-muted text-caption flex items-baseline gap-3 font-mono">
            <span className={cn('font-bold', deltaColor)}>{formatDeltaBps(deltaDisplay)}</span>
            <span>24H</span>
          </div>
        </div>

        <div className="text-ink-dim text-caption mt-8 flex flex-nowrap items-center gap-2 overflow-hidden font-mono tracking-normal whitespace-nowrap uppercase">
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
            onViewportChange={onChartViewportChange}
            market={{
              startTime: chartMarketStart,
              checkpointInterval: chartCheckpointInterval,
              totalCheckpoints: chartTotalCheckpoints,
            }}
            renderDrawingOverlay={({
              xScale,
              yScale,
              innerWidth,
              innerHeight,
              checkpointXs,
              marketStart,
              margin,
            }) => (
              <DrawingLayer
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                xScale={xScale as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                yScale={yScale as any}
                innerWidth={innerWidth}
                innerHeight={innerHeight}
                margin={margin}
                checkpointXs={checkpointXs}
                marketStart={Math.max(marketStart, drawingStartTime)}
                marketId={market.id}
              />
            )}
          />
        </ChartFrame>

        <div className="mt-4">
          <TimeRangePicker value={candleInterval} onChange={setCandleInterval} />
        </div>

        <div className="mt-8">
          <MarketComments marketId={market.id} />
        </div>
      </section>

      {/* ── Right rail (Pending / Active / Sampling) ─────────────── */}
      {showWagerRail && (
        <aside className="mt-7 flex flex-col">
          <MarketTimeProgress
            startTime={chartMarketStart}
            endTime={chartMarketEnd}
            now={now}
            className="mb-6 ml-auto"
          />

          <Label>Select Paths</Label>

          {(() => {
            // During pending state we want to:
            //   - Hide mock AI fixtures (`APP_USE_MOCK=true` paints
            //     fake "CHRONOS-2 PATH" rows that confuse users while
            //     real AI paths are still in flight).
            //   - Always show real content the user produced (a path
            //     they drew this session) or the chain reflects (a
            //     partial on-chain AI submission below targetNumPaths).
            //   - Replace the rows with the heart-pulse loader only
            //     when there is genuinely nothing real to display.
            // Outside pending, `allPaths` is authoritative.
            const hasOnChainPaths = (market.paths?.length ?? 0) > 0
            const visiblePaths = showPendingIndicator && !hasOnChainPaths ? userPaths : allPaths
            const showLoaderInSlot = showPendingIndicator && visiblePaths.length === 0

            if (showLoaderInSlot) {
              return (
                <div className="border-line mt-5 flex items-center justify-center border-t py-12">
                  <PendingPathsBanner market={market} />
                </div>
              )
            }

            return (
              <div className="border-line mt-5 border-0 border-t">
                {visiblePaths.map((p, idx) => (
                  <PathRow
                    key={p.id}
                    index={idx + 1}
                    name={p.label}
                    multiplier={`${p.multiplier.toFixed(2)}×`}
                    wagered={p.totalWagered}
                    compositeScore={p.compositeScore}
                    active={selectedPathIds.has(p.id)}
                    pending={
                      p.origin === 'user' &&
                      (p.onChainStatus === 'pending' || p.onChainStatus === 'relay_failed')
                    }
                    onMouseEnter={() => setHoveredPathId(p.id)}
                    onMouseLeave={() => setHoveredPathId(null)}
                    onClick={() =>
                      setSelectedPathIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(p.id)) next.delete(p.id)
                        else next.add(p.id)
                        return next
                      })
                    }
                  />
                ))}
                {relayFailedPaths.map((p) => {
                  const remainingMs = Math.max(0, (p.uploadExpiresAt ?? 0) * 1000 - now)
                  const canCancel = remainingMs === 0 && !!p.uploadIntentPda
                  return (
                    <div
                      key={`${p.id}-relay`}
                      className={cn(
                        'border-line flex items-center justify-between gap-3',
                        'border-0 border-b px-4 py-3',
                      )}
                    >
                      <span className="text-ink-dim min-w-0 font-mono text-xs tracking-wide uppercase">
                        {canCancel
                          ? 'Relay stalled. Cleanup and cancel are available.'
                          : `Relay pending. Cleanup unlocks in ${formatCountdown(remainingMs)}`}
                      </span>
                      <Button
                        variant="secondary"
                        className="min-h-8 shrink-0 px-3 py-2 text-[10px]"
                        disabled={!canCancel || cancelPathUpload.isPending}
                        onClick={async () => {
                          if (!p.uploadIntentPda || !market) return
                          await cancelPathUpload.mutateAsync({
                            marketId: market.marketId,
                            intentPda: p.uploadIntentPda,
                          })
                          setUserPaths((prev) => prev.filter((path) => path.id !== p.id))
                          setSelectedPathIds((prev) => {
                            const next = new Set(prev)
                            next.delete(p.id)
                            return next
                          })
                        }}
                      >
                        {canCancel ? 'Cleanup + Cancel' : 'Cancel'}
                      </Button>
                    </div>
                  )
                })}
                {selectedPathIds.size > 4 && (
                  <p className="text-accent text-caption px-4 py-2 font-mono">
                    Max 4 paths per transaction. Deselect some paths.
                  </p>
                )}
                {/* Inline AI-generating indicator below the existing
                    rows so a user who's drawn a path during pending
                    still sees their work — the loader doesn't
                    swallow it. */}
                {showPendingIndicator && (
                  <div className="border-line border-t px-1 py-3">
                    <PendingPathsBanner market={market} />
                  </div>
                )}
              </div>
            )
          })()}

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
                  disabled={addPath.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleConfirmDrawing}
                  disabled={drawingState.phase !== 'ready' || addPath.isPending}
                >
                  {confirmPathLabel}
                </Button>
              </div>
            ) : (
              <Button
                variant="dashed"
                fullWidth
                className="mt-5 gap-2"
                disabled={chartTotalCheckpoints <= 0}
                onClick={() => enterDrawMode(chartTotalCheckpoints, drawingInitialValues)}
              >
                <Plus size={14} strokeWidth={1.75} aria-hidden />
                Draw Custom Path
              </Button>
            )}
          </div>
          <div
            data-testid="drawing-desktop-notice"
            className="mt-5 hidden font-mono text-sm text-[color:var(--color-ink-dim,#666)] md:block"
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
                <div className="text-ink-dim text-caption mt-2.5 flex justify-between font-mono uppercase">
                  <span>1×</span>
                  <span>
                    {leverageCap}× MAX ·{' '}
                    {formatMarketDurationLabel(market.startTime, chartMarketEnd)}
                  </span>
                </div>
              </div>
            </>
          )}

          {!market.leverageEnabled && <hr className="bg-line my-9 mb-8 h-px border-0" />}

          <div className="mb-6 flex items-center justify-between gap-3">
            <UsdcBalance />
            <RequestUsdcButton />
          </div>

          <Input
            label="Collateral"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            unit="USDC"
            inputMode="decimal"
            borderless
            className="mb-8"
          />
          {numWagerable > 1 && (
            <p className="text-ink-muted text-caption -mt-6 mb-6 font-mono">
              Total: {formatUSD((parseFloat(collateral) || 0) * numWagerable)} USDC across{' '}
              {numWagerable} paths
            </p>
          )}

          <SlippageSelector className="mb-6" />

          <ConnectGate>
            <Button
              variant="primary"
              fullWidth
              className="mt-2"
              disabled={
                !wageringOpen || numWagerable === 0 || numWagerable > 4 || placeBatchWager.isPending
              }
              onClick={() => {
                if (numWagerable === 0) return
                const wager = parseFloat(collateral) || 0
                const total = wager * numWagerable
                // Pre-tx guard only fires when the balance is actually
                // known. If the query is still loading or hit a
                // transient RPC error, fall through and let the on-chain
                // validation surface insufficient-funds — better than
                // blocking a valid wager because we couldn't read the
                // ATA.
                if (usdcBalance && total > usdcBalance.balance) {
                  toast.error('Insufficient USDC', {
                    message: `Wager total ${total.toFixed(2)} USDC exceeds your balance of ${usdcBalance.balance.toFixed(2)}. Use "Request test USDC" above.`,
                  })
                  return
                }
                placeBatchWager.mutate({
                  marketId: market.marketId,
                  pathIndices: wagerablePaths.map((p) => p.pathIndex),
                  amount: wager,
                })
              }}
            >
              {placeBatchWager.isPending
                ? 'Confirming…'
                : numWagerable <= 1
                  ? `Open ${isPathLong(wagerablePaths[0]) ? 'Long' : 'Short'} Position`
                  : `Open ${numWagerable} Positions`}
            </Button>
          </ConnectGate>
          {placeBatchWager.isError && (
            <p className="text-accent text-caption mt-2 font-mono">
              {(placeBatchWager.error as Error).message}
            </p>
          )}
        </aside>
      )}

      {/* ── Right rail (Maturing) — countdown card in wager-slot position ── */}
      {showMaturityCard && (
        <aside className="flex flex-col gap-6">
          <MaturityCountdownCard market={market} />
          {userPosition && <UserPositionCard position={userPosition} marketState={market.state} />}
        </aside>
      )}

      {/* ── Right rail (Settled) — claim button (ConnectGate-wrapped) ── */}
      {showClaimCard && (
        <aside className="flex flex-col gap-6">
          <ClaimButton
            market={market}
            pathIndex={
              userPosition ? parseInt(userPosition.pathId.replace('path-', ''), 10) : undefined
            }
          />
          {/* hideAction: ClaimButton above already drives the claim flow;
              the card's in-built "Claim Payout" button is dead (no onClick). */}
          {userPosition && (
            <UserPositionCard position={userPosition} marketState={market.state} hideAction />
          )}
        </aside>
      )}

      {/* ── Right rail (Void) — refund / reclaim panel ── */}
      {showVoidPanel && (
        <aside className="flex flex-col gap-6">
          <VoidMarketPanel market={market} />
          {/* hideAction: VoidMarketPanel drives the reclaim flow; the
              card's in-built "Claim Refund" button is dead (no onClick). */}
          {userPosition && (
            <UserPositionCard position={userPosition} marketState={market.state} hideAction />
          )}
        </aside>
      )}

      {/* ── Right rail (non-Active markets with a user position) ── */}
      {showPositionRail && userPosition && (
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
