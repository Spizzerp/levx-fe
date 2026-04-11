import { useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/Button'
import { DrawingLayer } from '@/components/DrawingLayer'
import { Input } from '@/components/Input'
import { Label } from '@/components/Label'
import { LevXChart } from '@/components/LevXChart'
import { PathRow } from '@/components/PathRow'
import { SegmentedSlider } from '@/components/SegmentedSlider'
import { StatusDot } from '@/components/StatusDot'
import { Stub } from '@/components/Stub'
import { cn } from '@/lib/cn'
import { useMarket } from '@/lib/api/hooks'
import { getNow } from '@/lib/api/mock'
import { usePythFeed, useLatestPrice } from '@/lib/pyth/hooks'
import { feedIdForPair } from '@/lib/pyth/feedIds'
import { useDrawingStore } from '@/stores/drawingStore'
import {
  formatCountdown,
  formatDeltaBps,
  formatMarketDurationLabel,
  formatUSD,
  maxLeverageByDuration,
} from '@/lib/format'
import type { MarketState } from '@/types/market'

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

  const pair = market?.pair ?? null
  const feedId = pair ? feedIdForPair(pair) : null
  usePythFeed(feedId)
  const latestTick = useLatestPrice(feedId)

  const drawingPhase = useDrawingStore((s) => s.state.phase)
  const enterDrawMode = useDrawingStore((s) => s.enterDrawMode)
  const exitDrawMode = useDrawingStore((s) => s.exitDrawMode)

  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [leverage, setLeverage] = useState(22)
  const [collateral, setCollateral] = useState('25.00')

  const now = getNow()

  // Exit draw mode on unmount so a user navigating away doesn't leave the store in sweeping state.
  useEffect(() => () => exitDrawMode(), [exitDrawMode])

  if (isLoading) return <Stub title="Loading Market…" />
  if (error || !market) return <Stub title="Market Not Found" subtitle={id} />

  // Default selection = the middle (neutral) path on first load
  const activePathId = selectedPathId ?? market.paths[2]?.id ?? null
  const selectedPath = market.paths.find((p) => p.id === activePathId)
  const lastPoint = selectedPath?.data[selectedPath.data.length - 1]
  const firstPoint = selectedPath?.data[0]
  const isLong = lastPoint && firstPoint ? lastPoint.value >= firstPoint.value : true
  const msRemaining = Math.max(0, market.endTime - now)
  const durationMs = market.endTime - market.startTime
  const leverageCap = maxLeverageByDuration(durationMs)

  // Live price from Pyth tick; fall back to last history point
  const priceDisplay = latestTick?.value ?? market.history[market.history.length - 1]?.value ?? 0
  // Delta is only available from the mock layer (not from live Pyth ticks in Phase 1)
  const deltaDisplay = 0
  const deltaColor = deltaDisplay >= 0 ? 'text-success' : 'text-accent'

  const isInDrawMode = drawingPhase !== 'idle'

  return (
    <main className="mx-auto grid max-w-[1680px] grid-cols-1 gap-14 px-10 pt-14 pb-12 [@media(min-width:1181px)]:grid-cols-[1fr_400px] [@media(min-width:1181px)]:gap-[72px]">
      {/* ── Chart column ─────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center gap-4">
          <span className="text-ink-muted font-mono text-xs tracking-[0.14em] uppercase">
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

        <div className="text-ink-dim mt-8 flex flex-nowrap items-center gap-2 overflow-hidden font-mono text-[10px] tracking-[0.08em] whitespace-nowrap uppercase">
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
            {market.completedCheckpoints} / {market.totalCheckpoints}
          </span>
          {META_SEP}
          <span>TRADERS</span>
          <span className="text-ink-muted ml-1">{market.traders.toLocaleString()}</span>
          {META_SEP}
          <span>ENTRY FEE</span>
          <span className="text-ink-muted ml-1">{(market.entryFeeBps / 100).toFixed(1)}%</span>
        </div>

        <div className="mt-12 h-[420px] [@media(min-width:1181px)]:h-[520px]">
          <LevXChart
            history={market.history}
            predictions={market.paths}
            nowTime={latestTick ? latestTick.time : now}
            marketStart={market.startTime}
            marketEnd={market.endTime}
            selectedPathId={activePathId}
            pair={market.pair}
            isLoading={false}
            error={null}
            market={market}
            renderDrawingOverlay={({ xScale, yScale, innerWidth, innerHeight, checkpointXs, marketStart }) => (
              <DrawingLayer
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                xScale={xScale as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                yScale={yScale as any}
                innerWidth={innerWidth}
                innerHeight={innerHeight}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                checkpointXs={checkpointXs}
                marketStart={marketStart}
              />
            )}
          />
        </div>
      </section>

      {/* ── Right rail ───────────────────────────────── */}
      <aside className="flex flex-col">
        <Label>Select A Line</Label>

        <div className="border-line mt-5 border-0 border-t">
          {market.paths.map((p, idx) => (
            <PathRow
              key={p.id}
              index={idx + 1}
              name={p.label}
              multiplier={`${p.multiplier.toFixed(2)}×`}
              active={activePathId === p.id}
              onClick={() => setSelectedPathId(p.id)}
            />
          ))}
        </div>

        {/* ── Draw button — desktop only (mobile gate: pure Tailwind CSS) ── */}
        <div className="hidden md:block">
          <Button
            variant={isInDrawMode ? 'primary' : 'dashed'}
            fullWidth
            className="mt-5"
            onClick={() => {
              if (drawingPhase === 'idle') {
                enterDrawMode(market.totalCheckpoints)
              } else {
                exitDrawMode()
              }
            }}
          >
            {isInDrawMode ? 'Cancel Drawing' : '+ Draw Custom Path'}
          </Button>
        </div>
        <div className="mt-5 block md:hidden font-mono text-sm text-[color:var(--color-ink-dim,#666)]">
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
              <div className="text-ink-dim mt-2.5 flex justify-between font-mono text-[10px] tracking-[0.1em] uppercase">
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
          disabled={market.state !== 'active' && market.state !== 'sampling'}
        >
          Open {isLong ? 'Long' : 'Short'} Position
        </Button>
      </aside>
    </main>
  )
}
