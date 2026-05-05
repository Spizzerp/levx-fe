import { curveMonotoneX } from '@visx/curve'
import { LinearGradient } from '@visx/gradient'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleLinear, scaleTime } from '@visx/scale'
import { AreaClosed, LinePath } from '@visx/shape'
import { useMemo } from 'react'

import type { PredictionPath, PricePoint } from '@/types/market'

interface MarketMiniChartProps {
  history: PricePoint[]
  paths?: PredictionPath[]
}

function MiniChartInner({
  width,
  height,
  history,
  paths = [],
}: MarketMiniChartProps & { width: number; height: number }) {
  const margin = { top: 6, right: 4, bottom: 4, left: 4 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  // Merge history + all path data for shared domain
  const allPoints = useMemo(() => {
    const pts = [...history]
    paths.forEach((p) => pts.push(...p.data))
    return pts
  }, [history, paths])

  const timeDomain = useMemo<[number, number]>(() => {
    const times = allPoints.map((d) => d.time)
    return [Math.min(...times), Math.max(...times)]
  }, [allPoints])

  const priceDomain = useMemo<[number, number]>(() => {
    let min = Infinity
    let max = -Infinity
    allPoints.forEach((d) => {
      if (d.value < min) min = d.value
      if (d.value > max) max = d.value
    })
    if (min === Infinity) return [0, 100]
    const pad = (max - min) * 0.14
    return [min - pad, max + pad]
  }, [allPoints])

  const timeScale = scaleTime({ range: [0, innerWidth], domain: timeDomain })
  const priceScale = scaleLinear({ range: [innerHeight, 0], domain: priceDomain })

  // Last history point (junction between history and paths)
  const lastHistory = history[history.length - 1]
  const junctionX = lastHistory ? (timeScale(lastHistory.time) ?? 0) : 0
  const junctionY = lastHistory ? (priceScale(lastHistory.value) ?? 0) : 0

  return (
    <svg width={width} height={height} className="pointer-events-none overflow-visible">
      <defs>
        <LinearGradient
          id="chart-gradient"
          from="var(--color-ink-strong)"
          to="var(--color-ink-strong)"
          fromOpacity={0.15}
          toOpacity={0}
        />
      </defs>
      <Group left={margin.left} top={margin.top}>
        {/* Area fill for history */}
        <AreaClosed<PricePoint>
          data={history}
          x={(d) => timeScale(d.time) ?? 0}
          y={(d) => priceScale(d.value) ?? 0}
          yScale={priceScale}
          fill="url(#chart-gradient)"
          curve={curveMonotoneX}
        />

        {/* Faint path lines — rendered before history so history sits on top */}
        {paths.map((path) => (
          <LinePath<PricePoint>
            key={path.id}
            data={path.data}
            x={(d) => timeScale(d.time) ?? 0}
            y={(d) => priceScale(d.value) ?? 0}
            stroke="var(--color-ink-strong)"
            strokeWidth={1}
            strokeOpacity={0.15}
            strokeDasharray="3 4"
            curve={curveMonotoneX}
          />
        ))}

        {/* History line */}
        <LinePath<PricePoint>
          data={history}
          x={(d) => timeScale(d.time) ?? 0}
          y={(d) => priceScale(d.value) ?? 0}
          stroke="var(--color-ink-strong)"
          strokeWidth={1.5}
          strokeOpacity={0.8}
          curve={curveMonotoneX}
        />

        {/* Junction dot — where history ends / paths begin */}
        {lastHistory && (
          <>
            <circle
              cx={junctionX}
              cy={junctionY}
              r={4}
              fill="var(--color-ink-strong)"
              className="animate-pulse"
              opacity={0.2}
            />
            <circle cx={junctionX} cy={junctionY} r={2} fill="var(--color-ink-strong)" opacity={1} />
          </>
        )}
      </Group>
    </svg>
  )
}

export function MarketMiniChart(props: MarketMiniChartProps) {
  const hasHistory = props.history.length > 0

  return (
    <div className="h-full w-full opacity-75 transition-opacity duration-300 group-hover:opacity-95">
      {hasHistory ? (
        <ParentSize>
          {({ width, height }) => (
            <MiniChartInner {...props} width={width} height={height} />
          )}
        </ParentSize>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-ink-dim text-nano font-mono uppercase tracking-widest">
            No data
          </span>
        </div>
      )}
    </div>
  )
}
