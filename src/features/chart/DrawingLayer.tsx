import { useEffect } from 'react'
import { LinePath } from '@visx/shape'
import { curveCatmullRom } from '@visx/curve'
import { selectValues, useDrawingStore } from '@/stores/drawingStore'
import { useDrawBroadcast, usePublishDrawFrame } from '@/lib/supabase/hooks'
import { useWalletStore } from '@/stores/walletStore'
import type { MinimalScale } from '@/lib/drawing/types'
import { BezierTool } from '@/features/chart/drawingTools/BezierTool'
import { FreehandTool } from '@/features/chart/drawingTools/FreehandTool'
import { LineTool } from '@/features/chart/drawingTools/LineTool'
import { SelectTool } from '@/features/chart/drawingTools/SelectTool'

/** Centripetal Catmull-Rom with α=0.5 — pre-created once, not per-render. */
const CATMULL_ROM_ALPHA_05 = curveCatmullRom.alpha(0.5)

/**
 * Drawing palette — picked to avoid collision with chart palette:
 *   white (#FFFFFF history/live), green (#5CF78B bull), gold (#F6CE48 neutral),
 *   red-orange (#FF483B bear/accent), light blue (#5B9BF6 custom prediction).
 * Violet → magenta sits in a hue range nothing else on the chart occupies, and
 * the cool→warm shift between unselected and selected states is a strong cue.
 */
const DRAW_UNSELECTED = '#8B5CF6'
const DRAW_SELECTED = '#EC4899'

export interface DrawingLayerProps {
  xScale: MinimalScale
  yScale: MinimalScale
  innerWidth: number
  innerHeight: number
  /** Margin object accepted for API compatibility; tools convert via getBoundingClientRect. */
  margin: { top: number; right: number; bottom: number; left: number }
  /** Domain-time checkpoint timestamps (ms) aligned with the drawing store values array. */
  checkpointXs: readonly number[]
  /** Domain-time boundary — pointerdown before this is ignored (history-region guard). */
  marketStart: number
  /** Market id used to scope the realtime broadcast channel. */
  marketId?: string
  /** Called when a stroke begins — parent freezes Y axis. */
  onStrokeStart?: () => void
  /** Called after pointerup — parent thaws Y axis. */
  onStrokeEnd?: () => void
}

/** A point on the smoothed Catmull-Rom curve (derived from store values). */
interface CapturedPoint {
  /** Domain time (checkpoint X in ms). */
  time: number
  /** Domain price (checkpoint Y captured value). */
  value: number
  /** Original checkpoint index in the store's values array — needed to test selection. */
  index: number
}

/**
 * DrawingLayer — shared SVG shell rendered *inside* LevXChart's existing `<svg>`.
 *
 * Owns the cross-tool concerns: smoothed Catmull-Rom curve through captured
 * checkpoint values, checkpoint dots + price labels, ghost paths from other
 * users, and the realtime broadcast effect. The tool-specific authoring UI
 * (overlay rect, in-flight stroke, anchors, handles) is delegated to a tool
 * component selected from `drawingStore.activeTool`.
 *
 * Returns `null` when phase is `idle` (no overlay mounted at all).
 */
