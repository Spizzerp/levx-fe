import { useCallback, useEffect, useRef, useState } from 'react'

import { DRAW_IN_FLIGHT } from '@/lib/drawing/colors'
import { clientToChart } from '@/lib/drawing/pointer'
import { DRAG_THRESHOLD_PX, type CheckpointCrossing, type MinimalScale } from '@/lib/drawing/types'
import { selectValues, useDrawingStore } from '@/stores/drawingStore'
import { DrawingOverlayRect } from '@/features/chart/drawingTools/DrawingOverlayRect'

export interface SelectToolProps {
  xScale: MinimalScale
  yScale: MinimalScale
  innerWidth: number
  innerHeight: number
  margin: { top: number; right: number; bottom: number; left: number }
  checkpointXs: readonly number[]
  marketStart: number
  onStrokeStart?: () => void
  onStrokeEnd?: () => void
}

/** Pixel radius for hit-testing a checkpoint dot under the pointer. Matches
 *  the BezierTool anchor hit area for consistency. */
const DOT_HIT_RADIUS = 9
/** Squared form for cheap distance comparisons inside hover-rate handlers. */
const DOT_HIT_RADIUS_SQ = DOT_HIT_RADIUS * DOT_HIT_RADIUS

/** How a marquee gesture combines its enclosed indices with the existing
 *  selection on pointerup. Set at pointerdown from shift/alt modifiers and
 *  carried through the gesture. */
type MarqueeMode = 'replace' | 'add' | 'remove'

interface MarqueeState {
  startChartX: number
  startChartY: number
  curChartX: number
  curChartY: number
  mode: MarqueeMode
}

interface MoveState {
  startDomainY: number
  /** Snapshot of values at gesture start — deltas apply to these so the
   *  motion stays linear in the original positions, not the live (already
   *  modified) ones. */
  originals: readonly (number | null)[]
  /** Selected indices that have non-null originals — pre-filtered for speed. */
  movableIndices: readonly number[]
  /** Domain Y bounds derived from the selected originals, used to clamp the
   *  drag delta so no node escapes the visible price range. */
  minOriginal: number
  maxOriginal: number
}

/**
 * SelectTool — marquee selection + vertical move.
 *
 * Pointerdown over a checkpoint dot (within DOT_HIT_RADIUS):
 *   - plain      → replace selection with just that dot, begin a vertical drag
 *   - shift-down → add the dot to the current selection (no drag)
 *   - alt-down   → remove the dot from the current selection (no drag)
 *
 * Pointerdown over empty space: start a marquee rectangle. On pointerup, the
 * dots whose pixel positions fall inside combine with the current selection
 * via the modifier captured at pointerdown:
 *   - plain      → replace selection
 *   - shift-down → union (add)
 *   - alt-down   → difference (remove)
 *
 * A plain click that doesn't drag clears the selection; the same click with
 * shift or alt held leaves the selection unchanged.
 *
 * The drag delta is clamped so the most-extreme selected node never leaves
 * the visible Y domain — selected nodes preserve their relative spacing the
 * whole way. Move gestures wrap in `beginStroke → setCheckpointValues →
 * endStroke` so the whole motion is one undoable unit. Selection changes do
 * not touch drawingStore values and are not undoable.
 */
