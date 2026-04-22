import { useEffect, useRef } from 'react'

import { BRACKET_CUBICS, X_CUBICS, type CubicSegment } from '../geometry'
import { useCanvasSize } from '../useCanvasSize'
import { makeTransform } from './maskUtils'

export interface LogoVariantFanProps {
  ariaLabel?: string
}

/**
 * Probability fan — animated.
 *
 * A swarm of stroked outlines, each one an independently evolving
 * perturbation of the logo silhouette. Every path:
 *   • breathes on two oscillation axes so its shape deforms continuously
 *   • pulses alpha + line width through a lifecycle (spawn → peak → fade)
 *   • carries a marching-ants dash that runs around the curve
 * Additively blended, the result reads as a live cone of prediction
 * paths — the "many outcomes" behind the brand's one silhouette. Tinted
 * along the brand gradient (yellow → green) so the panel stays inside
 * the site's palette.
 */
export function LogoVariantFan({ ariaLabel = 'LevX' }: LogoVariantFanProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useCanvasSize(containerRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = size.width
    canvas.height = size.height

    const toCanvas = makeTransform(size.width, size.height, 1.0)

    const FROM = { r: 0xf4, g: 0xfa, b: 0x4d }
    const TO = { r: 0x5c, g: 0xf7, b: 0x8b }
    const mix = (t: number) => ({
      r: FROM.r + (TO.r - FROM.r) * t,
      g: FROM.g + (TO.g - FROM.g) * t,
      b: FROM.b + (TO.b - FROM.b) * t,
    })

    // Each seed is a fixed "strand" whose perturbation + lifecycle phase
    // evolve forever. Amplitudes are wider than the static version so the
    // fan visibly opens and closes.
    const N = 28
    const seeds = Array.from({ length: N }, (_, i) => ({
      amp: 0.014 + Math.random() * 0.04,
      freq: 0.00045 + Math.random() * 0.001,
      freq2: 0.00075 + Math.random() * 0.0014,
      phase: Math.random() * Math.PI * 2,
      phase2: Math.random() * Math.PI * 2,
      hueT: i / Math.max(1, N - 1),
      lifePhase: Math.random(),
      lifeSpeed: 0.00012 + Math.random() * 0.0003,
      dashPhase: Math.random() * 200,
    }))

    function tracePerturbed(
      segments: readonly CubicSegment[],
      offsetSeed: number,
      seedIndex: number,
      time: number,
    ) {
      const seed = seeds[seedIndex]
      const osc1 = Math.sin(time * seed.freq + seed.phase)
      const osc2 = Math.sin(time * seed.freq2 + seed.phase2)
      ctx!.beginPath()
      const s0 = segments[0]
      const [sx, sy] = toCanvas(s0[0], s0[1])
      ctx!.moveTo(sx, sy)
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i]
        // Two oscillation axes — one drives x-ish motion, the other y-ish.
        // Controls perturbed, anchors stay put, so the fan hangs together.
        const dx1 = seed.amp * osc1 * Math.sin(i * 1.37 + seed.phase + offsetSeed)
        const dy1 = seed.amp * osc2 * Math.cos(i * 1.11 + seed.phase + offsetSeed)
        const dx2 = seed.amp * osc2 * Math.sin(i * 0.89 + seed.phase2 + offsetSeed)
        const dy2 = seed.amp * osc1 * Math.cos(i * 1.53 + seed.phase2 + offsetSeed)
        const [c1x, c1y] = toCanvas(s[2] + dx1, s[3] + dy1)
        const [c2x, c2y] = toCanvas(s[4] + dx2, s[5] + dy2)
        const [ex, ey] = toCanvas(s[6], s[7])
        ctx!.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey)
      }
      ctx!.closePath()
    }

    const start = performance.now()
    let rafId = 0
    const tick = (t: number) => {
      const elapsed = t - start
      ctx.clearRect(0, 0, size.width, size.height)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.globalCompositeOperation = 'lighter'

      const dashUnit = 18 * size.dpr

      for (let k = 0; k < N; k++) {
        const seed = seeds[k]
        // Lifecycle → triangle wave 0→1→0 (fade in, peak, fade out).
        const lc = (seed.lifePhase + elapsed * seed.lifeSpeed) % 1
        const life = lc < 0.5 ? lc * 2 : (1 - lc) * 2

        const { r, g, b } = mix(seed.hueT)
        ctx.lineWidth = (0.6 + life * 1.6) * size.dpr
        ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.08 + life * 0.38})`

        // Marching ants — offset per-path so strands run out of phase.
        ctx.setLineDash([dashUnit, dashUnit * 1.4])
        ctx.lineDashOffset = -((elapsed * 0.09 + seed.dashPhase) % (dashUnit * 2.4))

        tracePerturbed(BRACKET_CUBICS, 0, k, elapsed)
        ctx.stroke()
        tracePerturbed(X_CUBICS, 4.1, k, elapsed)
        ctx.stroke()
      }

      ctx.setLineDash([])
      ctx.globalCompositeOperation = 'source-over'
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [size.width, size.height, size.dpr])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      role="img"
      aria-label={`${ariaLabel} (probability fan)`}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
