import { useEffect, useRef, useCallback } from 'react'
import { LinePath } from '@visx/shape'
import { curveCatmullRom } from '@visx/curve'
import { useDrawingStore } from '@/stores/drawingStore'
import { crossingDetector } from '@/lib/drawing/crossingDetector'
import type { CheckpointCrossing } from '@/lib/drawing/types'

/** Centripetal Catmull-Rom with α=0.5 — pre-created once, not per-render. */
const CATMULL_ROM_ALPHA_05 = curveCatmullRom.alpha(0.5)

/**
 * Stable empty values array — returned by the Zustand selector when the drawing
 * state has no values field (e.g. idle, submitted). Using a module-level constant
 * prevents the selector from returning a new [] reference each invocation, which
 * would otherwise cause infinite Zustand re-render loops.
 */
const EMPTY_VALUES: (number | null)[] = []

// Minimal scale interface — avoids d3-scale type gymnastics.
// Visx ScaleTime returns Date[] from domain() and ScaleLinear returns number[].
// Using readonly number[] here lets both satisfy the interface without assertion errors.
// The component only uses domain() to get [yMin, yMax] for clamping, so tuple-ness is
// not required — we just index [0] and [1].
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
  /** Margin object accepted for API compatibility; coordinate mapping uses getBoundingClientRect. */
  margin: { top: number; right: number; bottom: number; left: number }
  /** Domain-time checkpoint timestamps (ms) aligned with the drawing store values array. */
  checkpointXs: readonly number[]
  /** Domain-time boundary — pointerdown before this is ignored (history-region guard). */
  marketStart: number
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
 * DrawingLayer — SVG overlay rendered *inside* LevXChart's existing `<svg>`.
 *
 * Dual SVG mutation strategy:
 * - Raw in-flight stroke: mutated via `rawStrokeRef.current.setAttribute('d', ...)` at
 *   pointer-move rate (~125Hz). NO React state, NO Zustand commits for the raw path itself.
 * - Smoothed Catmull-Rom curve + checkpoint dots: React-rendered from `drawingStore.values`.
 *   Re-renders only when crossing events fire (sparse — 1–3 per move at normal speed).
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
  onStrokeStart,
  onStrokeEnd,
}: DrawingLayerProps) {
  // Subscribe to phase and values separately to minimise re-renders.
  const phase = useDrawingStore((s) => s.state.phase)
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

  // --- Refs ---
  const overlayRef = useRef<SVGRectElement>(null)
  const rawStrokeRef = useRef<SVGPathElement>(null)

  /**
   * scalesRef — always holds the latest scales.
   * Pattern 3 from RESEARCH: avoids stale-closure bugs when scales change
   * (e.g., on window resize or Y-axis freeze update) without adding scales to
   * useCallback deps (which would recreate the closure on every re-render).
   */
  const scalesRef = useRef({ xScale, yScale })
  useEffect(() => {
    scalesRef.current = { xScale, yScale }
  })

  // --- Mutable per-stroke state stored in refs (NOT React state) ---
  /** Raw SVG path data string for the in-flight stroke. */
  const rawPathDRef = useRef<string>('')
  /** Previous pointermove domain-X (for crossing detection). */
  const prevDomainXRef = useRef<number | null>(null)
  /** Previous pointermove domain-Y (for crossing detection). */
  const prevDomainYRef = useRef<number | null>(null)

  const isActive = phase !== 'idle'

  // ----------------------------------------------------------------
  // Pointer handlers
  // ----------------------------------------------------------------

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!isActive) return
      // Middle / right button → let the viewport pan handler (native SVG listener) handle it.
      if (e.button === 1 || e.button === 2) return

      // Convert pointer position to chart-area coords (0..innerWidth) by using
      // the ownerSVGElement's bounding rect.  The overlay <rect> lives inside a
      // translated <g> (MARGIN offset), so going via the SVG root and subtracting
      // the margin gives us the correct inner-chart pixel position regardless of
      // where the overlay rect itself is positioned.
      const svg = (e.currentTarget as SVGElement).ownerSVGElement
      if (!svg) return
      const svgRect = svg.getBoundingClientRect()
      const chartX = e.clientX - svgRect.left - margin.left
      const chartY = e.clientY - svgRect.top - margin.top

      const { xScale: xs, yScale: ys } = scalesRef.current
      const domainX = Number(xs.invert(chartX))
      const domainY = Number(ys.invert(chartY))

      // History-region guard (Pitfall 5): ignore pointerdown before marketStart.
      if (domainX < marketStart) return

      // Capture pointer so fast drags off the SVG edge don't break the stroke.
      e.currentTarget.setPointerCapture(e.pointerId)

      // Seed the raw stroke path in chart-area coords.
      rawPathDRef.current = `M ${chartX} ${chartY}`
      rawStrokeRef.current?.setAttribute('d', rawPathDRef.current)

      // Seed previous-position refs for the first pointermove.
      prevDomainXRef.current = domainX
      prevDomainYRef.current = domainY

      // Transition store to sweeping — Zustand commit.
      useDrawingStore.getState().beginStroke()
      // Notify parent (Y-axis freeze).
      onStrokeStart?.()
    },
    [isActive, marketStart, margin.left, margin.top, onStrokeStart],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!isActive) return
      // Only process moves while we're actively sweeping.
      const storeState = useDrawingStore.getState().state
      if (storeState.phase !== 'sweeping') return

      // Safety: if no buttons are pressed, the pointer was released without a
      // pointerUp firing (e.g., focus loss, pointer capture lost). End the stroke.
      if (e.buttons === 0) {
        useDrawingStore.getState().endStroke()
        prevDomainXRef.current = null
        prevDomainYRef.current = null
        onStrokeEnd?.()
        return
      }

      // Pitfall 5: fresh bounding rect on EVERY pointermove (never cached from pointerdown).
      const svg = (e.currentTarget as SVGElement).ownerSVGElement
      if (!svg) return
      const svgRect = svg.getBoundingClientRect()
      const chartX = e.clientX - svgRect.left - margin.left
      const chartY = e.clientY - svgRect.top - margin.top

      const { xScale: xs, yScale: ys } = scalesRef.current
      const domainX = Number(xs.invert(chartX))
      const domainY = Number(ys.invert(chartY))

      // --- Direct DOM mutation for the raw in-flight stroke (no React state) ---
      rawPathDRef.current += ` L ${chartX} ${chartY}`
      rawStrokeRef.current?.setAttribute('d', rawPathDRef.current)

      // --- Crossing detection → Zustand commit (sparse events only) ---
      const prevDomainX = prevDomainXRef.current
      const prevDomainY = prevDomainYRef.current
      if (prevDomainX !== null && prevDomainY !== null) {
        const crossings: CheckpointCrossing[] = crossingDetector(
          prevDomainX,
          domainX,
          prevDomainY,
          domainY,
          checkpointXs,
        )
        if (crossings.length > 0) {
          // Clamp Y to the current yScale domain to handle off-chart cursor motion.
          // ys.domain() returns (number|Date)[] — use Number() to normalise.
          const dom = ys.domain()
          const yMin = Number(dom[0])
          const yMax = Number(dom[1])
          const clamped = crossings.map((c) => ({
            index: c.index,
            y: Math.max(yMin, Math.min(yMax, c.y)),
          }))
          useDrawingStore.getState().setCheckpointValues(clamped)
        }
      }

      prevDomainXRef.current = domainX
      prevDomainYRef.current = domainY
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isActive, checkpointXs, margin.left, margin.top, marketStart],
  )

  const endStroke = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (!isActive) return
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Already released or never captured — safe to ignore.
      }

      // Transition store out of sweeping (→ drawMode or → ready if all filled).
      useDrawingStore.getState().endStroke()

      // Clear per-stroke refs.
      prevDomainXRef.current = null
      prevDomainYRef.current = null

      // Notify parent (Y-axis thaw, 300ms delayed internally by useYAxisFreeze).
      onStrokeEnd?.()

      // Fade the raw stroke to opacity 0, then clear the path data.
      const raw = rawStrokeRef.current
      if (raw) {
        raw.style.transition = 'opacity 400ms ease-out'
        raw.style.opacity = '0'
        setTimeout(() => {
          rawPathDRef.current = ''
          raw.setAttribute('d', '')
          raw.style.transition = ''
          raw.style.opacity = ''
        }, 420)
      }
    },
    [isActive, onStrokeEnd],
  )

  /** Safety net: if the browser revokes pointer capture, end the stroke. */
  const onLostCapture = useCallback(() => {
    const storeState = useDrawingStore.getState().state
    if (storeState.phase === 'sweeping') {
      useDrawingStore.getState().endStroke()
      prevDomainXRef.current = null
      prevDomainYRef.current = null
      onStrokeEnd?.()
    }
  }, [onStrokeEnd])

  // ----------------------------------------------------------------
  // Render guard: no overlay when idle
  // ----------------------------------------------------------------
  if (!isActive) return null

  // ----------------------------------------------------------------
  // Derive React-rendered captured points for the smoothed curve + dots
  // ----------------------------------------------------------------
  const capturedPoints: CapturedPoint[] = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v !== null && checkpointXs[i] !== undefined) {
      capturedPoints.push({ time: checkpointXs[i], value: v })
    }
  }

  // Overlay rect covers only the future-time region.
  const futureStartX = Math.max(0, Number(xScale(marketStart)))
  const futureWidth = Math.max(0, innerWidth - futureStartX)

  return (
    <g data-testid="drawing-layer">
      {/* Pointer overlay — transparent but receives events over the future-time region. */}
      <rect
        ref={overlayRef}
        x={futureStartX}
        y={0}
        width={futureWidth}
        height={innerHeight}
        fill="transparent"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onLostPointerCapture={onLostCapture}
        data-testid="drawing-overlay"
      />

      {/* Raw in-flight stroke — mutated via ref.setAttribute('d', ...), NOT React state. */}
      <path
        ref={rawStrokeRef}
        stroke="#5B9BF6"
        strokeWidth={1.5}
        fill="none"
        opacity={0.6}
        data-testid="raw-stroke"
      />

      {/* Smoothed Catmull-Rom curve through captured checkpoint values (React-rendered). */}
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
