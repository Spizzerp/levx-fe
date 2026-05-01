import { useEffect } from 'react'
import { LinePath } from '@visx/shape'
import { curveCatmullRom } from '@visx/curve'
import { useDrawingStore } from '@/stores/drawingStore'
import { useDrawBroadcast, usePublishDrawFrame } from '@/lib/supabase/hooks'
import { useWalletStore } from '@/stores/walletStore'
import { FreehandTool } from '@/features/chart/drawingTools/FreehandTool'
import { LineTool } from '@/features/chart/drawingTools/LineTool'

/** Centripetal Catmull-Rom with α=0.5 — pre-created once, not per-render. */
const CATMULL_ROM_ALPHA_05 = curveCatmullRom.alpha(0.5)

/**
 * Stable empty values array — returned by the Zustand selector when the drawing
 * state has no values field (e.g. idle, submitted). Using a module-level constant
 * prevents the selector from returning a new [] reference each invocation, which
 * would otherwise cause infinite Zustand re-render loops.
 */
const EMPTY_VALUES: (number | null)[] = []

// Minimal scale interface — see FreehandTool for rationale.
interface MinimalScale {
  (v: number | Date): number
  invert(pixel: number): number | Date
  domain(): readonly (number | Date)[]
  range(): readonly number[]
}

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
  const values = useDrawingStore((s) => {
    const st = s.state
    if (
      st.phase === 'drawMode' ||
      st.phase === 'sweeping' ||
      st.phase === 'ready' ||
      st.phase === 'confirming' ||
      st.phase === 'error'
    ) {
      return st.values as (number | null)[]
    }
    return EMPTY_VALUES
  })

  const isActive = phase !== 'idle'

  // Captured points derived from store values — fed to the smoothed curve, dots,
  // and broadcast effect. Computed BEFORE the isActive early-return so hook order
  // stays stable across active/idle toggles.
  const capturedPoints: CapturedPoint[] = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v !== null && checkpointXs[i] !== undefined) {
      capturedPoints.push({ time: checkpointXs[i], value: v })
    }
  }

  // Broadcast captured points whenever they change (no-op if no marketId / wallet).
  // Hook MUST be declared before the early return — rules of hooks.
  const broadcastSig = capturedPoints.map((p) => p.value).join(',')
  useEffect(() => {
    if (!isActive || !marketId || !selfWallet || capturedPoints.length === 0) return
    publish({
      wallet: selfWallet,
      points: capturedPoints,
      timestamp: Date.now(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, marketId, selfWallet, capturedPoints.length, broadcastSig])

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

      {/* Smoothed Catmull-Rom curve through captured checkpoint values. */}
      {capturedPoints.length >= 2 && (
        <LinePath<CapturedPoint>
          data={capturedPoints}
          x={(d) => Number(xScale(d.time))}
          y={(d) => Number(yScale(d.value))}
          curve={CATMULL_ROM_ALPHA_05}
          stroke="#5B9BF6"
          strokeWidth={2}
          fill="none"
          data-testid="smoothed-curve"
        />
      )}

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

        return values.map((v, i) => {
          if (v === null || checkpointXs[i] === undefined) return null
          const cx = Number(xScale(checkpointXs[i]))
          const cy = Number(yScale(v))
          const showLabel = i === maxIdx || (i === minIdx && minIdx !== maxIdx)

          return (
            <g key={i} data-testid="checkpoint-dot">
              <circle cx={cx} cy={cy} r={4} fill="#5B9BF6" />
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
