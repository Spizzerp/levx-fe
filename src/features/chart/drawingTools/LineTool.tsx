import { useCallback, useEffect, useRef } from 'react'

import { clientToChart } from '@/lib/drawing/pointer'
import type { CheckpointCrossing, MinimalScale } from '@/lib/drawing/types'
import { useDrawingStore } from '@/stores/drawingStore'

export interface LineToolProps {
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

interface AnchorPoint {
  chartX: number
  chartY: number
  domainX: number
  domainY: number
}

/**
 * LineTool — single straight segment.
 *
 * pointerdown places the start anchor and begins a stroke. pointermove updates
 * a preview `<line>` via setAttribute (no React state). pointerup samples the
 * line at every checkpoint x in [start.x, end.x] and commits all crossings as
 * a single batch, then ends the stroke.
 */
export function LineTool({
  xScale,
  yScale,
  innerWidth,
  innerHeight,
  margin,
  checkpointXs,
  marketStart,
  onStrokeStart,
  onStrokeEnd,
}: LineToolProps) {
  const previewRef = useRef<SVGLineElement>(null)
  const startRef = useRef<AnchorPoint | null>(null)

  const scalesRef = useRef({ xScale, yScale })
  useEffect(() => {
    scalesRef.current = { xScale, yScale }
  })

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

      startRef.current = { chartX, chartY, domainX, domainY }

      const preview = previewRef.current
      if (preview) {
        preview.setAttribute('x1', String(chartX))
        preview.setAttribute('y1', String(chartY))
        preview.setAttribute('x2', String(chartX))
        preview.setAttribute('y2', String(chartY))
        preview.style.opacity = '0.6'
      }

      useDrawingStore.getState().beginStroke()
      onStrokeStart?.()
    },
    [marketStart, margin.left, margin.top, onStrokeStart],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      const storeState = useDrawingStore.getState().state
      if (storeState.phase !== 'sweeping') return
      if (!startRef.current) return

      if (e.buttons === 0) {
        // Pointer was released without firing pointerUp.
        useDrawingStore.getState().endStroke()
        startRef.current = null
        onStrokeEnd?.()
        return
      }

      const pos = clientToChart(e, margin)
      if (!pos) return
      const { chartX, chartY } = pos

      const preview = previewRef.current
      if (preview) {
        preview.setAttribute('x2', String(chartX))
        preview.setAttribute('y2', String(chartY))
      }
    },
    [margin.left, margin.top, onStrokeEnd],
  )

  const endStroke = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Already released — safe to ignore.
      }

      const start = startRef.current
      if (!start) {
        useDrawingStore.getState().endStroke()
        onStrokeEnd?.()
        return
      }

      const { xScale: xs, yScale: ys } = scalesRef.current

      let endDomainX = start.domainX
      let endDomainY = start.domainY
      const pos = clientToChart(e, margin)
      if (pos) {
        endDomainX = Number(xs.invert(pos.chartX))
        endDomainY = Number(ys.invert(pos.chartY))
      }

      // Sample every checkpoint x within the segment's x-range.
      const minX = Math.min(start.domainX, endDomainX)
      const maxX = Math.max(start.domainX, endDomainX)
      const dx = endDomainX - start.domainX
      const dom = ys.domain()
      const yMin = Number(dom[0])
      const yMax = Number(dom[1])

      const crossings: CheckpointCrossing[] = []
      for (let i = 0; i < checkpointXs.length; i++) {
        const xi = checkpointXs[i]
        if (xi < minX || xi > maxX) continue
        const t = dx === 0 ? 0 : (xi - start.domainX) / dx
        const yi = start.domainY + t * (endDomainY - start.domainY)
        const yClamped = Math.max(yMin, Math.min(yMax, yi))
        crossings.push({ index: i, y: yClamped })
      }

      if (crossings.length > 0) {
        useDrawingStore.getState().setCheckpointValues(crossings)
      }
      useDrawingStore.getState().endStroke()
      onStrokeEnd?.()

      const preview = previewRef.current
      if (preview) {
        preview.style.transition = 'opacity 400ms ease-out'
        preview.style.opacity = '0'
        setTimeout(() => {
          preview.removeAttribute('x1')
          preview.removeAttribute('y1')
          preview.removeAttribute('x2')
          preview.removeAttribute('y2')
          preview.style.transition = ''
        }, 420)
      }

      startRef.current = null
    },
    [checkpointXs, margin.left, margin.top, onStrokeEnd],
  )

  const onLostCapture = useCallback(() => {
    const storeState = useDrawingStore.getState().state
    if (storeState.phase === 'sweeping') {
      useDrawingStore.getState().endStroke()
      startRef.current = null
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
        data-tool="line"
      />
      <line
        ref={previewRef}
        stroke="#5B9BF6"
        strokeWidth={1.5}
        opacity={0}
        data-testid="line-preview"
      />
    </>
  )
}
