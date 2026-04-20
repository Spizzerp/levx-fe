import { GridRows } from '@visx/grid'
import { Line } from '@visx/shape'
import type { D3Scale } from '@visx/scale'

/** Minimal callable scale: maps a numeric/Date input to a number output. Used for xScale. */
type CallableScale = (v: number | Date) => number

export interface DrawingGridProps {
  xScale: CallableScale
  yScale: D3Scale<number>
  innerWidth: number
  innerHeight: number
  checkpointXs: readonly number[]
  isDrawMode: boolean
}

export function DrawingGrid({
  xScale,
  yScale,
  innerWidth,
  innerHeight,
  checkpointXs,
  isDrawMode,
}: DrawingGridProps) {
  if (!isDrawMode) return null

  return (
    <g data-testid="drawing-grid">
      {/* Horizontal price grid — more prominent than the non-draw-mode grid */}
      <GridRows
        scale={yScale}
        width={innerWidth}
        stroke="#333333"
        strokeWidth={1}
        numTicks={8}
        strokeDasharray="2 6"
      />

      {/* Vertical checkpoint column guides */}
      {checkpointXs.map((ckTime, i) => {
        const x = xScale(ckTime)
        return (
          <Line
            key={i}
            from={{ x, y: 0 }}
            to={{ x, y: innerHeight }}
            stroke="#444444"
            strokeWidth={0.5}
            strokeDasharray="1 4"
            opacity={0.7}
            data-testid="checkpoint-column"
          />
        )
      })}
    </g>
  )
}