export function SelectTool({
  xScale,
  yScale,
  innerWidth,
  innerHeight,
  margin,
  checkpointXs,
  onStrokeStart,
  onStrokeEnd,
}: SelectToolProps) {
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const moveRef = useRef<MoveState | null>(null)

  // Cursor is mutated directly on the rect to avoid React re-renders on every
  // hover-test pointermove. The rect's JSX style intentionally does NOT set a
  // cursor — this ref is the sole source of truth.
  const overlayRef = useRef<SVGRectElement>(null)
  const cursorRef = useRef<string>('default')
  const setCursor = useCallback((cursor: string) => {
    if (cursorRef.current === cursor) return
    cursorRef.current = cursor
    if (overlayRef.current) overlayRef.current.style.cursor = cursor
  }, [])

  // Set initial cursor on mount.
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.style.cursor = cursorRef.current
  }, [])

  const scalesRef = useRef({ xScale, yScale })
  useEffect(() => {
    scalesRef.current = { xScale, yScale }
  })

  // ----------------------------------------------------------------
  // Hit testing — find the topmost (latest-rendered) checkpoint dot under
  // the pointer, if any. Returns its index or -1.
  // ----------------------------------------------------------------

  const hitTestDot = useCallback(
    (chartX: number, chartY: number): number => {
      const values = selectValues(useDrawingStore.getState().state)
      const { xScale: xs, yScale: ys } = scalesRef.current
      let bestIdx = -1
      let bestDistSq = DOT_HIT_RADIUS_SQ
      for (let i = 0; i < values.length; i++) {
        const v = values[i]
        if (v === null || checkpointXs[i] === undefined) continue
        const dx = chartX - Number(xs(checkpointXs[i]))
        const dy = chartY - Number(ys(v))
        const dSq = dx * dx + dy * dy
        if (dSq <= bestDistSq) {
          bestDistSq = dSq
          bestIdx = i
        }
      }
      return bestIdx
    },
    [checkpointXs],
  )

  // ----------------------------------------------------------------
  // Pointer handlers
  // ----------------------------------------------------------------

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (e.button === 1 || e.button === 2) return

      const pos = clientToChart(e, margin)
      if (!pos) return
      const { chartX, chartY } = pos

      const hitIdx = hitTestDot(chartX, chartY)
      const shift = e.shiftKey
      const alt = e.altKey

      // Suppress browser defaults when a selection-modifier is held. On
      // macOS, Option+click on some elements triggers system actions ("Look
      // up", drag-scroll) that can swallow the pointer event before our
      // handler updates the store; preventDefault forecloses those.
      if (shift || alt) e.preventDefault()

      if (hitIdx >= 0) {
        const sel = useDrawingStore.getState().selectedIndices

        // Modifier on dot — adjust selection without starting a drag. The
        // user releases and then drags separately to move.
        if (shift) {
          if (!sel.has(hitIdx)) {
            const next = new Set<number>(sel)
            next.add(hitIdx)
            useDrawingStore.getState().setSelectedIndices(next)
          }
          return
        }
        if (alt) {
          if (sel.has(hitIdx)) {
            const next = new Set<number>(sel)
            next.delete(hitIdx)
            useDrawingStore.getState().setSelectedIndices(next)
          }
          return
        }

        // Plain click — replace selection if not already selected, then drag.
        let movable: number[]
        if (sel.has(hitIdx)) {
          movable = [...sel]
        } else {
          const next = new Set<number>([hitIdx])
          useDrawingStore.getState().setSelectedIndices(next)
          movable = [hitIdx]
        }

        // Filter to indices with non-null values (defensive — a stale index
        // pointing at null after undo can't be moved).
        const values = selectValues(useDrawingStore.getState().state)
        movable = movable.filter((i) => i >= 0 && i < values.length && values[i] !== null)
        if (movable.length === 0) return

        // Begin a stroke so the motion captures one undo entry. beginStroke
        // is a no-op outside drawMode/ready — guard accordingly.
        const phase = useDrawingStore.getState().state.phase
        if (phase !== 'drawMode' && phase !== 'ready') return

        e.currentTarget.setPointerCapture(e.pointerId)
        setCursor('grabbing')

        useDrawingStore.getState().beginStroke()
        onStrokeStart?.()

        const { yScale: ys } = scalesRef.current
        const startDomainY = Number(ys.invert(chartY))
        const originals = [...values]

        let minOriginal = Infinity
        let maxOriginal = -Infinity
        for (const i of movable) {
          const v = originals[i]
          if (typeof v !== 'number') continue
          if (v < minOriginal) minOriginal = v
          if (v > maxOriginal) maxOriginal = v
        }

        moveRef.current = {
          startDomainY,
          originals,
          movableIndices: movable,
          minOriginal,
          maxOriginal,
        }
        return
      }

      // Empty area → start marquee. Don't clear selection yet — pointerup
      // decides whether this was a click or a drag. Modifier captured here
      // determines how the marquee combines with existing selection.
      const mode: MarqueeMode = shift ? 'add' : alt ? 'remove' : 'replace'
      e.currentTarget.setPointerCapture(e.pointerId)
      setCursor('crosshair')
      setMarquee({
        startChartX: chartX,
        startChartY: chartY,
        curChartX: chartX,
        curChartY: chartY,
        mode,
      })
    },
    [hitTestDot, margin.left, margin.top, onStrokeStart, setCursor],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      const pos = clientToChart(e, margin)
      if (!pos) return
      const { chartX, chartY } = pos

      const move = moveRef.current
      const mq = marquee

      // Pointer was released without firing pointerUp (focus loss etc.).
      if ((move || mq) && e.buttons === 0) {
        if (move) {
          useDrawingStore.getState().endStroke()
          onStrokeEnd?.()
          moveRef.current = null
        }
        if (mq) setMarquee(null)
        setCursor('default')
        return
      }

      if (move) {
        const { yScale: ys } = scalesRef.current
        const curDomainY = Number(ys.invert(chartY))
        const rawDelta = curDomainY - move.startDomainY

        // Clamp delta so the lowest selected node stays >= yMin and the
        // highest stays <= yMax. This preserves the relative spacing of
        // selected nodes — once one hits a boundary, the whole group stops.
        const dom = ys.domain()
        const yMin = Number(dom[0])
        const yMax = Number(dom[1])
        const minDelta = yMin - move.minOriginal
        const maxDelta = yMax - move.maxOriginal
        const delta = Math.max(minDelta, Math.min(maxDelta, rawDelta))

        const crossings: CheckpointCrossing[] = move.movableIndices.map((i) => ({
          index: i,
          y: (move.originals[i] as number) + delta,
        }))
        useDrawingStore.getState().setCheckpointValues(crossings)
        return
      }

      if (mq) {
        setMarquee({ ...mq, curChartX: chartX, curChartY: chartY })
        return
      }

      // Idle hover — update cursor based on whether pointer is over a dot.
      const hitIdx = hitTestDot(chartX, chartY)
      setCursor(hitIdx >= 0 ? 'grab' : 'default')
    },
    [marquee, margin.left, margin.top, onStrokeEnd, hitTestDot, setCursor],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Already released.
      }

      if (moveRef.current) {
        useDrawingStore.getState().endStroke()
        onStrokeEnd?.()
        moveRef.current = null
        // The next pointermove will re-evaluate hover state; reset to default
        // for the brief interim so we don't show 'grabbing' when no longer
        // dragging.
        setCursor('default')
        return
      }

      const mq = marquee
      if (!mq) return
      setMarquee(null)
      setCursor('default')

      const dx = mq.curChartX - mq.startChartX
      const dy = mq.curChartY - mq.startChartY
      const dragPx = Math.hypot(dx, dy)

      if (dragPx < DRAG_THRESHOLD_PX) {
        // Click on empty space. With a modifier held, leave selection
        // alone — the user is shift/alt-clicking with no drag, which has no
        // meaningful selection effect. Plain click clears selection.
        if (mq.mode === 'replace') {
          useDrawingStore.getState().clearSelectedIndices()
        }
        return
      }

      const x1 = Math.min(mq.startChartX, mq.curChartX)
      const x2 = Math.max(mq.startChartX, mq.curChartX)
      const y1 = Math.min(mq.startChartY, mq.curChartY)
      const y2 = Math.max(mq.startChartY, mq.curChartY)

      const values = selectValues(useDrawingStore.getState().state)
      const { xScale: xs, yScale: ys } = scalesRef.current
      const inside = new Set<number>()
      for (let i = 0; i < values.length; i++) {
        const v = values[i]
        if (v === null || checkpointXs[i] === undefined) continue
        const cx = Number(xs(checkpointXs[i]))
        const cy = Number(ys(v))
        if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
          inside.add(i)
        }
      }

      const current = useDrawingStore.getState().selectedIndices
      let next: Set<number>
      if (mq.mode === 'add') {
        next = new Set<number>(current)
        inside.forEach((i) => next.add(i))
      } else if (mq.mode === 'remove') {
        next = new Set<number>(current)
        inside.forEach((i) => next.delete(i))
      } else {
        next = inside
      }
      useDrawingStore.getState().setSelectedIndices(next)
    },
    [marquee, checkpointXs, onStrokeEnd, setCursor],
  )

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Already released.
      }
      if (moveRef.current) {
        useDrawingStore.getState().endStroke()
        onStrokeEnd?.()
        moveRef.current = null
      }
      setMarquee(null)
      setCursor('default')
    },
    [onStrokeEnd, setCursor],
  )

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  // Cursor is mutated via overlayRef inside pointer handlers (grab on hover
  // over a dot, grabbing during drag, crosshair during marquee, default
  // otherwise). Cursor is intentionally absent from JSX style so React
  // re-renders don't clobber it.
  return (
    <>
      <DrawingOverlayRect
        ref={overlayRef}
        x={0}
        width={innerWidth}
        height={innerHeight}
        dataTool="select"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
      {marquee && (() => {
        const x = Math.min(marquee.startChartX, marquee.curChartX)
        const y = Math.min(marquee.startChartY, marquee.curChartY)
        const w = Math.abs(marquee.curChartX - marquee.startChartX)
        const h = Math.abs(marquee.curChartY - marquee.startChartY)
        return (
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            fill={DRAW_IN_FLIGHT}
            fillOpacity={0.08}
            stroke={DRAW_IN_FLIGHT}
            strokeWidth={1}
            strokeDasharray="3 3"
            pointerEvents="none"
            data-testid="select-marquee"
          />
        )
      })()}
    </>
  )
}
