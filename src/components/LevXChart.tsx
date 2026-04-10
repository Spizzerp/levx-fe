import { AxisBottom, AxisRight } from '@visx/axis'
import { curveMonotoneX } from '@visx/curve'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleLinear, scaleTime } from '@visx/scale'
import { Bar, Circle, Line, LinePath } from '@visx/shape'
import { bisector } from 'd3-array'
import { useCallback, useMemo, useState } from 'react'

import type { PathTone, PredictionPath, PricePoint } from '@/types/market'

import './LevXChart.css'

/* ── Visual config — derived from Nothing tokens ────────────────── */

const TONE_STYLES: Record<PathTone, { stroke: string; dash: string; opacity: number }> = {
  'ultra-bull': { stroke: '#4A9E5C', dash: '5 4', opacity: 0.95 },
  bull: { stroke: '#4A9E5C', dash: '4 4', opacity: 0.45 },
  neutral: { stroke: '#999999', dash: '2 4', opacity: 0.65 },
  bear: { stroke: '#D71921', dash: '4 4', opacity: 0.45 },
  'ultra-bear': { stroke: '#D71921', dash: '5 4', opacity: 0.95 },
  custom: { stroke: '#5B9BF6', dash: '3 3', opacity: 0.85 },
}

const MARGIN = { top: 32, right: 80, bottom: 40, left: 16 }

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
  /** which prediction path is currently highlighted */
  selectedPathId?: string | null
  /** override fixed height; if omitted, fills parent */
  height?: number
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
}: InnerProps) {
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)

  /* ── Price domain: envelope of all data ± padding ────────── */
  const priceDomain = useMemo<[number, number]>(() => {
    const all: number[] = []
    history.forEach((p) => all.push(p.value))
    predictions.forEach((path) => path.data.forEach((p) => all.push(p.value)))
    if (all.length === 0) return [0, 1]
    const min = Math.min(...all)
    const max = Math.max(...all)
    return [min * 0.9, max * 1.05]
  }, [history, predictions])

  /* ── Time domain: include pre-market history and post-market predictions ── */
  const timeDomain = useMemo<[number, number]>(() => {
    const firstHistory = history[0]?.time ?? marketStart
    let lastPred = marketEnd
    predictions.forEach((p) => {
      const last = p.data[p.data.length - 1]
      if (last && last.time > lastPred) lastPred = last.time
    })
    return [Math.min(firstHistory, marketStart), Math.max(lastPred, marketEnd)]
  }, [history, predictions, marketStart, marketEnd])

  const timeScale = useMemo(
    () => scaleTime<number>({ domain: timeDomain, range: [0, innerWidth] }),
    [innerWidth, timeDomain],
  )
  const priceScale = useMemo(
    () => scaleLinear<number>({ domain: priceDomain, range: [innerHeight, 0], nice: true }),
    [innerHeight, priceDomain],
  )

  /* ── Crosshair state ─────────────────────────────────────── */
  const [hover, setHover] = useState<{ x: number; time: number; value: number } | null>(null)

  const handleMove = useCallback(
    (evt: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement>) => {
      const svg = (evt.currentTarget as SVGRectElement).ownerSVGElement
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const clientX = 'touches' in evt ? (evt.touches[0]?.clientX ?? 0) : evt.clientX
      const xInner = clientX - rect.left - MARGIN.left
      if (xInner < 0 || xInner > innerWidth) {
        setHover(null)
        return
      }
      const t = timeScale.invert(xInner).getTime()
      // In the past → read from history. In the future → read from selected prediction (if any).
      let sourceData: PricePoint[] = history
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
    [innerWidth, selectedPathId, timeScale, history, predictions, nowTime],
  )

  const handleLeave = useCallback(() => setHover(null), [])

  if (innerWidth <= 0 || innerHeight <= 0) return null

  const nowX = timeScale(nowTime)
  const selected = predictions.find((p) => p.id === selectedPathId)
  const lastHistoryPoint = history[history.length - 1]
  const showMarketStartMarker = marketStart > nowTime
  const marketStartX = timeScale(marketStart)

  return (
    <svg width={width} height={height} className="levx-chart">
      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* ── Horizontal grid ─────────────────────── */}
        <GridRows
          scale={priceScale}
          width={innerWidth}
          stroke="#222222"
          strokeWidth={1}
          numTicks={6}
        />

        {/* ── Prediction paths ────────────────────── */}
        {predictions.map((path) => {
          const style = TONE_STYLES[path.tone]
          const isSelected = selectedPathId === path.id
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
              curve={curveMonotoneX}
            />
          )
        })}

        {/* ── Selected prediction overlay ─────────── */}
        {selected && (
          <LinePath<PricePoint>
            data={selected.data}
            x={(d) => timeScale(d.time)}
            y={(d) => priceScale(d.value)}
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            curve={curveMonotoneX}
            style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' }}
          />
        )}

        {/* ── Historical price line ───────────────── */}
        <LinePath<PricePoint>
          data={history}
          x={(d) => timeScale(d.time)}
          y={(d) => priceScale(d.value)}
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinejoin="round"
          curve={curveMonotoneX}
        />

        {/* ── Now marker ──────────────────────────── */}
        <Line
          from={{ x: nowX, y: 0 }}
          to={{ x: nowX, y: innerHeight }}
          stroke="#FFFFFF"
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={0.4}
        />
        {lastHistoryPoint && (
          <Circle cx={nowX} cy={priceScale(lastHistoryPoint.value)} r={5} fill="#FFFFFF" />
        )}

        {/* ── Market opens marker (pending state) ─── */}
        {showMarketStartMarker && (
          <>
            <Line
              from={{ x: marketStartX, y: 0 }}
              to={{ x: marketStartX, y: innerHeight }}
              stroke="#999999"
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.5}
            />
            <text
              x={marketStartX + 6}
              y={12}
              fontFamily="Space Mono, monospace"
              fontSize="9"
              letterSpacing="0.12em"
              fill="#999999"
            >
              [ OPENS ]
            </text>
          </>
        )}

        {/* ── Right Y-axis ────────────────────────── */}
        <AxisRight
          scale={priceScale}
          left={innerWidth}
          numTicks={6}
          stroke="transparent"
          tickStroke="transparent"
          tickLabelProps={() => ({
            fill: '#666666',
            fontFamily: 'Space Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.08em',
            textAnchor: 'start',
            dx: 12,
            dy: 3,
          })}
          tickFormat={(v) => {
            const n = Number(v)
            return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
          }}
        />

        {/* ── Bottom X-axis ───────────────────────── */}
        <AxisBottom
          scale={timeScale}
          top={innerHeight}
          numTicks={8}
          stroke="transparent"
          tickStroke="transparent"
          tickLabelProps={() => ({
            fill: '#666666',
            fontFamily: 'Space Mono, monospace',
            fontSize: 10,
            letterSpacing: '0.12em',
            textAnchor: 'middle',
            dy: 4,
          })}
          tickFormat={(v) => {
            const date = new Date(v as number)
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
              stroke="#FFFFFF"
              strokeWidth={1}
              strokeDasharray="1 3"
              opacity={0.5}
              pointerEvents="none"
            />
            <Circle cx={hover.x} cy={priceScale(hover.value)} r={3} fill="#FFFFFF" />
          </>
        )}

        {/* ── Invisible hit area ──────────────────── */}
        <Bar
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          onTouchMove={handleMove}
          onTouchEnd={handleLeave}
        />
      </Group>

      {/* ── Floating readout ────────────────────────── */}
      {hover && (
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top - 16})`}>
          <text
            fontFamily="Space Mono, monospace"
            fontSize="10"
            letterSpacing="0.08em"
            fill="#999999"
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
            fill="#FFFFFF"
          >
            {hover.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </text>
        </g>
      )}
    </svg>
  )
}

export function LevXChart(props: LevXChartProps) {
  const { height } = props
  return (
    <div className="levx-chart-wrap" style={height ? { height } : undefined}>
      <ParentSize>
        {({ width, height: parentHeight }) => (
          <ChartInner {...props} width={width} height={parentHeight} />
        )}
      </ParentSize>
    </div>
  )
}
