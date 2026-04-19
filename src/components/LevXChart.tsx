import { AxisBottom, AxisRight } from '@visx/axis'
import { curveCatmullRom, curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleLinear, scaleTime } from '@visx/scale'
import { Bar, Circle, Line, LinePath } from '@visx/shape'
import { bisector } from 'd3-array'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { PathTone, PredictionPath, PricePoint } from '@/types/market'
import type { Market } from '@/types/market'
import { useDrawingStore } from '@/stores/drawingStore'
import { useLatestPrice } from '@/lib/pyth/hooks'
import { feedIdForPair } from '@/lib/pyth/feedIds'
import { buildCheckpointXs } from '@/lib/drawing/geometry'
import { useYAxisFreeze } from '@/lib/drawing/yFreeze'
import { useChartViewport } from '@/lib/chart/useChartViewport'
import { useYAxisViewport } from '@/lib/chart/useYAxisViewport'
import { computeVisiblePriceDomain } from '@/lib/chart/computeVisiblePriceDomain'
import { DrawingGrid } from '@/components/DrawingGrid'
import { ChartMorphLine } from '@/components/ChartMorphLine'
import { Stub } from '@/components/Stub'

import './LevXChart.css'

/* ── Module-level Catmull-Rom factory — created once, never recreated per render ── */
const CATMULL_ROM_ALPHA_05 = curveCatmullRom.alpha(0.5)

/* ── Visual config — derived from Nothing tokens ────────────────── */

const TONE_STYLES: Record<PathTone, { stroke: string; dash: string; opacity: number }> = {
  'ultra-bull': { stroke: '#5CF78B', dash: '5 4', opacity: 0.95 },
  bull: { stroke: '#5CF78B', dash: '4 4', opacity: 0.45 },
  neutral: { stroke: '#F6CE48', dash: '2 4', opacity: 0.65 },
  bear: { stroke: '#FF483B', dash: '4 4', opacity: 0.45 },
  'ultra-bear': { stroke: '#FF483B', dash: '5 4', opacity: 0.95 },
  custom: { stroke: '#5B9BF6', dash: '3 3', opacity: 0.85 },
}

const MARGIN = { top: 32, right: 80, bottom: 40, left: 16 }

/** Theme-aware colors — resolved from CSS custom properties at render time. */
const C = {
  line: 'var(--chart-line, #FFFFFF)',
  muted: 'var(--chart-muted, #999999)',
  grid: 'var(--chart-grid, #222222)',
  marker: 'var(--chart-marker, #999999)',
}

const bisectTime = bisector<PricePoint, number>((d) => d.time).left

/* ─────────────────────────────────────────────────────────────── */

export interface LevXChartProps {
  history: PricePoint[]
  predictions: PredictionPath[]
  /** unix ms — current real-world time */
  nowTime: number
  /** unix ms — when the market opens for trading */
  marketStart: number
  /** unix ms — when the market ends (final checkpoint) */
  marketEnd: number
  /** which prediction path is currently highlighted (primary) */
  selectedPathId?: string | null
  /** all selected path IDs — rendered as solid lines */
  selectedPathIds?: Set<string>
  /**
   * Whether the selected path represents an interactive user choice.
   * When false (e.g. on non-Active markets where path selection is disabled),
   * the selected line is rendered as a quiet dotted grey preview instead of
   * the confident solid-white overlay, so it doesn't conflict with the price line.
   */
  selectionInteractive?: boolean
  /** when true, show paths that other users have wagered on at low opacity */
  showOtherPositions?: boolean
  /** override fixed height; if omitted, fills parent */
  height?: number
  /** Pair string used for pythStore subscription. If null, no live updates. */
  pair?: string | null
  /** Loading state of the outer data layer. */
  isLoading?: boolean
  /** Error state of the outer data layer. */
  error?: Error | null
  /** The full market is needed to build checkpoint Xs for the draw-mode grid. */
  market?: Pick<Market, 'startTime' | 'checkpointInterval' | 'totalCheckpoints'> | null
  /**
   * Fires whenever the effective time-domain changes (pan/zoom/reset/default recompute).
   * Consumers use this to drive lazy-loaded data: when the left edge approaches the
   * oldest loaded bar, trigger fetchOlder on the data hook.
   * Args are [fromMs, toMs] in unix milliseconds.
   */
  onViewportChange?: (domain: [number, number]) => void
  /**
   * Optional render prop invoked INSIDE the SVG inner group (after DrawingGrid, before crosshair).
   * Receives live scales and checkpoint Xs so the consumer can mount DrawingLayer with
   * the correct coordinate space. Omitting it is backward-compatible (no overlay rendered).
   */
  renderDrawingOverlay?: (args: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    xScale: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    yScale: any
    innerWidth: number
    innerHeight: number
    checkpointXs: readonly number[]
    marketStart: number
    margin: { top: number; right: number; bottom: number; left: number }
  }) => ReactNode
}

