import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Y-axis viewport — vertical scale interaction mirroring the X-axis pan/zoom.
 *
 * UX model (matches TradingView / lightweight-charts):
 *  - Drag UP on the y-axis label area → zoom IN (compress price range)
 *  - Drag DOWN → zoom OUT (expand price range)
 *  - Double-click → reset to auto-fit (override cleared)
 *  - Cursor: ns-resize while hovering the axis area
 *
 * The scale anchors around the midpoint of the domain that was active when the
 * drag began, so scrubbing doesn't shift the view — only compresses/expands it.
 *
 * Returns an `effectiveDomain`: the user override when set, else the base domain
 * the caller passes in (auto-fit envelope). Callers should prefer this over the
 * base domain everywhere the price scale is consumed.
 */

const SCALE_SENSITIVITY = 0.005
const DRAG_THRESHOLD_PX = 2

export interface UseYAxisViewportOptions {
  /** Auto-fit price domain, computed from visible data. */
  basePriceDomain: [number, number]
}

export interface UseYAxisViewportReturn {
  /** Override > base. Feed this to scaleLinear. */
  effectiveDomain: [number, number]
  /** True if the user has actively scaled (override is set). */
  isScaled: boolean
  /** True while the pointer is actively dragging. */
  isScaling: boolean
  /** Clear the override and return to auto-fit. */
  resetYAxis: () => void
  /** Pointer handlers to attach to the axis-label <rect>. */
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent<SVGRectElement>) => void
    onPointerMove: (e: React.PointerEvent<SVGRectElement>) => void
    onPointerUp: (e: React.PointerEvent<SVGRectElement>) => void
    onPointerCancel: (e: React.PointerEvent<SVGRectElement>) => void
  }
}

export function useYAxisViewport({
  basePriceDomain,
}: UseYAxisViewportOptions): UseYAxisViewportReturn {
  const [override, setOverride] = useState<[number, number] | null>(null)
  const [isScaling, setIsScaling] = useState(false)

  // Refs for latest values inside pointer handlers without re-creating callbacks
  const overrideRef = useRef<[number, number] | null>(null)
  const baseRef = useRef(basePriceDomain)
  useEffect(() => {
    baseRef.current = basePriceDomain
  }, [basePriceDomain])

  const rafIdRef = useRef(0)

  // Drag tracking
  const dragRef = useRef<{
    startClientY: number
    startDomain: [number, number]
    thresholdMet: boolean
  } | null>(null)

  const commitDomain = useCallback((domain: [number, number]) => {
    overrideRef.current = domain
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = requestAnimationFrame(() => {
      setOverride(overrideRef.current)
      rafIdRef.current = 0
    })
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const currentDomain = overrideRef.current ?? baseRef.current
    dragRef.current = {
      startClientY: e.clientY,
      startDomain: currentDomain,
      thresholdMet: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      const drag = dragRef.current
      if (!drag || e.buttons === 0) return
      e.stopPropagation()

      const deltaY = e.clientY - drag.startClientY

      if (!drag.thresholdMet) {
        if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return
        drag.thresholdMet = true
        setIsScaling(true)
      }

      // Drag up (deltaY < 0) → factor < 1 → compress (zoom in)
      // Drag down (deltaY > 0) → factor > 1 → expand (zoom out)
      const factor = Math.exp(deltaY * SCALE_SENSITIVITY)
      const [lo, hi] = drag.startDomain
      const mid = (lo + hi) / 2
      const halfSpan = ((hi - lo) / 2) * factor

      // Guard against degenerate spans
      if (!Number.isFinite(halfSpan) || halfSpan <= 0) return

      commitDomain([mid - halfSpan, mid + halfSpan])
    },
    [commitDomain],
  )

  const onPointerUp = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ok */
    }
    dragRef.current = null
    setIsScaling(false)
  }, [])

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => onPointerUp(e),
    [onPointerUp],
  )

  const resetYAxis = useCallback(() => {
    overrideRef.current = null
    setOverride(null)
    setIsScaling(false)
    dragRef.current = null
  }, [])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  const effectiveDomain = override ?? basePriceDomain

  return {
    effectiveDomain,
    isScaled: override !== null,
    isScaling,
    resetYAxis,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
