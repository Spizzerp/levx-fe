import { useCallback, useEffect, useRef, useState } from 'react'

/* ── Types ──────────────────────────────────────────────────────── */

export interface UseChartViewportOptions {
  /** Auto-computed "default" time domain (all data visible). */
  defaultTimeDomain: [number, number]
  /** Inner chart width in pixels (for domain↔pixel math). */
  innerWidth: number
  /** When true, all pan/zoom interaction is suppressed (e.g. during an active drawing stroke). */
  disabled: boolean
  /** Left margin in pixels (for clientX → chart-X conversion). */
  marginLeft: number
  /** Minimum visible time span in ms (zoom-in limit). Default 2 min. */
  minSpanMs?: number
  /** Maximum visible time span in ms (zoom-out limit). */
  maxSpanMs?: number
}

export interface UseChartViewportReturn {
  /** The effective time domain to pass to scaleTime. */
  effectiveTimeDomain: [number, number]
  /** True when viewport tracks live data (no user pan/zoom). */
  isFollowing: boolean
  /** Ref callback — attach to <svg> for wheel listener. */
  svgRef: React.RefCallback<SVGSVGElement>
  /** Pointer handlers for the hit-area <Bar>. */
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent<SVGRectElement>) => void
    onPointerMove: (e: React.PointerEvent<SVGRectElement>) => void
    onPointerUp: (e: React.PointerEvent<SVGRectElement>) => void
    onPointerCancel: (e: React.PointerEvent<SVGRectElement>) => void
  }
  /** True while pointer is actively dragging a pan. */
  isPanning: boolean
  /** Reset viewport to auto-fit default. */
  resetViewport: () => void
}

/* ── Constants ──────────────────────────────────────────────────── */

const PAN_THRESHOLD_PX = 3
const DEFAULT_MIN_SPAN_MS = 2 * 60 * 1000 // 2 minutes
const ZOOM_SENSITIVITY = 0.001

/* ── Hook ───────────────────────────────────────────────────────── */

