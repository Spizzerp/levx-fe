import { curveMonotoneX } from '@visx/curve'
import { Group } from '@visx/group'
import { ParentSize } from '@visx/responsive'
import { scaleLinear, scaleTime } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { useMemo } from 'react'

import type { PricePoint } from '@/types/market'

interface MarketMiniChartProps {
  history: PricePoint[]
}

function MiniChartInner({
  width,
  height,
  history,
}: MarketMiniChartProps & { width: number; height: number }) {
  const margin = { top: 4, right: 4, bottom: 4, left: 4 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const timeDomain = useMemo<[number, number]>(() => {
    const first = history[0]?.time ?? Date.now()
    const last = history[history.length - 1]?.time ?? Date.now()
    return [first, last]
  }, [history])

  const priceDomain = useMemo<[number, number]>(() => {
    let min = Infinity
    let max = -Infinity
    history.forEach((d) => {
      if (d.value < min) min = d.value
      if (d.value > max) max = d.value
    })
    if (min === Infinity) return [0, 100]
    const pad = (max - min) * 0.1
    return [min - pad, max + pad]
  }, [history])

  const timeScale = scaleTime({
    range: [0, innerWidth],
    domain: timeDomain,
  })

  const priceScale = scaleLinear({
    range: [innerHeight, 0],
    domain: priceDomain,
  })

  return (
    <svg width={width} height={height} className="pointer-events-none overflow-visible">
      <Group left={margin.left} top={margin.top}>
        {/* History */}
        <LinePath<PricePoint>
          data={history}
          x={(d) => timeScale(d.time) ?? 0}
          y={(d) => priceScale(d.value) ?? 0}
          stroke="var(--color-ink-strong, #FFFFFF)"
          strokeWidth={1.5}
          curve={curveMonotoneX}
        />
      </Group>
    </svg>
  )
}

export function MarketMiniChart(props: MarketMiniChartProps) {
  const hasHistory = props.history.length > 0

  return (
    <div className="h-full w-full opacity-80 transition-opacity group-hover:opacity-100">
      {hasHistory ? (
        <ParentSize>
          {({ width, height }) => (
            <MiniChartInner {...props} width={width} height={height} />
          )}
        </ParentSize>
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-lg bg-ink/5">
          <span className="text-ink-dim text-nano font-mono uppercase">
            No price data
          </span>
        </div>
      )}
    </div>
  )
}
