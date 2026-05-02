import { useCallback, useEffect, useRef, useState } from 'react'

import { sampleBezierAtCheckpoints, type BezierAnchor } from '@/lib/drawing/bezierSampling'
import {
  DRAW_COMMIT_FILL,
  DRAW_COMMIT_INK,
  DRAW_IN_FLIGHT,
} from '@/lib/drawing/colors'
import { clientToChart, getFutureRegion } from '@/lib/drawing/pointer'
import { DRAG_THRESHOLD_PX, type MinimalScale } from '@/lib/drawing/types'
import { useBezierStore } from '@/stores/bezierStore'
import { useDrawingStore } from '@/stores/drawingStore'
import { DrawingOverlayRect } from '@/features/chart/drawingTools/DrawingOverlayRect'

export interface BezierToolProps {
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

interface DragState {
  startChartX: number
  startChartY: number
  startDomainX: number
  startDomainY: number
  handleChartX: number
  handleChartY: number
  handleDomainX: number
  handleDomainY: number
}

/**
 * Identifies what part of a committed anchor is currently being dragged.
 * 'out' = stored outgoing handle. 'in' = mirrored incoming handle (we write to
 * outHandle, mirroring across the anchor — symmetric in v1). 'anchor' = the
 * anchor itself (handles travel with it; X snaps to nearest checkpoint).
 */
interface EditTarget {
  anchorIdx: number
  kind: 'out' | 'in' | 'anchor'
}

/** Hit area radius for handle dots — visual is r=3, hit area generously larger. */
const HANDLE_HIT_RADIUS = 8
/** Hit area radius for the anchor dot — visual is r=4, hit area generously larger. */
const ANCHOR_HIT_RADIUS = 9

/** Snap a domain x to the closest checkpoint timestamp. */
function snapToNearestCheckpoint(
  domainX: number,
  checkpointXs: readonly number[],
): number {
  if (checkpointXs.length === 0) return domainX
  let bestIdx = 0
  let bestDist = Math.abs(domainX - checkpointXs[0])
  for (let i = 1; i < checkpointXs.length; i++) {
    const d = Math.abs(domainX - checkpointXs[i])
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return checkpointXs[bestIdx]
}

/**
 * BezierTool — Illustrator-style pen tool.
 *
 * Each click places an anchor; click-drag pulls out a smooth (mirrored)
 * handle. Anchors stored in domain coords so pan/zoom between clicks doesn't
 * shift them. Path commits via the floating ✓ button (or Enter); Backspace
 * pops the last anchor; Esc cancels. Tool switch unmounts the component and
 * drops local state for free.
 *
 * Authoring is purely local — the drawing-store state machine is untouched
 * until commit, when `beginStroke → setCheckpointValues → endStroke` runs in
 * one tick to produce a single undoable unit.
 */
export function BezierTool({
  xScale,
  yScale,
  innerWidth,
  innerHeight,
  margin,
  checkpointXs,
  marketStart,
  onStrokeStart,
  onStrokeEnd,
}: BezierToolProps) {
  // anchors live in bezierStore so undo/redo (Cmd/Ctrl+Z) can coordinate with
  // the drawingStore's commit-level undo. Transient drag/edit state stays
  // local — it isn't undoable.
  const anchors = useBezierStore((s) => s.anchors)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)

  // editRef shadows editTarget so pointermove handlers can read fresh state
  // without waiting for a re-render — pointermove can fire before React commits.
  const editRef = useRef<EditTarget | null>(null)

  // preEditRef captures the anchors snapshot at the start of a gesture so we
  // can push (before, after) onto bezier history once the gesture completes.
  const preEditRef = useRef<BezierAnchor[] | null>(null)

  const scalesRef = useRef({ xScale, yScale })
  useEffect(() => {
    scalesRef.current = { xScale, yScale }
  })

  // Reset bezier authoring state when the tool unmounts (tool switch / exit
  // draw mode). Keeps the v1 "switch cancels in-progress" rule.
  //
  // Known limitation: this also wipes bezier history. If the user commits a
  // bezier path then switches tools, a Cmd+Z that walks back into the
  // bezier-commit values change will revert the values but cannot restore the
  // anchor authoring state — bezier.past was reset on unmount. The values
  // change is still undoable via drawingStore.undo(); only the anchor-edit
  // granularity is lost across tool switches.
  useEffect(() => {
    return () => {
      useBezierStore.getState().reset()
    }
  }, [])

  // ----------------------------------------------------------------
  // Commit / cancel
  // ----------------------------------------------------------------

  const commit = useCallback(() => {
    const a = useBezierStore.getState().anchors
    if (a.length < 2) return

    // Phase guard — beginStroke is a no-op outside drawMode/ready, so without
    // this check we'd push a bezier commit-history entry that the drawing
    // store never received the corresponding values for. Cmd+Z walking over
    // that orphan entry would then call drawingStore.undo() against a stack
    // entry that doesn't exist, leaving the two histories permanently out of
    // sync. Belt-and-braces — the toolbar already gates the bezier tool to
    // non-idle phases.
    const phase = useDrawingStore.getState().state.phase
    if (phase !== 'drawMode' && phase !== 'ready') return

    const { yScale: ys } = scalesRef.current
    const dom = ys.domain()
    const yMin = Number(dom[0])
    const yMax = Number(dom[1])
    const crossings = sampleBezierAtCheckpoints(a, checkpointXs, yMin, yMax)
    if (crossings.length === 0) return

    onStrokeStart?.()
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues(crossings)
    useDrawingStore.getState().endStroke()
    onStrokeEnd?.()

    // pushCommit clears anchors and records a 'commit' history entry. The
    // toolbar's Cmd+Z handler walks back over this entry by also calling
    // drawingStore.undo() to revert the values write.
    useBezierStore.getState().pushCommit(a)
    setDrag(null)
  }, [checkpointXs, onStrokeStart, onStrokeEnd])

  const cancel = useCallback(() => {
    // If a component drag is in progress, the live anchors hold transient
    // mid-gesture state. Use the pre-drag snapshot as 'before' so undo
    // restores the pre-drag shape, not the half-finished one.
    const live = useBezierStore.getState().anchors
    const before = preEditRef.current ?? live
    if (before.length === 0) {
      // Nothing to undo. Just clear transient drag state.
      setDrag(null)
      preEditRef.current = null
      editRef.current = null
      setEditTarget(null)
      return
    }
    useBezierStore.getState().pushEdit(before, [])
    setDrag(null)
    preEditRef.current = null
    editRef.current = null
    setEditTarget(null)
  }, [])

  // ----------------------------------------------------------------
  // Keyboard: Esc / Enter / Backspace
  // ----------------------------------------------------------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      const current = useBezierStore.getState().anchors
      if (e.key === 'Escape') {
        if (current.length === 0) return
        e.preventDefault()
        cancel()
      } else if (e.key === 'Enter') {
        if (current.length < 2) return
        e.preventDefault()
        commit()
      } else if (e.key === 'Backspace') {
        if (current.length === 0) return
        e.preventDefault()
        useBezierStore.getState().pushEdit(current, current.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel, commit])

  // ----------------------------------------------------------------
  // Pointer handlers
  // ----------------------------------------------------------------

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (e.button === 1 || e.button === 2) return

      const pos = clientToChart(e, margin)
      if (!pos) return
      const { chartX, chartY } = pos

      const { xScale: xs, yScale: ys } = scalesRef.current
      const domainX = Number(xs.invert(chartX))
      const domainY = Number(ys.invert(chartY))

      if (domainX < marketStart) return

      e.currentTarget.setPointerCapture(e.pointerId)

      setDrag({
        startChartX: chartX,
        startChartY: chartY,
        startDomainX: domainX,
        startDomainY: domainY,
        handleChartX: chartX,
        handleChartY: chartY,
        handleDomainX: domainX,
        handleDomainY: domainY,
      })
    },
    [marketStart, margin.left, margin.top],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (drag === null) return
      if (e.buttons === 0) return

