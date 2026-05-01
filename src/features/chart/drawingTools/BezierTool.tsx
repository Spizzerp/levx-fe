import { useCallback, useEffect, useRef, useState } from 'react'

import { sampleBezierAtCheckpoints, type BezierAnchor } from '@/lib/drawing/bezierSampling'
import { useDrawingStore } from '@/stores/drawingStore'

interface MinimalScale {
  (v: number | Date): number
  invert(pixel: number): number | Date
  domain(): readonly (number | Date)[]
  range(): readonly number[]
}

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

/** Pixel distance below which a click-drag is treated as a plain click (no handle). */
const HANDLE_THRESHOLD_PX = 4

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
  const [anchors, setAnchors] = useState<BezierAnchor[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)

  // Refs for keyboard handler to read fresh values without re-binding on every state change.
  const anchorsRef = useRef(anchors)
  useEffect(() => {
    anchorsRef.current = anchors
  }, [anchors])

  const scalesRef = useRef({ xScale, yScale })
  useEffect(() => {
    scalesRef.current = { xScale, yScale }
  })

  // ----------------------------------------------------------------
  // Commit / cancel
  // ----------------------------------------------------------------

  const commit = useCallback(() => {
    const a = anchorsRef.current
    if (a.length < 2) return

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

    setAnchors([])
    setDrag(null)
  }, [checkpointXs, onStrokeStart, onStrokeEnd])

  const cancel = useCallback(() => {
    setAnchors([])
    setDrag(null)
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

      if (e.key === 'Escape') {
        if (anchorsRef.current.length === 0) return
        e.preventDefault()
        cancel()
      } else if (e.key === 'Enter') {
        if (anchorsRef.current.length < 2) return
        e.preventDefault()
        commit()
      } else if (e.key === 'Backspace') {
        if (anchorsRef.current.length === 0) return
        e.preventDefault()
        setAnchors((prev) => prev.slice(0, -1))
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

      const svg = (e.currentTarget as SVGElement).ownerSVGElement
      if (!svg) return
      const svgRect = svg.getBoundingClientRect()
      const chartX = e.clientX - svgRect.left - margin.left
      const chartY = e.clientY - svgRect.top - margin.top

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

      const svg = (e.currentTarget as SVGElement).ownerSVGElement
      if (!svg) return
      const svgRect = svg.getBoundingClientRect()
      const chartX = e.clientX - svgRect.left - margin.left
      const chartY = e.clientY - svgRect.top - margin.top

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
      const isCorner = dragPx < HANDLE_THRESHOLD_PX

      const newAnchor: BezierAnchor = {
        domainX: d.startDomainX,
        domainY: d.startDomainY,
        outHandle: isCorner
          ? null
          : { domainX: d.handleDomainX, domainY: d.handleDomainY },
      }

      setAnchors((prev) => [...prev, newAnchor])
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
  // Render — derive chart-coords from domain anchors via current scales.
  // ----------------------------------------------------------------

  const futureStartX = Math.max(0, Number(xScale(marketStart)))
  const futureWidth = Math.max(0, innerWidth - futureStartX)

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
      <rect
        x={futureStartX}
        y={0}
        width={futureWidth}
        height={innerHeight}
        fill="transparent"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        data-testid="drawing-overlay"
        data-tool="bezier"
      />

      {/* Cubic path through committed anchors + (optionally) the in-flight one. */}
      {(anchors.length >= 1 || drag !== null) && (
        <path
          d={previewPathD()}
          stroke="#5B9BF6"
          strokeWidth={2}
          fill="none"
          opacity={0.85}
          data-testid="bezier-path"
        />
      )}

      {/* Anchor dots + handle indicators for committed anchors. */}
      {anchorPx.map((p, i) => (
        <g key={i} data-testid="bezier-anchor">
          {p.out && (
            <>
              <line
                x1={p.x}
                y1={p.y}
                x2={p.out.x}
                y2={p.out.y}
                stroke="#5B9BF6"
                strokeWidth={1}
                opacity={0.4}
              />
              <line
                x1={p.x}
                y1={p.y}
                x2={2 * p.x - p.out.x}
                y2={2 * p.y - p.out.y}
                stroke="#5B9BF6"
                strokeWidth={1}
                opacity={0.4}
              />
              <circle
                cx={p.out.x}
                cy={p.out.y}
                r={3}
                fill="transparent"
                stroke="#5B9BF6"
                strokeWidth={1}
              />
              <circle
                cx={2 * p.x - p.out.x}
                cy={2 * p.y - p.out.y}
                r={3}
                fill="transparent"
                stroke="#5B9BF6"
                strokeWidth={1}
              />
            </>
          )}
          <circle cx={p.x} cy={p.y} r={4} fill="#5B9BF6" />
        </g>
      ))}

      {/* In-flight drag preview: provisional anchor + its handles. */}
      {drag !== null && (
        <g data-testid="bezier-drag-preview">
          <line
            x1={drag.startChartX}
            y1={drag.startChartY}
            x2={drag.handleChartX}
            y2={drag.handleChartY}
            stroke="#5B9BF6"
            strokeWidth={1}
            opacity={0.4}
          />
          <line
            x1={drag.startChartX}
            y1={drag.startChartY}
            x2={2 * drag.startChartX - drag.handleChartX}
            y2={2 * drag.startChartY - drag.handleChartY}
            stroke="#5B9BF6"
            strokeWidth={1}
            opacity={0.4}
          />
          <circle
            cx={drag.handleChartX}
            cy={drag.handleChartY}
            r={3}
            fill="transparent"
            stroke="#5B9BF6"
            strokeWidth={1}
          />
          <circle
            cx={2 * drag.startChartX - drag.handleChartX}
            cy={2 * drag.startChartY - drag.handleChartY}
            r={3}
            fill="transparent"
            stroke="#5B9BF6"
            strokeWidth={1}
          />
          <circle cx={drag.startChartX} cy={drag.startChartY} r={4} fill="#5B9BF6" />
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
          <circle r={11} fill="#5CF78B" stroke="#1a1a1a" strokeWidth={1.5} />
          <path
            d="M -4.5 0 L -1 3.5 L 5 -3"
            stroke="#1a1a1a"
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