interface InnerProps extends LevXChartProps {
  width: number
  height: number
}

function ChartInner({
  width,
  height,
  history,
  predictions,
  nowTime,
  marketStart,
  marketEnd,
  selectedPathId,
  selectedPathIds,
  selectionInteractive = true,
  showOtherPositions,
  pair,
  market,
  isLoading,
  onViewportChange,
  renderDrawingOverlay,
}: InnerProps) {
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const clipId = useId()

  /* ── Morph animation state ─────────────────────────────────── */
  const [chartRevealing, setChartRevealing] = useState(!isLoading)
  useEffect(() => {
    if (isLoading) setChartRevealing(false)
  }, [isLoading])
  const handleRevealChart = useCallback(() => setChartRevealing(true), [])

  /* ── Pyth live tick subscription ────────────────────────── */
  const feedId = pair ? feedIdForPair(pair) : null
  const latestTick = useLatestPrice(feedId)

  /* ── Merge live tick into visible history ────────────────── */
  const mergedHistory = useMemo(() => {
    if (!latestTick) return history
    const lastHistoryPoint = history[history.length - 1]
    if (lastHistoryPoint && latestTick.time <= lastHistoryPoint.time) return history
    return [...history, { time: latestTick.time, value: latestTick.value }]
  }, [history, latestTick])

  /* ── Drawing store subscription ─────────────────────────── */
  const isDrawMode = useDrawingStore((s) => s.state.phase !== 'idle')
  const drawingPhase = useDrawingStore((s) => s.state.phase)
  const checkpointXs = useMemo(
    () => (market ? buildCheckpointXs(market as Market) : []),
    [market],
  )

  /* ── Time domain (auto-computed default — all data visible) ── */
  const timeDomain = useMemo<[number, number]>(() => {
    const first = mergedHistory[0]?.time ?? nowTime - 7 * 24 * 60 * 60 * 1000
    const lastData = mergedHistory[mergedHistory.length - 1]?.time ?? nowTime

    // Right edge: extend to marketEnd if it's in the future (blank space for
    // predictions / drawing), or to the end of prediction data, whichever is later.
    let rightEdge = Math.max(lastData, marketEnd)
    predictions.forEach((p) => {
      const last = p.data[p.data.length - 1]
      if (last && last.time > rightEdge) rightEdge = last.time
    })

    // Small right padding so the live tick / right edge doesn't touch the axis
    if (rightEdge <= lastData) {
      const span = lastData - first || 1
      rightEdge = lastData + span * 0.02
    }

    return [first, rightEdge]
  }, [mergedHistory, predictions, marketEnd, nowTime])

  const maxSpanMs = useMemo(() => {
    const totalSpan = timeDomain[1] - timeDomain[0]
    return Math.max(totalSpan * 3, 7 * 24 * 60 * 60 * 1000) // 3× data span or 7 days
  }, [timeDomain])

  /* ── Viewport: pan / zoom ────────────────────────────────── */
  const {
    effectiveTimeDomain: viewportTimeDomain,
    isFollowing: viewportIsFollowing,
    svgRef: viewportSvgRef,
    pointerHandlers: viewportPointerHandlers,
    isPanning: viewportIsPanning,
    resetViewport,
  } = useChartViewport({
    defaultTimeDomain: timeDomain,
    innerWidth,
    disabled: drawingPhase === 'sweeping',
    marginLeft: MARGIN.left,
    minSpanMs: 2 * 60 * 1000,
    maxSpanMs,
  })

  /* ── Notify data layer of viewport changes (for lazy pagination) ──
   *
   * Gated on `!viewportIsFollowing` so we don't trigger a fetch when the user
   * hasn't interacted. In following mode, `defaultTimeDomain` widens as older
   * pages arrive — emitting that would create a self-sustaining load loop where
   * each new page expands the domain, which emits again, which fetches again. */
  useEffect(() => {
    if (viewportIsFollowing) return
    onViewportChange?.(viewportTimeDomain)
  }, [viewportTimeDomain, viewportIsFollowing, onViewportChange])

  /* ── Price domain: envelope of data visible in viewport ──── */
  const priceDomainLive = useMemo<[number, number]>(
    () => computeVisiblePriceDomain(mergedHistory, predictions, viewportTimeDomain),
    [mergedHistory, predictions, viewportTimeDomain],
  )

  /* ── Y-axis freeze: domain held fixed during sweeping phase ── */
  const { effectiveDomain: frozenOrLiveDomain, freeze, thaw } = useYAxisFreeze(priceDomainLive)

  useEffect(() => {
    if (drawingPhase === 'sweeping') freeze()
    else thaw()
  }, [drawingPhase, freeze, thaw])

  /* ── Y-axis user scale (drag on axis-label area). Override wins over freeze. */
  const {
    effectiveDomain,
    pointerHandlers: yAxisPointerHandlers,
    resetYAxis,
  } = useYAxisViewport({ basePriceDomain: frozenOrLiveDomain })

  const timeScale = useMemo(
    () => scaleTime<number>({ domain: viewportTimeDomain, range: [0, innerWidth] }),
    [innerWidth, viewportTimeDomain],
  )
  const priceScale = useMemo(
    // `nice: true` rounds the domain outward to tick boundaries — that makes
    // user-driven scaling feel jittery (tiny drags get absorbed, then the range
    // snaps) and lets the midpoint shift as rounding deltas change with span.
    // Auto-fit already pads 0.9×/1.05× in computeVisiblePriceDomain, and d3's
    // tick selection picks nice round values regardless of domain niceness.
    () => scaleLinear<number>({ domain: effectiveDomain, range: [innerHeight, 0] }),
    [innerHeight, effectiveDomain],
  )

  /* ── Mapped history points for the morph line ───────────── */
  const historyPixelPoints = useMemo(
    () => mergedHistory.map((d) => ({ x: timeScale(d.time) as number, y: priceScale(d.value) as number })),
    [mergedHistory, timeScale, priceScale],
  )

  /** True once the morph is close enough that real chart elements can fade in */
  const chartRevealed = chartRevealing && !isLoading

  /* ── Crosshair state ─────────────────────────────────────── */
  const [hover, setHover] = useState<{ x: number; time: number; value: number } | null>(null)

  const handleMove = useCallback(
    (evt: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement> | React.PointerEvent<SVGRectElement>) => {
      const svg = (evt.currentTarget as SVGRectElement).ownerSVGElement
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const clientX = 'touches' in evt ? (evt.touches[0]?.clientX ?? 0) : (evt as React.MouseEvent).clientX
      const xInner = clientX - rect.left - MARGIN.left
      if (xInner < 0 || xInner > innerWidth) {
        setHover(null)
        return
      }
      const t = timeScale.invert(xInner).getTime()
      // In the past → read from history. In the future → read from selected prediction (if any).
      let sourceData: PricePoint[] = mergedHistory
      if (t > nowTime && selectedPathId) {
        const selected = predictions.find((p) => p.id === selectedPathId)
        if (selected) sourceData = selected.data
      }
      if (sourceData.length === 0) return
      const idx = bisectTime(sourceData, t, 1)
      const d0 = sourceData[idx - 1]
      const d1 = sourceData[idx]
      const d = !d1 ? d0 : !d0 ? d1 : t - d0.time > d1.time - t ? d1 : d0
      if (d) setHover({ x: timeScale(d.time), time: d.time, value: d.value })
    },
    [innerWidth, selectedPathId, timeScale, mergedHistory, predictions, nowTime],
  )

  const handleLeave = useCallback(() => setHover(null), [])

  if (innerWidth <= 0 || innerHeight <= 0) return null

  const nowX = timeScale(nowTime)
  const selected = predictions.find((p) => p.id === selectedPathId)
  const lastHistoryPoint = mergedHistory[mergedHistory.length - 1]
  const showMarketStartMarker = marketStart > nowTime
  const marketStartX = timeScale(marketStart)
  const showMarketEndMarker = marketEnd > nowTime
  const marketEndX = timeScale(marketEnd)

  return (
    <svg
      ref={viewportSvgRef}
      width={width}
      height={height}
      className="levx-chart"
      style={{ touchAction: 'none' }}
    >
      {/* ── Clip path: restricts chart content to the inner area ── */}
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={innerWidth} height={innerHeight} />
        </clipPath>
      </defs>

      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* ── Clipped chart content (prevents overflow on pan/zoom) ── */}
        <g clipPath={`url(#${clipId})`}>
        {/* ── Horizontal grid ─────────────────────── */}
        <GridRows
          scale={priceScale}
          width={innerWidth}
          stroke={C.grid}
          strokeWidth={1}
          numTicks={6}
        />

        {/* ── Draw-mode grid overlay (vertical checkpoint columns + prominent horizontal grid) ── */}
        <DrawingGrid
          xScale={timeScale}
          yScale={priceScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          checkpointXs={checkpointXs}
          isDrawMode={isDrawMode}
        />

        {/* ── Loading / morph line ─────────────────── */}
        <ChartMorphLine
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          isLoading={!!isLoading}
          dataPoints={historyPixelPoints}
          onRevealChart={handleRevealChart}
        />

        {/* ── Chart data (fades in after morph) ──────── */}
        <g style={{ opacity: chartRevealed ? 1 : 0, transition: 'opacity 400ms ease' }}>
          {/* ── Prediction paths ────────────────────── */}
          {predictions.map((path) => {
            const style = TONE_STYLES[path.tone]
            const isSelected = selectedPathId === path.id || selectedPathIds?.has(path.id)
            return (
              <LinePath<PricePoint>
                key={path.id}
                data={path.data}
                x={(d) => timeScale(d.time)}
                y={(d) => priceScale(d.value)}
                stroke={style.stroke}
                strokeWidth={1.5}
                strokeDasharray={style.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isSelected ? 0 : style.opacity}
                curve={CATMULL_ROM_ALPHA_05}
              />
            )
          })}

          {/* ── Other positions overlay (wagered paths, not selected) ── */}
          {showOtherPositions &&
            predictions
              .filter((p) => p.id !== selectedPathId && p.totalWagered > 0)
              .map((path) => (
                <LinePath<PricePoint>
                  key={`wager-${path.id}`}
                  data={path.data}
                  x={(d) => timeScale(d.time)}
                  y={(d) => priceScale(d.value)}
                  stroke={C.line}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.3}
                  curve={CATMULL_ROM_ALPHA_05}
                />
              ))}

          {/* ── Selected prediction overlays — solid line for each selected path ── */}
          {selectionInteractive && predictions
            .filter((p) => selectedPathIds?.has(p.id) || p.id === selectedPathId)
            .map((path) => (
              <LinePath<PricePoint>
                key={`sel-${path.id}`}
                data={path.data}
                x={(d) => timeScale(d.time)}
                y={(d) => priceScale(d.value)}
                stroke={C.line}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                curve={CATMULL_ROM_ALPHA_05}
              />
            ))}

          {/* ── Non-interactive selected overlay (quiet dotted preview) ── */}
          {selected && !selectionInteractive && (
            <LinePath<PricePoint>
              data={selected.data}
              x={(d) => timeScale(d.time)}
              y={(d) => priceScale(d.value)}
              stroke={C.muted}
              strokeWidth={1.5}
              strokeDasharray="2 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.65}
              curve={CATMULL_ROM_ALPHA_05}
            />
          )}

          {/* ── Historical price line ───────────────── */}
          <LinePath<PricePoint>
            data={mergedHistory}
            x={(d) => timeScale(d.time)}
            y={(d) => priceScale(d.value)}
            stroke={C.line}
            strokeWidth={2}
            strokeLinejoin="round"
            curve={curveMonotoneX}
          />

          {/* ── Now marker ──────────────────────────── */}
          <Line
            from={{ x: nowX, y: 0 }}
            to={{ x: nowX, y: innerHeight }}
            stroke={C.line}
            strokeWidth={1}
            strokeDasharray="2 4"
            opacity={0.4}
          />
          {lastHistoryPoint && (
            <Circle cx={nowX} cy={priceScale(lastHistoryPoint.value)} r={5} fill={C.line} />
          )}
          {showMarketStartMarker && (
            <>
              <text
                x={nowX - 6}
                y={innerHeight - 6}
                fontFamily="Space Mono, monospace"
                fontSize="9"
                letterSpacing="0.12em"
                fill={C.line}
                opacity={0.5}
                textAnchor="end"
              >
                [ NOW ]
              </text>
              {/* Horizontal connector from NOW dot to OPENS line */}
              {lastHistoryPoint && (
                <>
                  <Line
                    from={{ x: nowX, y: priceScale(lastHistoryPoint.value) }}
                    to={{ x: marketStartX, y: priceScale(lastHistoryPoint.value) }}
                    stroke={C.line}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.3}
                  />
                  <Circle cx={marketStartX} cy={priceScale(lastHistoryPoint.value)} r={4} fill={C.muted} />
                </>
              )}
            </>
          )}

          {/* ── Market start marker ────────────────── */}
          <Line
            from={{ x: marketStartX, y: 0 }}
            to={{ x: marketStartX, y: innerHeight }}
            stroke={C.muted}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.4}
          />
          <text
            x={marketStartX - 6}
            y={12}
            fontFamily="Space Mono, monospace"
            fontSize="9"
            letterSpacing="0.12em"
            fill={C.muted}
            textAnchor="end"
          >
            {showMarketStartMarker ? '[ OPENS ]' : '[ START ]'}
          </text>

          {/* ── Market end marker ─────────────────── */}
          {showMarketEndMarker && (
            <>
              <Line
                from={{ x: marketEndX, y: 0 }}
                to={{ x: marketEndX, y: innerHeight }}
                stroke={C.muted}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.5}
              />
              <text
                x={marketEndX - 6}
                y={12}
                fontFamily="Space Mono, monospace"
                fontSize="9"
                letterSpacing="0.12em"
                fill={C.muted}
                textAnchor="end"
              >
                [ ENDS ]
              </text>
            </>
          )}
        </g>
        </g>{/* end clip */}

        {/* ── Right Y-axis ────────────────────────── */}
        <AxisRight
          scale={priceScale}
          left={innerWidth}
          numTicks={6}
          stroke="transparent"
          tickStroke="transparent"
          tickLabelProps={() => ({
            fill: 'var(--chart-muted, #666666)',
            fontFamily: 'Space Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.08em',
            textAnchor: 'start',
            dx: 12,
            dy: 3,
          })}
          tickFormat={(v) => {
            const n = Number(v)
            if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
            if (n >= 1) return n.toFixed(n >= 100 ? 0 : 2)
            return n.toPrecision(3)
          }}
        />

        {/* ── Y-axis drag area (vertical scale) ──────
            Transparent rect over the right-margin label strip. Pointer handlers
            capture drag to scale the price domain; double-click resets. Sits
            above the AxisRight ticks in paint order so it receives events. */}
        <rect
          x={innerWidth}
          y={0}
          width={MARGIN.right}
          height={innerHeight}
          fill="transparent"
          style={{ cursor: 'ns-resize', touchAction: 'none' }}
          onPointerDown={yAxisPointerHandlers.onPointerDown}
          onPointerMove={yAxisPointerHandlers.onPointerMove}
          onPointerUp={yAxisPointerHandlers.onPointerUp}
          onPointerCancel={yAxisPointerHandlers.onPointerCancel}
          onDoubleClick={resetYAxis}
        />

        {/* ── Bottom X-axis ───────────────────────── */}
        <AxisBottom
          scale={timeScale}
          top={innerHeight}
          numTicks={(() => {
            const spanHrs = (viewportTimeDomain[1] - viewportTimeDomain[0]) / (60 * 60 * 1000)
            if (spanHrs <= 12) return 6      // HH:MM labels are short
            if (spanHrs <= 72) return 5      // "12 APR 14:00" labels are wider
            return 8
          })()}
          stroke="transparent"
          tickStroke="transparent"
          tickLabelProps={() => ({
            fill: 'var(--chart-muted, #666666)',
            fontFamily: 'Space Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.12em',
            textAnchor: 'middle',
            dy: 4,
          })}
          tickFormat={(v) => {
            const date = new Date(v as number)
            const [tStart, tEnd] = viewportTimeDomain
            const spanHours = (tEnd - tStart) / (60 * 60 * 1000)

            if (spanHours <= 12) {
              // Sub-day: "14:30"
              return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            }
            if (spanHours <= 72) {
              // 1–3 days: "12 APR 14:00" — compact day+time
              const day = date.getDate()
              const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
              const h = String(date.getHours()).padStart(2, '0')
              const m = String(date.getMinutes()).padStart(2, '0')
              return `${day} ${month} ${h}:${m}`
            }
            if (spanHours <= 30 * 24) {
              // Up to ~30 days: "APR 12"
              const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
              return `${month} ${date.getDate()}`
            }
            // Longer: "APR 26"
            const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
            const year = String(date.getFullYear()).slice(2)
            return `${month} ${year}`
          }}
        />

        {/* ── Hover crosshair ─────────────────────── */}
        {hover && (
          <>
            <Line
              from={{ x: hover.x, y: 0 }}
              to={{ x: hover.x, y: innerHeight }}
              stroke={C.line}
              strokeWidth={1}
              strokeDasharray="1 3"
              opacity={0.5}
              pointerEvents="none"
            />
            <Circle cx={hover.x} cy={priceScale(hover.value)} r={3} fill={C.line} />
          </>
        )}

        {/* ── Invisible hit area (pan + crosshair) ── */}
        <Bar
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          style={{ touchAction: 'none' }}
          onPointerDown={viewportPointerHandlers.onPointerDown}
          onPointerMove={(e: React.PointerEvent<SVGRectElement>) => {
            viewportPointerHandlers.onPointerMove(e)
            if (viewportIsPanning || e.buttons !== 0 || isDrawMode) {
              setHover(null)
            } else {
              handleMove(e)
            }
          }}
          onPointerUp={viewportPointerHandlers.onPointerUp}
          onPointerCancel={viewportPointerHandlers.onPointerCancel}
          onPointerLeave={handleLeave}
          onDoubleClick={resetViewport}
        />

        {/* ── Drawing overlay (render prop) ──────────
            Rendered LAST so its pointer-receiving <rect> sits above the hit-area
            <Bar> in SVG paint order. Otherwise the transparent Bar intercepts
            pointerdown and the drawing layer never fires. */}
        {renderDrawingOverlay?.({
          xScale: timeScale,
          yScale: priceScale,
          innerWidth,
          innerHeight,
          checkpointXs,
          marketStart,
          margin: MARGIN,
        })}

        {/* ── X-axis pan area — drag here to pan even during draw mode ── */}
        <rect
          x={0}
          y={innerHeight}
          width={innerWidth}
          height={MARGIN.bottom}
          fill="transparent"
          style={{ touchAction: 'none', cursor: 'grab' }}
          onPointerDown={viewportPointerHandlers.onPointerDown}
          onPointerMove={viewportPointerHandlers.onPointerMove}
          onPointerUp={viewportPointerHandlers.onPointerUp}
          onPointerCancel={viewportPointerHandlers.onPointerCancel}
          onDoubleClick={resetViewport}
        />
      </Group>

      {/* ── Floating readout ────────────────────────── */}
      {hover && (
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top - 16})`}>
          <text
            fontFamily="Space Mono, monospace"
            fontSize="10"
            letterSpacing="0.08em"
            fill={C.muted}
          >
            {new Date(hover.time)
              .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              .toUpperCase()}
          </text>
          <text
            x={140}
            fontFamily="Space Mono, monospace"
            fontSize="10"
            letterSpacing="0.08em"
            fill={C.line}
          >
            {hover.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </text>
        </g>
      )}
    </svg>
  )
}

/**
 * LevXChartOuter handles all top-level state reading (hooks called unconditionally)
 * and early-return UI states (loading, error, empty) before delegating to ParentSize + ChartInner.
 */
function LevXChartOuter(props: LevXChartProps) {
  const { height, isLoading, error, history, pair } = props

  /* ── All hooks called unconditionally at top level ───────── */
  const feedId = pair ? feedIdForPair(pair) : null
  const latestTick = useLatestPrice(feedId)

  /* ── Error / empty early returns ─────────────────────────── */
  if (error) return <Stub title="Chart error" subtitle={error.message} />
  if (!isLoading && history.length === 0 && !latestTick) return <Stub title="Waiting for price data…" />

  return (
    <div className="levx-chart-wrap" style={height ? { height } : undefined}>
      {isLoading && (
        <span className="sr-only" aria-label="Loading chart">Loading chart...</span>
      )}
      <ParentSize>
        {({ width, height: parentHeight }) => (
          <ChartInner {...props} width={width} height={parentHeight} />
        )}
      </ParentSize>
    </div>
  )
}

export function LevXChart(props: LevXChartProps) {
  return <LevXChartOuter {...props} />
}