export function useChartViewport({
  defaultTimeDomain,
  innerWidth,
  disabled,
  marginLeft,
  minSpanMs = DEFAULT_MIN_SPAN_MS,
  maxSpanMs,
}: UseChartViewportOptions): UseChartViewportReturn {
  // --- Viewport domain state (null = following default) ---
  const [viewDomain, setViewDomain] = useState<[number, number] | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [isFollowing, setIsFollowing] = useState(true)

  const viewDomainRef = useRef<[number, number] | null>(null)
  const defaultDomainRef = useRef(defaultTimeDomain)
  const innerWidthRef = useRef(innerWidth)
  const rafIdRef = useRef(0)

  // Keep refs in sync with latest values.
  useEffect(() => { defaultDomainRef.current = defaultTimeDomain })
  useEffect(() => { innerWidthRef.current = innerWidth })

  // Keep a ref for isFollowing so event handlers can read the latest value.
  const isFollowingRef = useRef(true)
  useEffect(() => { isFollowingRef.current = isFollowing }, [isFollowing])

  // --- Pan tracking refs ---
  const panRef = useRef<{
    startClientX: number
    startDomain: [number, number]
    thresholdMet: boolean
  } | null>(null)

  // --- Pinch tracking refs ---
  const pinchRef = useRef<{
    pointers: Map<number, number> // pointerId → clientX
    initialSpan: number
    initialDomain: [number, number]
    initialMidClientX: number
  } | null>(null)

  // --- Aux (middle/right button) pan ref — persists across effect re-runs ---
  const auxPanRef = useRef<{
    button: number
    buttonMask: number
    startClientX: number
    startDomain: [number, number]
  } | null>(null)

  // --- Commit domain helper (RAF-coalesced) ---
  const commitDomain = useCallback((domain: [number, number]) => {
    viewDomainRef.current = domain
    isFollowingRef.current = false
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = requestAnimationFrame(() => {
      setViewDomain(viewDomainRef.current)
      setIsFollowing(false)
      rafIdRef.current = 0
    })
  }, [])

  // --- Clamp span helper ---
  const clampSpan = useCallback(
    (domain: [number, number]): [number, number] => {
      const span = domain[1] - domain[0]
      const effectiveMax = maxSpanMs ?? Infinity
      if (span < minSpanMs) {
        const mid = (domain[0] + domain[1]) / 2
        return [mid - minSpanMs / 2, mid + minSpanMs / 2]
      }
      if (span > effectiveMax) {
        const mid = (domain[0] + domain[1]) / 2
        return [mid - effectiveMax / 2, mid + effectiveMax / 2]
      }
      return domain
    },
    [minSpanMs, maxSpanMs],
  )

  // --- Pointer handlers ---

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (disabled) return
      // Middle / right button are handled by native aux listeners on the SVG.
      if (e.button !== 0) return

      const existingPointers = pinchRef.current?.pointers
      const pointerCount = existingPointers ? existingPointers.size : 0

      // Second finger → start pinch
      if (pointerCount === 1 && existingPointers) {
        existingPointers.set(e.pointerId, e.clientX)
        const xs = [...existingPointers.values()]
        const span = Math.abs(xs[1] - xs[0])
        const mid = (xs[0] + xs[1]) / 2
        pinchRef.current = {
          pointers: existingPointers,
          initialSpan: span || 1,
          initialDomain: viewDomainRef.current ?? defaultDomainRef.current,
          initialMidClientX: mid,
        }
        panRef.current = null
        setIsPanning(true)
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }

      // First finger / mouse — reset any stale gesture state
      panRef.current = null
      setIsPanning(false)
      const currentDomain = viewDomainRef.current ?? defaultDomainRef.current
      panRef.current = {
        startClientX: e.clientX,
        startDomain: currentDomain,
        thresholdMet: false,
      }
      pinchRef.current = {
        pointers: new Map([[e.pointerId, e.clientX]]),
        initialSpan: 0,
        initialDomain: currentDomain,
        initialMidClientX: e.clientX,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [disabled],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (disabled) return

      // Update pinch pointer position
      if (pinchRef.current?.pointers.has(e.pointerId)) {
        pinchRef.current.pointers.set(e.pointerId, e.clientX)
      }

      // Two-finger pinch zoom
      if (pinchRef.current && pinchRef.current.pointers.size === 2) {
        const xs = [...pinchRef.current.pointers.values()]
        const currentSpan = Math.abs(xs[1] - xs[0]) || 1
        const zoomFactor = pinchRef.current.initialSpan / currentSpan
        const { initialDomain, initialMidClientX } = pinchRef.current

        const iw = innerWidthRef.current
        if (iw <= 0) return

        const domainSpan = initialDomain[1] - initialDomain[0]
        const newSpan = domainSpan * zoomFactor

        // Anchor at the midpoint of the initial pinch
        const midFraction = Math.max(0, Math.min(1, (initialMidClientX - marginLeft) / iw))
        const midTime = initialDomain[0] + midFraction * domainSpan
        const newDomain: [number, number] = [
          midTime - midFraction * newSpan,
          midTime + (1 - midFraction) * newSpan,
        ]

        commitDomain(clampSpan(newDomain))
        setIsPanning(true)
        return
      }

      // Single-pointer pan
      const pan = panRef.current
      if (!pan || e.buttons === 0) return

      const deltaX = e.clientX - pan.startClientX

      if (!pan.thresholdMet) {
        if (Math.abs(deltaX) < PAN_THRESHOLD_PX) return
        pan.thresholdMet = true
        setIsPanning(true)
      }

      const iw = innerWidthRef.current
      if (iw <= 0) return

      const domainSpan = pan.startDomain[1] - pan.startDomain[0]
      const deltaTime = (deltaX / iw) * domainSpan

      // Drag right → see older data → shift domain left (subtract)
      const newDomain: [number, number] = [
        pan.startDomain[0] - deltaTime,
        pan.startDomain[1] - deltaTime,
      ]
      commitDomain(newDomain)
    },
    [disabled, marginLeft, commitDomain, clampSpan],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      if (disabled) return
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ok */ }

      // Remove from pinch tracking
      if (pinchRef.current?.pointers.has(e.pointerId)) {
        pinchRef.current.pointers.delete(e.pointerId)
        // If one finger remains, restart pan from current state
        if (pinchRef.current.pointers.size === 1) {
          const remainingX = [...pinchRef.current.pointers.values()][0]
          panRef.current = {
            startClientX: remainingX,
            startDomain: viewDomainRef.current ?? defaultDomainRef.current,
            thresholdMet: true, // already in gesture
          }
          return
        }
      }

      panRef.current = null
      pinchRef.current = null
      setIsPanning(false)
    },
    [disabled],
  )

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      onPointerUp(e)
    },
    [onPointerUp],
  )

  // --- Wheel zoom (native listener for passive:false) ---
  // Use a state to track the SVG element so the effect re-runs on mount.
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null)

  const svgRef = useCallback((el: SVGSVGElement | null) => {
    setSvgEl(el)
  }, [])

  // Read disabled and marginLeft from refs inside the wheel handler so the
  // effect only re-runs when the SVG element changes — avoids detach/reattach
  // on every draw-mode toggle or margin change.
  const disabledRef = useRef(disabled)
  useEffect(() => { disabledRef.current = disabled }, [disabled])
  const marginLeftRef = useRef(marginLeft)
  useEffect(() => { marginLeftRef.current = marginLeft }, [marginLeft])

  useEffect(() => {
    if (!svgEl) return

    const handleWheel = (e: WheelEvent) => {
      if (disabledRef.current) return
      e.preventDefault()

      const iw = innerWidthRef.current
      if (iw <= 0) return

      const rect = svgEl.getBoundingClientRect()
      const chartX = e.clientX - rect.left - marginLeftRef.current
      const fraction = Math.max(0, Math.min(1, chartX / iw))

      const currentDomain = viewDomainRef.current ?? defaultDomainRef.current
      const span = currentDomain[1] - currentDomain[0]

      // Positive deltaY = scroll down = zoom out (wider span)
      const factor = 1 + e.deltaY * ZOOM_SENSITIVITY
      const newSpan = span * factor

      // Anchor: the time at cursor stays at the same pixel fraction
      const cursorTime = currentDomain[0] + fraction * span
      const newDomain: [number, number] = [
        cursorTime - fraction * newSpan,
        cursorTime + (1 - fraction) * newSpan,
      ]

      commitDomain(clampSpan(newDomain))
    }

    // --- Middle / right-button pan ---
    // pointerdown in capture phase on SVG so it fires before React handlers.
    // pointermove/pointerup on document so they work even if pointer leaves SVG.
    // State lives in auxPanRef (not a local var) so it survives effect re-runs.

    const handleContextMenu = (e: Event) => { e.preventDefault() }

    const handleAuxDown = (e: PointerEvent) => {
      if (e.button !== 1 && e.button !== 2) return
      e.preventDefault()
      auxPanRef.current = {
        button: e.button,
        buttonMask: e.button === 2 ? 2 : 4, // right→2, middle→4
        startClientX: e.clientX,
        startDomain: viewDomainRef.current ?? defaultDomainRef.current,
      }
      setIsPanning(true)
    }

    const handleAuxMove = (e: PointerEvent) => {
      const aux = auxPanRef.current
      if (!aux) return
      // Safety: if the button that started the pan is no longer held, end it.
      if (!(e.buttons & aux.buttonMask)) {
        auxPanRef.current = null
        setIsPanning(false)
        return
      }
      const iw = innerWidthRef.current
      if (iw <= 0) return
      const deltaX = e.clientX - aux.startClientX
      const domainSpan = aux.startDomain[1] - aux.startDomain[0]
      const deltaTime = (deltaX / iw) * domainSpan
      commitDomain([
        aux.startDomain[0] - deltaTime,
        aux.startDomain[1] - deltaTime,
      ])
    }

    const handleAuxUp = (e: PointerEvent) => {
      const aux = auxPanRef.current
      if (!aux) return
      // Only end when the specific button that started this pan is released.
      if (e.button !== aux.button) return
      auxPanRef.current = null
      setIsPanning(false)
    }

    svgEl.addEventListener('wheel', handleWheel, { passive: false })
    svgEl.addEventListener('contextmenu', handleContextMenu)
    svgEl.addEventListener('pointerdown', handleAuxDown, true)
    document.addEventListener('pointermove', handleAuxMove)
    document.addEventListener('pointerup', handleAuxUp)
    document.addEventListener('pointercancel', handleAuxUp)
    return () => {
      svgEl.removeEventListener('wheel', handleWheel)
      svgEl.removeEventListener('contextmenu', handleContextMenu)
      svgEl.removeEventListener('pointerdown', handleAuxDown, true)
      document.removeEventListener('pointermove', handleAuxMove)
      document.removeEventListener('pointerup', handleAuxUp)
      document.removeEventListener('pointercancel', handleAuxUp)
    }
  }, [svgEl, commitDomain, clampSpan])

  // --- Double-click reset ---
  const resetViewport = useCallback(() => {
    viewDomainRef.current = null
    isFollowingRef.current = true
    setViewDomain(null)
    setIsFollowing(true)
    setIsPanning(false)
    panRef.current = null
    pinchRef.current = null
  }, [])

  // --- Cleanup RAF on unmount ---
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  // --- Effective domain ---
  const effectiveTimeDomain = viewDomain ?? defaultTimeDomain

  return {
    effectiveTimeDomain,
    isFollowing,
    svgRef,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    isPanning,
    resetViewport,
  }
}