      const pos = clientToChart(e, margin)
      if (!pos) return
      const { chartX, chartY } = pos

      const { xScale: xs, yScale: ys } = scalesRef.current
      const domainX = Number(xs.invert(chartX))
      const domainY = Number(ys.invert(chartY))

      setDrag({
        ...drag,
        handleChartX: chartX,
        handleChartY: chartY,
        handleDomainX: domainX,
        handleDomainY: domainY,
      })
    },
    [drag, margin.left, margin.top],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // already released
      }
      const d = drag
      if (!d) return

      const dragPx = Math.hypot(
        d.handleChartX - d.startChartX,
        d.handleChartY - d.startChartY,
      )
      const isCorner = dragPx < DRAG_THRESHOLD_PX

      const newAnchor: BezierAnchor = {
        domainX: d.startDomainX,
        domainY: d.startDomainY,
        outHandle: isCorner
          ? null
          : { domainX: d.handleDomainX, domainY: d.handleDomainY },
      }

      // One placement → one history entry.
      const before = useBezierStore.getState().anchors
      useBezierStore.getState().pushEdit(before, [...before, newAnchor])
      setDrag(null)
    },
    [drag],
  )

  const onPointerCancel = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
    setDrag(null)
  }, [])

  // ----------------------------------------------------------------
  // Component-edit pointer handlers (drag a placed anchor or its handle)
  // ----------------------------------------------------------------

  const onComponentPointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>, target: EditTarget) => {
      // Don't let the overlay rect's pointerdown fire and place a new anchor.
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      editRef.current = target
      setEditTarget(target)
      // Snapshot pre-state so we can push a single history entry at gesture end.
      preEditRef.current = useBezierStore.getState().anchors
    },
    [],
  )

  const onComponentPointerMove = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      const cur = editRef.current
      if (!cur) return
      // Pointer was released without firing pointerUp (e.g. pointer left the
      // SVG and the OS dropped capture). Push a single history entry for the
      // gesture so the transient anchor change remains undoable.
      if (e.buttons === 0) {
        const before = preEditRef.current
        const after = useBezierStore.getState().anchors
        if (before !== null && before !== after) {
          useBezierStore.getState().pushEdit(before, after)
        }
        editRef.current = null
        setEditTarget(null)
        preEditRef.current = null
        return
      }

      const pos = clientToChart(e, margin)
      if (!pos) return
      const { chartX, chartY } = pos

      const { xScale: xs, yScale: ys } = scalesRef.current
      const rawDomainX = Number(xs.invert(chartX))
      const rawDomainY = Number(ys.invert(chartY))

      // Transient update — no history push during drag.
      const prev = useBezierStore.getState().anchors
      const a = prev[cur.anchorIdx]
      if (!a) return

      let updated: BezierAnchor
      if (cur.kind === 'anchor') {
        // Snap X to nearest checkpoint; Y stays continuous. Handles travel
        // with the anchor (relative offset preserved) so symmetric handles
        // stay symmetric.
        const snappedX = snapToNearestCheckpoint(rawDomainX, checkpointXs)
        const dx = snappedX - a.domainX
        const dy = rawDomainY - a.domainY
        const newOut = a.outHandle
          ? {
              domainX: a.outHandle.domainX + dx,
              domainY: a.outHandle.domainY + dy,
            }
          : null
        updated = { domainX: snappedX, domainY: rawDomainY, outHandle: newOut }
      } else {
        // Handle drag: 'out' writes the cursor directly; 'in' mirrors across
        // the anchor — outHandle is always the source of truth.
        const newOut =
          cur.kind === 'out'
            ? { domainX: rawDomainX, domainY: rawDomainY }
            : {
                domainX: 2 * a.domainX - rawDomainX,
                domainY: 2 * a.domainY - rawDomainY,
              }
        updated = { ...a, outHandle: newOut }
      }

      const next = [...prev]
      next[cur.anchorIdx] = updated
      useBezierStore.getState().setAnchors(next)
    },
    [checkpointXs, margin.left, margin.top],
  )

  const onComponentPointerUp = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // already released
      }
      // Push one history entry for the whole gesture. Every pointermove
      // allocates a new anchors array via setAnchors, so before !== after
      // by reference whenever pointermove fired at least once. A click
      // without drag never triggers setAnchors → references stay equal →
      // skip the push (no-op gesture, nothing to undo).
      const before = preEditRef.current
      const after = useBezierStore.getState().anchors
      if (before !== null && before !== after) {
        useBezierStore.getState().pushEdit(before, after)
      }
      preEditRef.current = null
      editRef.current = null
      setEditTarget(null)
    },
    [],
  )

  // ----------------------------------------------------------------
  // Render — derive chart-coords from domain anchors via current scales.
  // ----------------------------------------------------------------

  const future = getFutureRegion(xScale, marketStart, innerWidth)

  // Build the cubic path d attribute through committed anchors.
  function pathD(allAnchors: BezierAnchor[]): string {
    if (allAnchors.length === 0) return ''
    const pts = allAnchors.map((a) => ({
      x: Number(xScale(a.domainX)),
      y: Number(yScale(a.domainY)),
      out:
        a.outHandle === null
          ? null
          : {
              x: Number(xScale(a.outHandle.domainX)),
              y: Number(yScale(a.outHandle.domainY)),
            },
    }))
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const cur = pts[i]
      const c1 = prev.out ?? { x: prev.x, y: prev.y }
      // Mirror cur.out across cur to get incoming handle for cur.
      const c2 = cur.out
        ? { x: 2 * cur.x - cur.out.x, y: 2 * cur.y - cur.out.y }
        : { x: cur.x, y: cur.y }
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${cur.x} ${cur.y}`
    }
    return d
  }

  // Build a preview path that includes the in-flight provisional anchor.
  function previewPathD(): string {
    if (drag === null) return pathD(anchors)
    const provisionalAnchor: BezierAnchor = {
      domainX: drag.startDomainX,
      domainY: drag.startDomainY,
      outHandle: { domainX: drag.handleDomainX, domainY: drag.handleDomainY },
    }
    return pathD([...anchors, provisionalAnchor])
  }

  // Pixel coords for committed anchors (for dots + checkmark anchor).
  const anchorPx = anchors.map((a) => ({
    x: Number(xScale(a.domainX)),
    y: Number(yScale(a.domainY)),
    out:
      a.outHandle === null
        ? null
        : {
            x: Number(xScale(a.outHandle.domainX)),
            y: Number(yScale(a.outHandle.domainY)),
          },
  }))

  // Rightmost anchor for the floating ✓ button (only when 2+ anchors placed).
  let rightmostIdx = -1
  let rightmostX = -Infinity
  for (let i = 0; i < anchorPx.length; i++) {
    if (anchorPx[i].x > rightmostX) {
      rightmostX = anchorPx[i].x
      rightmostIdx = i
    }
  }
  const showCheck = anchors.length >= 2 && rightmostIdx >= 0

  return (
    <>
      <DrawingOverlayRect
        x={future.x}
        width={future.width}
        height={innerHeight}
        cursor="crosshair"
        dataTool="bezier"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />

      {/* Cubic path through committed anchors + (optionally) the in-flight one. */}
      {(anchors.length >= 1 || drag !== null) && (
        <path
          d={previewPathD()}
          stroke={DRAW_IN_FLIGHT}
          strokeWidth={2}
          fill="none"
          opacity={0.85}
          pointerEvents="none"
          data-testid="bezier-path"
        />
      )}

      {/* Anchor dots + handle indicators + hit areas. */}
      {anchorPx.map((p, i) => {
        const inX = p.out ? 2 * p.x - p.out.x : null
        const inY = p.out ? 2 * p.y - p.out.y : null
        const isEditingOut = editTarget?.anchorIdx === i && editTarget?.kind === 'out'
        const isEditingIn = editTarget?.anchorIdx === i && editTarget?.kind === 'in'
        const isEditingAnchor = editTarget?.anchorIdx === i && editTarget?.kind === 'anchor'
        return (
          <g key={i} data-testid="bezier-anchor">
            {p.out && (
              <>
                {/* Visual handle lines (non-interactive). */}
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={p.out.x}
                  y2={p.out.y}
                  stroke={DRAW_IN_FLIGHT}
                  strokeWidth={1}
                  opacity={0.4}
                  pointerEvents="none"
                />
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={inX as number}
                  y2={inY as number}
                  stroke={DRAW_IN_FLIGHT}
                  strokeWidth={1}
                  opacity={0.4}
                  pointerEvents="none"
                />
                {/* Visual handle dots (non-interactive). */}
                <circle
                  cx={p.out.x}
                  cy={p.out.y}
                  r={3}
                  fill="transparent"
                  stroke={DRAW_IN_FLIGHT}
                  strokeWidth={1}
                  pointerEvents="none"
                />
                <circle
                  cx={inX as number}
                  cy={inY as number}
                  r={3}
                  fill="transparent"
                  stroke={DRAW_IN_FLIGHT}
                  strokeWidth={1}
                  pointerEvents="none"
                />
                {/* Handle hit areas — larger than visual dot for easy targeting. */}
                <circle
                  cx={p.out.x}
                  cy={p.out.y}
                  r={HANDLE_HIT_RADIUS}
                  fill="transparent"
                  style={{ cursor: isEditingOut ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) => onComponentPointerDown(e, { anchorIdx: i, kind: 'out' })}
                  onPointerMove={onComponentPointerMove}
                  onPointerUp={onComponentPointerUp}
                  onPointerCancel={onComponentPointerUp}
                  data-testid="bezier-handle-hit"
                  data-anchor-idx={i}
                  data-side="out"
                />
                <circle
                  cx={inX as number}
                  cy={inY as number}
                  r={HANDLE_HIT_RADIUS}
                  fill="transparent"
                  style={{ cursor: isEditingIn ? 'grabbing' : 'grab' }}
                  onPointerDown={(e) => onComponentPointerDown(e, { anchorIdx: i, kind: 'in' })}
                  onPointerMove={onComponentPointerMove}
                  onPointerUp={onComponentPointerUp}
                  onPointerCancel={onComponentPointerUp}
                  data-testid="bezier-handle-hit"
                  data-anchor-idx={i}
                  data-side="in"
                />
              </>
            )}
            {/* Anchor hit area — drag to reposition the anchor (X snaps to checkpoints). */}
            <circle
              cx={p.x}
              cy={p.y}
              r={ANCHOR_HIT_RADIUS}
              fill="transparent"
              style={{ cursor: isEditingAnchor ? 'grabbing' : 'grab' }}
              onPointerDown={(e) => onComponentPointerDown(e, { anchorIdx: i, kind: 'anchor' })}
              onPointerMove={onComponentPointerMove}
              onPointerUp={onComponentPointerUp}
              onPointerCancel={onComponentPointerUp}
              data-testid="bezier-anchor-hit"
              data-anchor-idx={i}
            />
            {/* Anchor dot (non-interactive). */}
            <circle cx={p.x} cy={p.y} r={4} fill={DRAW_IN_FLIGHT} pointerEvents="none" />
          </g>
        )
      })}

      {/* In-flight drag preview: provisional anchor + its handles. */}
      {drag !== null && (
        <g data-testid="bezier-drag-preview" pointerEvents="none">
          <line
            x1={drag.startChartX}
            y1={drag.startChartY}
            x2={drag.handleChartX}
            y2={drag.handleChartY}
            stroke={DRAW_IN_FLIGHT}
            strokeWidth={1}
            opacity={0.4}
          />
          <line
            x1={drag.startChartX}
            y1={drag.startChartY}
            x2={2 * drag.startChartX - drag.handleChartX}
            y2={2 * drag.startChartY - drag.handleChartY}
            stroke={DRAW_IN_FLIGHT}
            strokeWidth={1}
            opacity={0.4}
          />
          <circle
            cx={drag.handleChartX}
            cy={drag.handleChartY}
            r={3}
            fill="transparent"
            stroke={DRAW_IN_FLIGHT}
            strokeWidth={1}
          />
          <circle
            cx={2 * drag.startChartX - drag.handleChartX}
            cy={2 * drag.startChartY - drag.handleChartY}
            r={3}
            fill="transparent"
            stroke={DRAW_IN_FLIGHT}
            strokeWidth={1}
          />
          <circle cx={drag.startChartX} cy={drag.startChartY} r={4} fill={DRAW_IN_FLIGHT} />
        </g>
      )}

      {/* Floating commit ✓ above the rightmost anchor. */}
      {showCheck && (
        <g
          data-testid="bezier-commit"
          transform={`translate(${anchorPx[rightmostIdx].x}, ${anchorPx[rightmostIdx].y - 28})`}
          style={{ cursor: 'pointer' }}
          onClick={commit}
        >
          <circle r={11} fill={DRAW_COMMIT_FILL} stroke={DRAW_COMMIT_INK} strokeWidth={1.5} />
          <path
            d="M -4.5 0 L -1 3.5 L 5 -3"
            stroke={DRAW_COMMIT_INK}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </>
  )
}
