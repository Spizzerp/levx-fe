import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { BRACKET_CUBICS, X_CUBICS } from './geometry'
import { parseColor } from './parseColor'
import { StaticFallback } from './StaticFallback'
import { createRenderer, type RendererKind } from './renderers/createRenderer'
import type { Renderer, Uniforms } from './renderers/types'
import { useCanvasSize } from './useCanvasSize'

export interface BezierLogoProps {
  color?: string
  opacity?: number
  zoom?: number
  offset?: { x: number; y: number }
  renderer?: RendererKind
  onReady?: (info: { kind: 'webgpu' | 'webgl' }) => void
  onError?: (error: Error) => void
  pauseWhenOffscreen?: boolean
  /** Duration of the split-reveal animation, ms. Default 1400. */
  splitDurationMs?: number
  /** Skip the scroll-into-view trigger and animate immediately on mount. */
  autoPlay?: boolean
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}

/** Bracket offset at t=0 — places it over the X's left-arm region. Eases
 *  to (0, 0) at t=1. Easy to tweak in one place. */
const BRACKET_START: { x: number; y: number } = { x: 0.5, y: 0 }
/** X offset at t=0 — a small counter-shove so both shapes visibly move. */
const X_START: { x: number; y: number } = { x: -0.08, y: 0 }
/** Smooth-min rounding radius (UV units). Constant across the animation;
 *  it auto-disables once the shapes are well-separated. */
const SMIN_K = 0.08

interface Snapshot {
  zoom: number
  offsetX: number
  offsetY: number
  color: [number, number, number]
  opacity: number
  width: number
  height: number
  isVisible: boolean
}

/**
 * Renders the LevX logo as two signed-distance fields (bracket + X) baked
 * into r16float textures, smooth-unioned at runtime. On first scroll into
 * view, the bracket slides left and the X slides right from an initial
 * merged position, giving a "fluid splitting" intro.
 */
export function BezierLogo({
  color = '#ffffff',
  opacity = 1.0,
  zoom = 1.0,
  offset = { x: 0, y: 0 },
  renderer: rendererKind = 'auto',
  onReady,
  onError,
  pauseWhenOffscreen = true,
  splitDurationMs = 1400,
  autoPlay = false,
  className,
  style,
  ariaLabel = 'Logo',
}: BezierLogoProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const [fallbackToStatic, setFallbackToStatic] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  const size = useCanvasSize(containerRef)
  const colorRgb = useMemo(() => parseColor(color), [color])

  // Prop-derived uniforms snapshot, refreshed each render. The rAF loop
  // reads from this ref so frame tick doesn't rerender React.
  const snapshotRef = useRef<Snapshot>({
    zoom,
    offsetX: offset.x,
    offsetY: offset.y,
    color: colorRgb,
    opacity,
    width: size.width,
    height: size.height,
    isVisible,
  })
  snapshotRef.current = {
    zoom,
    offsetX: offset.x,
    offsetY: offset.y,
    color: colorRgb,
    opacity,
    width: size.width,
    height: size.height,
    isVisible,
  }

  // Animation state — progress eases 0 (merged) → 1 (split). Starts at 0
  // and waits for either the IntersectionObserver to fire or `autoPlay`
  // to kick the animation.
  const progressRef = useRef(0)
  const triggeredRef = useRef(false)
  const startTsRef = useRef(0)
  const rafRef = useRef(0)

  function computeUniforms(): Uniforms | null {
    const snap = snapshotRef.current
    if (snap.width === 0 || !snap.isVisible) return null
    const t = progressRef.current
    // Bracket / X positions are linear in `t` — the easing is already
    // baked into progressRef by the loop (see tick()).
    const bx = BRACKET_START.x * (1 - t)
    const by = BRACKET_START.y * (1 - t)
    const xx = X_START.x * (1 - t)
    const xy = X_START.y * (1 - t)
    return {
      width: snap.width,
      height: snap.height,
      zoom: snap.zoom,
      sminK: SMIN_K,
      offsetX: snap.offsetX,
      offsetY: snap.offsetY,
      bracketOffsetX: bx,
      bracketOffsetY: by,
      xOffsetX: xx,
      xOffsetY: xy,
      color: snap.color,
      opacity: snap.opacity,
    }
  }

  function renderOnce() {
    const r = rendererRef.current
    if (!r) return
    const u = computeUniforms()
    if (!u) return
    r.render(u)
  }

  function startAnimation() {
    if (triggeredRef.current) return
    triggeredRef.current = true
    if (rafRef.current) return
    progressRef.current = 0
    startTsRef.current = performance.now()
    const tick = (t: number) => {
      const raw = Math.min(1, (t - startTsRef.current) / splitDurationMs)
      // Ease-out cubic — fast start, soft settle. Feels like the pieces
      // are pulling themselves apart with a bit of inertia.
      const eased = 1 - Math.pow(1 - raw, 3)
      progressRef.current = eased
      renderOnce()
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        progressRef.current = 1
        renderOnce()
        rafRef.current = 0
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // Initialize the renderer once (or when kind prop changes).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let localRenderer: Renderer | null = null

    ;(async () => {
      try {
        const result = await createRenderer(rendererKind, {
          canvas,
          bracketSegments: BRACKET_CUBICS,
          xSegments: X_CUBICS,
        })
        if (cancelled) {
          result.renderer.dispose()
          return
        }
        localRenderer = result.renderer
        rendererRef.current = result.renderer
        if (result.fallbackFrom) {
          console.info(
            '[BezierLogo] WebGPU unavailable, using WebGL:',
            result.fallbackFrom.error.message,
          )
        }
        onReady?.({ kind: result.actualKind })
        // Render the initial frame (merged if we're waiting for scroll,
        // otherwise split).
        renderOnce()
      } catch (err) {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        console.warn('[BezierLogo] both renderers failed:', error.message)
        setFallbackToStatic(true)
        onError?.(error)
      }
    })()

    return () => {
      cancelled = true
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      localRenderer?.dispose()
      if (rendererRef.current === localRenderer) {
        rendererRef.current = null
      }
    }
    // onReady/onError intentionally omitted: callers shouldn't have to memoize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererKind])

  // Visibility observer — doubles as the scroll-trigger for the intro.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!triggeredRef.current) startAnimation()
            if (pauseWhenOffscreen) setIsVisible(true)
          } else if (pauseWhenOffscreen) {
            setIsVisible(false)
          }
        }
      },
      { rootMargin: '0px', threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseWhenOffscreen])

  // autoPlay bypass — start the animation as soon as the renderer is
  // ready, without waiting for scroll.
  useEffect(() => {
    if (!autoPlay) return
    const id = setTimeout(() => {
      if (rendererRef.current && !triggeredRef.current) startAnimation()
    }, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay])

  // Sync canvas drawing buffer size to measured CSS size × DPR.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0) return
    if (canvas.width !== size.width) canvas.width = size.width
    if (canvas.height !== size.height) canvas.height = size.height
    renderOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height])

  // Re-render when prop-derived uniform values change.
  useEffect(() => {
    renderOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, zoom, offset.x, offset.y, opacity, colorRgb])

  const combinedStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    ...style,
  }

  if (fallbackToStatic) {
    return (
      <div ref={containerRef} className={className} style={combinedStyle} aria-label={ariaLabel}>
        <StaticFallback color={color} opacity={opacity} />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={combinedStyle}
      role="img"
      aria-label={ariaLabel}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  )
}