export function DrawingLayer({
  xScale,
  yScale,
  innerWidth,
  innerHeight,
  margin,
  checkpointXs,
  marketStart,
  marketId,
  onStrokeStart,
  onStrokeEnd,
}: DrawingLayerProps) {
  // Realtime broadcast: publish own draws, subscribe to others'.
  const selfWallet = useWalletStore((s) => s.publicKey?.toBase58() ?? null)
  const publish = usePublishDrawFrame(marketId ?? '', selfWallet)
  const { liveDraws } = useDrawBroadcast(marketId ?? '', selfWallet)

  // Subscribe to phase, values, and active tool separately to minimise re-renders.
  const phase = useDrawingStore((s) => s.state.phase)
  const activeTool = useDrawingStore((s) => s.activeTool)
  const selectedIndices = useDrawingStore((s) => s.selectedIndices)
  const values = useDrawingStore((s) => selectValues(s.state))

  const isActive = phase !== 'idle'

  // Captured points derived from store values — fed to the smoothed curve, dots,
  // and broadcast effect. Computed BEFORE the isActive early-return so hook order
  // stays stable across active/idle toggles.
  const capturedPoints: CapturedPoint[] = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v !== null && checkpointXs[i] !== undefined) {
      capturedPoints.push({ time: checkpointXs[i], value: v, index: i })
    }
  }

  // Maximal runs of consecutive captured points whose original checkpoint
  // indices are all in selectedIndices. Each run of length ≥ 2 contains at
  // least one selected edge (an edge connects two consecutive captured points;
  // an edge is "selected" iff both endpoints are in selectedIndices).
  // Rendered as overlay sub-curves on top of the base curve.
  const selectedRuns: CapturedPoint[][] = []
  {
    let run: CapturedPoint[] = []
    for (const p of capturedPoints) {
      if (selectedIndices.has(p.index)) {
        run.push(p)
      } else {
        if (run.length >= 2) selectedRuns.push(run)
        run = []
      }
    }
    if (run.length >= 2) selectedRuns.push(run)
  }

  // Broadcast captured points whenever they change (no-op if no marketId / wallet).
  // Hook MUST be declared before the early return — rules of hooks.
  //
  // Signature: length + sum of values. Sum changes whenever any value
  // changes (modulo astronomically rare floating-point collisions on a
  // single-checkpoint swap), and is O(n) without allocating a string.
  let broadcastSig = capturedPoints.length
  for (const p of capturedPoints) broadcastSig += p.value
  useEffect(() => {
    if (!isActive || !marketId || !selfWallet || capturedPoints.length === 0) return
    publish({
      wallet: selfWallet,
      points: capturedPoints,
      timestamp: Date.now(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, marketId, selfWallet, broadcastSig])

  if (!isActive) return null

  return (
    <g data-testid="drawing-layer">
      {/* Active authoring tool — renders its own overlay rect + in-flight visuals. */}
      {activeTool === 'freehand' && (
        <FreehandTool
          xScale={xScale}
          yScale={yScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          margin={margin}
          checkpointXs={checkpointXs}
          marketStart={marketStart}
          onStrokeStart={onStrokeStart}
          onStrokeEnd={onStrokeEnd}
        />
      )}
      {activeTool === 'line' && (
        <LineTool
          xScale={xScale}
          yScale={yScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          margin={margin}
          checkpointXs={checkpointXs}
          marketStart={marketStart}
          onStrokeStart={onStrokeStart}
          onStrokeEnd={onStrokeEnd}
        />
      )}
      {activeTool === 'bezier' && (
        <BezierTool
          xScale={xScale}
          yScale={yScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          margin={margin}
          checkpointXs={checkpointXs}
          marketStart={marketStart}
          onStrokeStart={onStrokeStart}
          onStrokeEnd={onStrokeEnd}
        />
      )}
      {activeTool === 'select' && (
        <SelectTool
          xScale={xScale}
          yScale={yScale}
          innerWidth={innerWidth}
          innerHeight={innerHeight}
          margin={margin}
          checkpointXs={checkpointXs}
          marketStart={marketStart}
          onStrokeStart={onStrokeStart}
          onStrokeEnd={onStrokeEnd}
        />
      )}

      {/* Smoothed Catmull-Rom curve through captured checkpoint values.
          pointerEvents="none" so the curve never intercepts clicks intended
          for the active tool overlay underneath (notably the SelectTool
          marquee / dot-drag hit testing). */}
      {capturedPoints.length >= 2 && (
        <LinePath<CapturedPoint>
          data={capturedPoints}
          x={(d) => Number(xScale(d.time))}
          y={(d) => Number(yScale(d.value))}
          curve={CATMULL_ROM_ALPHA_05}
          stroke={DRAW_UNSELECTED}
          strokeWidth={2}
          fill="none"
          pointerEvents="none"
          data-testid="smoothed-curve"
        />
      )}

      {/* Overlay sub-curves over runs of consecutive selected captured points.
          Re-uses the same Catmull-Rom curve so each segment between two
          selected nodes renders in the selected color. Slight geometry
          deviation can occur at run boundaries (the sub-curve uses ghost
          endpoints from the run's first/last points instead of the underlying
          curve's neighbours) — sub-pixel for typical curves. */}
      {selectedRuns.map((run, idx) => (
        <LinePath<CapturedPoint>
          key={`sel-${run[0].index}-${run[run.length - 1].index}`}
          data={run}
          x={(d) => Number(xScale(d.time))}
          y={(d) => Number(yScale(d.value))}
          curve={CATMULL_ROM_ALPHA_05}
          stroke={DRAW_SELECTED}
          strokeWidth={2}
          fill="none"
          pointerEvents="none"
          data-testid="selected-segment"
          data-run-index={idx}
        />
      ))}

      {/* Ghost paths from other authenticated users currently drawing on this market. */}
      {Object.values(liveDraws).map((frame) => (
        frame.points.length >= 2 && (
          <LinePath<{ time: number; value: number }>
            key={frame.wallet}
            data={frame.points}
            x={(d) => Number(xScale(d.time))}
            y={(d) => Number(yScale(d.value))}
            curve={CATMULL_ROM_ALPHA_05}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            fill="none"
            pointerEvents="none"
            data-testid={`ghost-path-${frame.wallet.slice(0, 4)}`}
          />
        )
      ))}

      {/* Checkpoint dots — one per non-null value.
          Radius adapts to viewport zoom: when checkpoints are densely packed
          (zoomed out), dots shrink so they don't merge into a thick line.
          Price labels only on the global max and min of the drawn path. */}
      {(() => {
        let globalMax = -Infinity
        let globalMin = Infinity
        let maxIdx = -1
        let minIdx = -1
        for (let i = 0; i < values.length; i++) {
          const v = values[i]
          if (v === null) continue
          if (v > globalMax) { globalMax = v; maxIdx = i }
          if (v < globalMin) { globalMin = v; minIdx = i }
        }

        // Pixel spacing between adjacent checkpoints (constant — checkpoints
        // are evenly spaced in time). Falls back to a comfortable default when
        // fewer than two checkpoints exist.
        const checkpointPixelSpacing = checkpointXs.length >= 2
          ? Math.abs(Number(xScale(checkpointXs[1])) - Number(xScale(checkpointXs[0])))
          : 16
        // Cap visual diameter to ~2/3 of spacing so adjacent dots stay
        // visually separate; clamp to a sensible min/max.
        const dotRadius = Math.max(1, Math.min(4, checkpointPixelSpacing / 3))

        return values.map((v, i) => {
          if (v === null || checkpointXs[i] === undefined) return null
          const cx = Number(xScale(checkpointXs[i]))
          const cy = Number(yScale(v))
          const showLabel = i === maxIdx || (i === minIdx && minIdx !== maxIdx)
          const isSelected = selectedIndices.has(i)

          return (
            <g
              key={i}
              data-testid="checkpoint-dot"
              data-selected={isSelected ? 'true' : 'false'}
              pointerEvents="none"
            >
              <circle
                cx={cx}
                cy={cy}
                r={dotRadius}
                fill={isSelected ? DRAW_SELECTED : DRAW_UNSELECTED}
              />
              {showLabel && (
                <text
                  x={cx + 6}
                  y={i === maxIdx ? cy - 8 : cy + 14}
                  className="fill-ink-strong font-mono text-caption"
                >
                  {v.toFixed(0)}
                </text>
              )}
            </g>
          )
        })
      })()}
    </g>
  )
}
