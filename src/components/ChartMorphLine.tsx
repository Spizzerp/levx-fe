import { useEffect, useRef } from 'react'

/* ── Config ──────────────────────────────────────────────────── */

const NUM_POINTS = 512
const AMPLITUDE_RATIO = 0.07
const SCROLL_SPEED = 0.0008
const BREATH_PERIOD = 3200
const OPACITY_MIN = 0.12
const OPACITY_MAX = 0.32
const MORPH_MS = 800
/** After the morph finishes, the low-res line fades out over this duration */
const FADE_MS = 350

/* ── Pure helpers ────────────────────────────────────────────── */

function waveY(x: number, t: number, amplitude: number): number {
  return (
    Math.sin(x * 0.012 + t) * amplitude * 0.6 +
    Math.sin(x * 0.007 - t * 0.7) * amplitude * 0.3 +
    Math.sin(x * 0.019 + t * 1.3) * amplitude * 0.15
  )
}

function breath(t: number): number {
  const k = (Math.sin((t / BREATH_PERIOD) * Math.PI * 2) + 1) / 2
  return OPACITY_MIN + k * (OPACITY_MAX - OPACITY_MIN)
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** Linearly interpolate a Y value from sorted {x,y} pairs */
function interpolateY(pts: { x: number; y: number }[], x: number): number | null {
  if (pts.length === 0) return null
  if (x <= pts[0].x) return pts[0].y
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i].x) {
      const a = pts[i - 1]
      const b = pts[i]
      const r = (x - a.x) / (b.x - a.x)
      return a.y + r * (b.y - a.y)
    }
  }
  return pts[pts.length - 1].y
}

function toPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
}

/* ── Component ───────────────────────────────────────────────── */

export interface ChartMorphLineProps {
  innerWidth: number
  innerHeight: number
  isLoading: boolean
  /** Historical data mapped to pixel coordinates (sorted by x) */
  dataPoints: readonly { x: number; y: number }[]
  /**
   * Called when the real chart should start becoming visible.
   * Fires at ~75% of the morph (the shapes are close enough to crossfade).
   */
  onRevealChart: () => void
}

/**
 * SVG `<path>` that renders a breathing wave during loading,
 * then morphs smoothly into the real price line when data arrives.
 * After morphing, it fades out while the real chart fades in underneath.
 */
export function ChartMorphLine({
  innerWidth,
  innerHeight,
  isLoading,
  dataPoints,
  onRevealChart,
}: ChartMorphLineProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const rafRef = useRef(0)

  const dataRef = useRef(dataPoints)
  dataRef.current = dataPoints
  const onRevealRef = useRef(onRevealChart)
  onRevealRef.current = onRevealChart

  const phaseRef = useRef<'loading' | 'morphing' | 'fading' | 'done'>(
    isLoading ? 'loading' : 'done',
  )
  const morphStartRef = useRef(0)
  const fadeStartRef = useRef(0)
  const frozenWaveTimeRef = useRef(0)
  const revealFiredRef = useRef(!isLoading)

  useEffect(() => {
    if (isLoading) {
      phaseRef.current = 'loading'
      morphStartRef.current = 0
      fadeStartRef.current = 0
      revealFiredRef.current = false
    } else if (phaseRef.current === 'loading') {
      phaseRef.current = 'morphing'
      morphStartRef.current = 0
    }
  }, [isLoading])

  useEffect(() => {
    function animate(time: number) {
      const path = pathRef.current
      if (!path) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }

      const phase = phaseRef.current
      if (phase === 'done') {
        path.setAttribute('opacity', '0')
        return
      }

      const amplitude = innerHeight * AMPLITUDE_RATIO
      const centerY = innerHeight / 2

      if (phase === 'loading') {
        frozenWaveTimeRef.current = time
        const s = time * SCROLL_SPEED
        const pts: { x: number; y: number }[] = []
        for (let i = 0; i <= NUM_POINTS; i++) {
          const x = (i / NUM_POINTS) * innerWidth
          pts.push({ x, y: centerY + waveY(x + s * 100, s, amplitude) })
        }
        path.setAttribute('d', toPathD(pts))
        path.setAttribute('stroke', '#999999')
        path.setAttribute('stroke-width', '1.5')
        path.setAttribute('opacity', String(breath(time)))
      } else if (phase === 'morphing') {
        if (morphStartRef.current === 0) morphStartRef.current = time
        const rawT = Math.min(1, (time - morphStartRef.current) / MORPH_MS)
        const t = easeOutCubic(rawT)

        const frozenS = frozenWaveTimeRef.current * SCROLL_SPEED
        const data = dataRef.current
        const pts: { x: number; y: number }[] = []
        for (let i = 0; i <= NUM_POINTS; i++) {
          const x = (i / NUM_POINTS) * innerWidth
          const wy = centerY + waveY(x + frozenS * 100, frozenS, amplitude)
          const dy = interpolateY(data as { x: number; y: number }[], x) ?? centerY
          pts.push({ x, y: wy + (dy - wy) * t })
        }

        const c = Math.round(0x99 + (0xff - 0x99) * t)
        const breathVal = breath(frozenWaveTimeRef.current)
        path.setAttribute('d', toPathD(pts))
        path.setAttribute('stroke', `rgb(${c},${c},${c})`)
        path.setAttribute('stroke-width', String(1.5 + 0.5 * t))
        path.setAttribute('opacity', String(breathVal + (1 - breathVal) * t))

        // Fire reveal early so the real chart starts fading in while we're still morphing
        if (rawT >= 0.7 && !revealFiredRef.current) {
          revealFiredRef.current = true
          onRevealRef.current()
        }

        if (rawT >= 1) {
          phaseRef.current = 'fading'
          fadeStartRef.current = time
        }
      } else if (phase === 'fading') {
        // Hold the final morph shape, fade opacity from 1 → 0
        // The real chart line is fading in underneath simultaneously
        const rawF = Math.min(1, (time - fadeStartRef.current) / FADE_MS)
        path.setAttribute('opacity', String(1 - rawF))

        if (rawF >= 1) {
          phaseRef.current = 'done'
          path.setAttribute('opacity', '0')
          return
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [innerWidth, innerHeight, isLoading])

  return (
    <path
      ref={pathRef}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    />
  )
}
