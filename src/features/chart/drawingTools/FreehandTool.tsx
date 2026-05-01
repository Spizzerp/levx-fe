import { useCallback, useEffect, useRef } from 'react'

import { crossingDetector } from '@/lib/drawing/crossingDetector'
import type { CheckpointCrossing } from '@/lib/drawing/types'
import { useDrawingStore } from '@/stores/drawingStore'

// Minimal scale interface — avoids d3-scale type gymnastics.
// Visx ScaleTime returns Date[] from domain() and ScaleLinear returns number[].
// Using readonly number[] here lets both satisfy the interface without assertion errors.
interface MinimalScale {
  (v: number | Date): number
  invert(pixel: number): number | Date
  domain(): readonly (number | Date)[]
  range(): readonly number[]
}

export interface FreehandToolProps {
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

/**
 * FreehandTool — sweep authoring.
 *
 * Pointer drag across the future-time region; each checkpoint column the
 * cursor crosses gets its y captured (linear interpolation between the
 * previous and current pointer positions).
 *
 * Dual SVG mutation:
 * - Raw in-flight stroke path: mutated via setAttribute('d', …) at pointermove
 *   rate. No React state, no Zustand commits for the raw path itself.
 * - Checkpoint values: committed to drawingStore only when a crossing fires
 *   (sparse — 1–3 per move at normal speed).
 */
export function FreehandTool({
  xScale,
  yScale,
  innerWidth,
  innerHeight,
  margin,
  checkpointXs,
  marketStart,
  onStrokeStart,
  onStrokeEnd,
}: FreehandToolProps) {
  const rawStrokeRef = useRef<SVGPathElement>(null)

  // scalesRef — always holds the latest scales. Avoids stale-closure bugs when
  // scales change (window resize / Y-axis freeze) without recreating handlers.
  const scalesRef = useRef({ xScale, yScale })
  useEffect(() => {
    scalesRef.current = { xScale, yScale }
  })

  const rawPathDRef = useRef<string>('')
  const prevDomainXRef = useRef<number | null>(null)
  const prevDomainYRef = useRef<number | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      // Middle / right button → let the viewport pan handler take over.
      if (e.button === 1 || e.button === 2) return

      const svg = (e.currentTarget as SVGElement).ownerSVGElement
      if (!svg) return
      const svgRect = svg.getBoundingClientRect()
      const chartX = e.clientX - svgRect.left - margin.left
      const chartY = e.clientY - svgRect.top - margin.top

      const { xScale: xs, yScale: ys } = scalesRef.current
      const domainX = Number(xs.invert(chartX))
      const domainY = Number(ys.invert(chartY))

      // History-region guard: ignore pointerdown before marketStart.
      if (domainX < marketStart) return

      e.currentTarget.setPointerCapture(e.pointerId)

      rawPathDRef.current = `M ${chartX} ${chartY}`
      rawStrokeRef.current?.setAttribute('d', rawPathDRef.current)

      prevDomainXRef.current = domainX
      prevDomainYRef.current = domainY

      useDrawingStore.getState().beginStroke()
      onStrokeStart?.()
    },
    [marketStart, margin.left, margin.top, onStrokeStart],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      const storeState = useDrawingStore.getState().state
      if (storeState.phase !== 'sweeping') return

      // Safety: pointer was released without pointerUp firing (focus loss etc.).
      if (e.buttons === 0) {
        useDrawingStore.getState().endStroke()
        prevDomainXRef.current = null
        prevDomainYRef.current = null
        onStrokeEnd?.()
        return
      }

      const svg = (e.currentTarget as SVGElement).ownerSVGElement
      if (!svg) return
      const svgRect = svg.getBoundingClientRect()
      const chartX = e.clientX - svgRect.left - margin.left
      const chartY = e.clientY - svgRect.top - margin.top

      const { xScale: xs, yScale: ys } = scalesRef.current
      const domainX = Number(xs.invert(chartX))
      const domainY = Number(ys.invert(chartY))

      rawPathDRef.current += ` L ${chartX} ${chartY}`
      rawStrokeRef.current?.setAttribute('d', rawPathDRef.current)

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
    [checkpointXs, margin.left, margin.top, onStrokeEnd],
  )

  const endStroke = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Already released or never captured — safe to ignore.
      }

      useDrawingStore.getState().endStroke()

      prevDomainXRef.current = null
      prevDomainYRef.current = null

      onStrokeEnd?.()

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
    [onStrokeEnd],
  )

  const onLostCapture = useCallback(() => {
    const storeState = useDrawingStore.getState().state
    if (storeState.phase === 'sweeping') {
      useDrawingStore.getState().endStroke()
      prevDomainXRef.current = null
      prevDomainYRef.current = null
      onStrokeEnd?.()
    }
  }, [onStrokeEnd])

  const futureStartX = Math.max(0, Number(xScale(marketStart)))
  const futureWidth = Math.max(0, innerWidth - futureStartX)

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
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onLostPointerCapture={onLostCapture}
        data-testid="drawing-overlay"
      />
      <path
        ref={rawStrokeRef}
        stroke="#5B9BF6"
        strokeWidth={1.5}
        fill="none"
        opacity={0.6}
        data-testid="raw-stroke"
      />
    </>
  )
}
