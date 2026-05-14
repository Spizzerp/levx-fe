import { curveCatmullRom, curveMonotoneX } from '@visx/curve'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleLinear, scaleTime } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { useMemo } from 'react'

import type { PredictionPath, PricePoint } from '@/types/market'

const CATMULL_ROM_ALPHA_05 = curveCatmullRom.alpha(0.5)

const AI_PATH_PALETTE: readonly string[] = ['#5CC8FF', '#FF6BD6', '#F6CE48', '#9AE85B', '#A78BFA']

const USER_DRAWN_STYLE = { stroke: '#8FA3C9', dash: '3 3', opacity: 0.85 } as const
const AI_PATH_DASH = '4 4'
const AI_PATH_OPACITY = 0.7
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const MAX_HISTORY_LEAD_MS = 3 * DAY_MS

const C = {
  line: 'var(--chart-line, var(--color-ink-strong, #FFFFFF))',
  muted: 'var(--chart-muted, #999999)',
  grid: 'var(--chart-grid, #222222)',
}

interface MarketMiniChartProps {
  history: PricePoint[]
  paths?: PredictionPath[]
  nowTime: number
  marketStart: number
  marketEnd: number
}

function pathStyle(path: PredictionPath): { stroke: string; dash: string; opacity: number } {
  if (path.origin === 'user') return USER_DRAWN_STYLE
  return {
    stroke: AI_PATH_PALETTE[path.pathIndex % AI_PATH_PALETTE.length],
    dash: AI_PATH_DASH,
    opacity: AI_PATH_OPACITY,
  }
}

function buildTimeDomain(args: {
  nowTime: number
  marketStart: number
  marketEnd: number
}): [number, number] {
  const duration = args.marketEnd - args.marketStart
  if (!Number.isFinite(duration) || duration <= 0) {
    return [args.nowTime - HOUR_MS, args.nowTime + HOUR_MS]
  }

  // Keep the thumbnail focused on the forecast window while retaining a small
  // lead-in of real price history before the market start.
  const historyLead = Math.min(
    Math.max(duration * 0.3, Math.min(6 * HOUR_MS, duration)),
    MAX_HISTORY_LEAD_MS,
    duration,
  )

  return [args.marketStart - historyLead, args.marketEnd]
}

function buildPriceDomain(history: PricePoint[], paths: PredictionPath[]): [number, number] {
  const values = [
    ...history.map((point) => point.value),
    ...paths.flatMap((path) => path.data.map((point) => point.value)),
  ].filter(Number.isFinite)

  if (values.length === 0) return [0, 100]

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.01, 1)
    return [min - pad, max + pad]
  }

  const pad = (max - min) * 0.16
  return [min - pad, max + pad]
}

function filterPointsToDomain(points: PricePoint[], [from, to]: [number, number]): PricePoint[] {
  return points.filter((point) => point.time >= from && point.time <= to)
}

function MiniChartInner({
  width,
  height,
  history,
  paths = [],
  nowTime,
  marketStart,
  marketEnd,
}: MarketMiniChartProps & { width: number; height: number }) {
  const margin = { top: 12, right: 4, bottom: 8, left: 4 }
  const innerWidth = Math.max(0, width - margin.left - margin.right)
  const innerHeight = Math.max(0, height - margin.top - margin.bottom)

  const timeDomain = useMemo(
    () => buildTimeDomain({ nowTime, marketStart, marketEnd }),
    [marketEnd, marketStart, nowTime],
  )
  const visibleHistory = useMemo(
    () => filterPointsToDomain(history, timeDomain),
    [history, timeDomain],
  )
  const priceDomain = useMemo(
    () => buildPriceDomain(visibleHistory, paths),
    [visibleHistory, paths],
  )

  const timeScale = scaleTime({ range: [0, innerWidth], domain: timeDomain })
  const priceScale = scaleLinear({ range: [innerHeight, 0], domain: priceDomain })

  const lastHistory = visibleHistory[visibleHistory.length - 1]
  const markerLabel = nowTime < marketStart ? '[ OPENS ]' : '[ START ]'
  const gridRows = [0.25, 0.5, 0.75]
  const marketStartX = timeScale(marketStart) ?? 0
  const marketEndX = timeScale(marketEnd) ?? 0

  return (
    <svg width={width} height={height} className="pointer-events-none overflow-visible">
      <Group left={margin.left} top={margin.top}>
        {gridRows.map((ratio) => (
          <line
            key={ratio}
            x1={0}
            x2={innerWidth}
            y1={innerHeight * ratio}
            y2={innerHeight * ratio}
            stroke={C.grid}
            strokeWidth={1}
            opacity={0.45}
          />
        ))}

        <line
          x1={marketStartX}
          x2={marketStartX}
          y1={0}
          y2={innerHeight}
          stroke={C.muted}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.32}
        />
        <text
          x={Math.max(0, marketStartX - 4)}
          y={8}
          fontFamily="Space Mono, monospace"
          fontSize="7"
          letterSpacing="0.12em"
          fill={C.muted}
          opacity={0.6}
          textAnchor="end"
        >
          {markerLabel}
        </text>

        <line
          x1={marketEndX}
          x2={marketEndX}
          y1={0}
          y2={innerHeight}
          stroke={C.muted}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.36}
        />
        <text
          x={Math.max(0, marketEndX - 4)}
          y={8}
          fontFamily="Space Mono, monospace"
          fontSize="7"
          letterSpacing="0.12em"
          fill={C.muted}
          opacity={0.6}
          textAnchor="end"
        >
          [ ENDS ]
        </text>

        {paths.map((path) => {
          const style = pathStyle(path)

          return (
            <g key={path.id}>
              {path.data.length > 1 && (
                <LinePath<PricePoint>
                  data-testid={path.origin === 'ai' ? 'market-mini-ai-path' : undefined}
                  data={path.data}
                  x={(d) => timeScale(d.time) ?? 0}
                  y={(d) => priceScale(d.value) ?? 0}
                  stroke={style.stroke}
                  strokeWidth={1.3}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={style.opacity}
                  curve={CATMULL_ROM_ALPHA_05}
                />
              )}
            </g>
          )
        })}

        <LinePath<PricePoint>
          data={visibleHistory}
          x={(d) => timeScale(d.time) ?? 0}
          y={(d) => priceScale(d.value) ?? 0}
          stroke={C.line}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
          curve={curveMonotoneX}
        />

        {lastHistory && (
          <>
            <circle
              cx={timeScale(lastHistory.time) ?? 0}
              cy={priceScale(lastHistory.value) ?? 0}
              r={4}
              fill={C.line}
              opacity={0.16}
            />
            <circle
              cx={timeScale(lastHistory.time) ?? 0}
              cy={priceScale(lastHistory.value) ?? 0}
              r={2.5}
              fill={C.line}
              opacity={0.86}
            />
          </>
        )}
      </Group>
    </svg>
  )
}

export function MarketMiniChart(props: MarketMiniChartProps) {
  const hasData =
    props.history.length > 0 || (props.paths?.some((path) => path.data.length > 0) ?? false)

  return (
    <div className="h-full w-full opacity-90 transition-opacity duration-300 group-hover:opacity-100">
      {hasData ? (
        <ParentSize>
          {({ width, height }) => <MiniChartInner {...props} width={width} height={height} />}
        </ParentSize>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-ink-dim text-nano font-mono tracking-widest uppercase">
            No data
          </span>
        </div>
      )}
    </div>
  )
}
