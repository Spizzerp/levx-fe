import { useEffect, useRef, useState } from 'react'

import { CrtEffects } from '@/ui/CrtEffects'
import { BRACKET_CUBICS, X_CUBICS, type CubicSegment } from '@/ui/BezierLogo/geometry'
import { buildLogoPaths, buildMaskPixels } from '@/ui/BezierLogo/variants/maskUtils'

interface RootLogoRevealProps {
  onComplete: () => void
  /**
   * Tone-scan duration in ms — a sweeping clip rect reveals the already-
   * spawning tendrils left → right, so the first impression is of a scan
   * bar passing across the canvas rather than tendrils popping in.
   */
  toneScanMs?: number
  /**
   * Grow duration in ms — tendrils keep spawning from the canvas edges
   * and growing inward (deflecting around the logo outline). Partway
   * through, a bright white "sentinel" tendril spawns from the top edge
   * and draws through to the centre, giving the eye a single focal line
   * among the coloured root mass.
   */
  growMs?: number
  /** Morph duration in ms — tendrils converge into the logo outline. */
  morphMs?: number
  /** Hold duration in ms — crisp logo outline holds before resolve starts. */
  holdMs?: number
  /**
   * Resolve duration in ms — a radial outside-in matte closes over the
   * root lines while the final logo fades/scales in on top.
   */
  whiteFillMs?: number
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Tendril storage — pre-allocated once, sized for the worst case so the
 * grow loop never allocates. `pts` stores [x0, y0, x1, y1, …] polyline
 * history; `n` is the count of points so far. `sentinel` marks the one
 * brighter feature tendril so the render loop can draw it in a second
 * pass with a fatter stroke + stronger phosphor halo.
 */
interface Tendril {
  pts: Float32Array
  n: number
  vx: number
  vy: number
  speed: number
  age: number
  growth: number
  active: boolean
  sentinel: boolean
  /** Which logo subpath this tendril morphs into: 0 = bracket, 1 = X. */
  subpathIdx: 0 | 1
  /**
   * Starting index into the chosen subpath's sample buffer. Vertex j of
   * the tendril morphs to subpathSamples[(offset + j) mod K_SUB]. Random
   * per tendril so the union of all tendrils covers the full outline
   * multiple times with overlap — gives the morph-target a dense,
   * evenly-bright phosphor edge.
   */
  logoOffset: number
}

export function RootLogoReveal({
  onComplete,
  toneScanMs = 800,
  growMs = 4000,
  morphMs = 1000,
  holdMs = 300,
  whiteFillMs: resolveMs = 2000,
}: RootLogoRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(() => !prefersReducedMotion())
  const completedRef = useRef(false)

  useEffect(() => {
    if (!mounted) {
      if (!completedRef.current) {
        completedRef.current = true
        queueMicrotask(onComplete)
      }
      return
    }
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    let logoPaths: ReturnType<typeof buildLogoPaths> | null = null

    // Inside-silhouette lookup. The mask must share the canvas's aspect
    // ratio — buildLogoPaths / buildMaskPixels both scale the logo by
    // `min(w, h) / 2 * zoom`, so a square mask over a widescreen canvas
    // would map the logo into the wrong proportion of the lookup grid
    // (the imagined silhouette would be ~1.8× larger than the real one
    // at 16:9). MASK_LONG caps the long edge to keep bits affordable;
    // the short edge scales proportionally. Lookup bounds and stride
    // both live on dynamic `maskW` / `maskH` rather than a constant.
    const MASK_LONG = 256
    let mask: Uint8ClampedArray | null = null
    let maskW = 1
    let maskH = 1
    let maskScaleX = 1
    let maskScaleY = 1
    const isInside = (px: number, py: number): boolean => {
      if (!mask) return false
      const ix = (px * maskScaleX) | 0
      const iy = (py * maskScaleY) | 0
      if (ix < 0 || iy < 0 || ix >= maskW || iy >= maskH) return false
      return mask[(iy * maskW + ix) * 4 + 3] > 128
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, Math.floor(rect.width * dpr))
      height = Math.max(1, Math.floor(rect.height * dpr))
      canvas.width = width
      canvas.height = height
      // Logo scale matches ChartLogoReveal so both intros resolve to the
      // same-sized final mark — important because the downstream market-
      // card rise is sized expecting that specific silhouette footprint.
      logoPaths = buildLogoPaths(width, height, 0.62)
      // Size mask to the canvas's aspect ratio so maskScaleX / maskScaleY
      // are equal — that's what makes the mapping from canvas pixels to
      // mask pixels isotropic, and therefore what makes the rasterised
      // logo sit at the same relative footprint in both spaces.
      if (width >= height) {
        maskW = MASK_LONG
        maskH = Math.max(1, Math.round(MASK_LONG * (height / width)))
      } else {
        maskH = MASK_LONG
        maskW = Math.max(1, Math.round(MASK_LONG * (width / height)))
      }
      mask = buildMaskPixels(maskW, maskH, 0.62)
      maskScaleX = maskW / width
      maskScaleY = maskH / height
    }
    resize()
    window.addEventListener('resize', resize)

    // ─── Logo outline sampling (morph targets) ────────────────────
    // Sample both logo subpaths in UV space once at mount — UV is
    // canvas-size-independent, so no need to rebuild on resize. The
    // render loop converts UV → canvas coords per-frame using cx, cy,
    // logoScale (which DO depend on canvas size). K_SUB is the sample
    // count per subpath; 200 is dense enough that chord gaps between
    // adjacent samples are sub-pixel at our typical viewport sizes,
    // so the final morphed outline reads as a smooth curve rather
    // than a faceted polygon. Mirrors ChartLogoReveal's per-vertex
    // bezier-lerp logic — the only morph strategy that actually makes
    // the lines form the logo rather than crossfading underneath it.
    const K_SUB = 200
    const sampleBezier = (segments: readonly CubicSegment[], k: number): Float32Array => {
      const out = new Float32Array(k * 2)
      const n = segments.length
      for (let i = 0; i < k; i++) {
        const fidx = (i / (k - 1)) * n
        const segIdx = Math.min(n - 1, Math.floor(fidx))
        const tt = Math.min(1, fidx - segIdx)
        const s = segments[segIdx]
        const mt = 1 - tt
        const mt2 = mt * mt
        const t2 = tt * tt
        out[i * 2] = mt2 * mt * s[0] + 3 * mt2 * tt * s[2] + 3 * mt * t2 * s[4] + t2 * tt * s[6]
        out[i * 2 + 1] =
          mt2 * mt * s[1] + 3 * mt2 * tt * s[3] + 3 * mt * t2 * s[5] + t2 * tt * s[7]
      }
      return out
    }
    const bracketSamples = sampleBezier(BRACKET_CUBICS, K_SUB)
    const xSamples = sampleBezier(X_CUBICS, K_SUB)

    // ─── Tendril pool ─────────────────────────────────────────────
    const MAX_PTS = 220
    const MAX_TENDRILS = 200
    const SPAWN_TARGET = 170
    // Quadratic ease-in on spawn rate — sparse early, rushing to fill
    // at the end of the grow phase so density peaks just before morph.
    const spawnCurve = (p: number) => p * p

    const pool: Tendril[] = []
    for (let i = 0; i < MAX_TENDRILS; i++) {
      pool.push({
        pts: new Float32Array(MAX_PTS * 2),
        n: 0,
        vx: 0,
        vy: 0,
        speed: 0,
        age: 0,
        growth: 0,
        active: false,
        sentinel: false,
        subpathIdx: 0,
        logoOffset: 0,
      })
    }

    const spawnTendril = (sentinel = false): Tendril | null => {
      let t: Tendril | null = null
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          t = pool[i]
          break
        }
      }
      if (!t) return null
      t.active = true
      t.sentinel = sentinel
      // Assign morph target at spawn — balanced roughly 50/50 between
      // the two subpaths, with a random start offset into the sample
      // buffer so overlapping tendrils cover the outline uniformly.
      t.subpathIdx = Math.random() < 0.5 ? 0 : 1
      t.logoOffset = (Math.random() * K_SUB) | 0

      const edge = (Math.random() * 4) | 0
      let x: number
      let y: number
      if (edge === 0) {
        x = Math.random() * width
        y = -4
      } else if (edge === 1) {
        x = width + 4
        y = Math.random() * height
      } else if (edge === 2) {
        x = Math.random() * width
        y = height + 4
      } else {
        x = -4
        y = Math.random() * height
      }
      const cxL = width / 2
      const cyL = height / 2
      const baseAng = Math.atan2(cyL - y, cxL - x)
      const ang = baseAng + (Math.random() - 0.5) * 0.9
      t.speed = (1.5 + Math.random() * 1.3) * dpr
      t.vx = Math.cos(ang) * t.speed
      t.vy = Math.sin(ang) * t.speed
      t.pts[0] = x
      t.pts[1] = y
      t.n = 1
      t.age = 0
      // Sentinel lives longer — needs to draw all the way to centre.
      t.growth = sentinel ? 200 : 110 + ((Math.random() * 130) | 0)
      return t
    }

    // Deflect tendril tip along logo outline — look-ahead one step; if
    // the forward pose would land inside the silhouette, blend velocity
    // toward the perpendicular that stays outside. Same logic as
    // LogoVariantRootSystem.
    const growOneStep = (t: Tendril) => {
      if (t.n >= MAX_PTS) return
      const headIdx = (t.n - 1) * 2
      const hx = t.pts[headIdx]
      const hy = t.pts[headIdx + 1]

      const wig = 0.22
      let vx = t.vx + (Math.random() - 0.5) * wig
      let vy = t.vy + (Math.random() - 0.5) * wig
      let m = Math.hypot(vx, vy) || 1
      vx = (vx / m) * t.speed
      vy = (vy / m) * t.speed

      const look = 3.5
      const lookX = hx + vx * look
      const lookY = hy + vy * look
      if (isInside(lookX, lookY)) {
        let tvx = -vy
        let tvy = vx
        if (isInside(hx + tvx * look, hy + tvy * look)) {
          tvx = vy
          tvy = -vx
        }
        vx = vx * 0.62 + tvx * 0.38
        vy = vy * 0.62 + tvy * 0.38
        m = Math.hypot(vx, vy) || 1
        vx = (vx / m) * t.speed
        vy = (vy / m) * t.speed
      }

      const newX = hx + vx
      const newY = hy + vy
      if (isInside(newX, newY)) return // wedged — freeze head here

      t.vx = vx
      t.vy = vy
      t.pts[t.n * 2] = newX
      t.pts[t.n * 2 + 1] = newY
      t.n++
    }

    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

    const start = performance.now()
    let spawnedCount = 0
    let whiteSpawned = false
    let rafId = 0

    const tick = (ts: number) => {
      const elapsed = ts - start
      const scanP = Math.max(0, Math.min(1, elapsed / toneScanMs))
      const growElapsed = elapsed - toneScanMs
      const growP = Math.max(0, Math.min(1, growElapsed / growMs))
      const morphElapsed = elapsed - toneScanMs - growMs
      const morphP = Math.max(0, Math.min(1, morphElapsed / morphMs))
      const resolveElapsed = elapsed - toneScanMs - growMs - morphMs - holdMs
      const resolveP = Math.max(0, Math.min(1, resolveElapsed / resolveMs))

      // Hand-off after the full sequence has run. 1950ms allows the
      // market card rise to overlap the tail of the resolve bloom.
      if (
        elapsed >= toneScanMs + growMs + morphMs + holdMs + resolveMs &&
        !completedRef.current
      ) {
        completedRef.current = true
        onComplete()
        window.setTimeout(() => setMounted(false), 1950)
      }

      // ── Spawn logic ─────────────────────────────────────────────
      // Spawn across scan + grow combined so the scan phase already has
      // tendrils to reveal under its clip rect (rather than a blank wipe
      // followed by a grow phase that starts from nothing).
      const spawnWindow = toneScanMs + growMs
      const spawnProgress = Math.min(1, elapsed / spawnWindow)
      const targetSpawned = Math.floor(SPAWN_TARGET * spawnCurve(spawnProgress))
      while (spawnedCount < targetSpawned) {
        spawnTendril()
        spawnedCount++
      }
      // Sentinel — spawned once, 25% into the grow phase so the main
      // tendril mass has established itself first. Drawn with a fatter
      // stroke + stronger phosphor halo so the eye has a single focal
      // feature among the root field.
      if (!whiteSpawned && growP >= 0.25) {
        spawnTendril(true)
        whiteSpawned = true
      }

      // Advance every active tendril one growth step per frame. Freeze
      // tendril heads during morph so the fade-out preserves the shape
      // they ended on.
      if (morphP === 0) {
        for (let i = 0; i < pool.length; i++) {
          const t = pool[i]
          if (!t.active) continue
          if (t.age < t.growth) growOneStep(t)
          t.age++
        }
      }

      // ── Render ──────────────────────────────────────────────────
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.globalCompositeOperation = 'lighter'

      // Tendril alpha stays pegged during scan+grow+morph, then fades in
      // resolve while the radial matte closes inward.
      const tendrilFadeStart = 0.08
      const tendrilFadeEnd = 0.72
      const tendrilFadeP =
        resolveP <= tendrilFadeStart
          ? 0
          : Math.min(1, (resolveP - tendrilFadeStart) / (tendrilFadeEnd - tendrilFadeStart))
      const tendrilAlpha = 1 - ease(tendrilFadeP)

      // Morph-space canvas coords for target lookup — cx/cy/logoScale
      // match `buildLogoPaths(width, height, 0.62)` so tendril targets
      // land on the same silhouette the resolve phase paints. Hoisted
      // out of the loop since every tendril vertex needs them each frame.
      const cx = width / 2
      const cy = height / 2
      const logoScale = (Math.min(width, height) / 2) * 0.62
      const mE = ease(morphP)

      // Scan-phase clip: reveals the already-growing tendrils L → R
      // under a swept rect with ease-in-out pacing.
      const scanClipped = scanP < 1 && tendrilAlpha > 0
      if (scanClipped) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, ease(scanP) * width, height)
        ctx.clip()
      }

      // ── White phosphor tendrils ─────────────────────────────────
      // Each tendril vertex j lerps from its grown polyline position
      // toward its assigned logo-sample at subpathSamples[(logoOffset + j)
      // mod K_SUB], using an ease-in-out factor on morphP. At mE=0 the
      // tendril draws as the physical polyline it grew into; at mE=1
      // every vertex sits on the logo outline, so the union of all
      // active tendrils forms a dense overlapping stroke that IS the
      // logo shape. Halo (wide filter blur) + crisp core are both
      // stroked from the same Path2D batch so the two passes line up.
      if (tendrilAlpha > 0.01) {
        const drawTendril = (t: Tendril) => {
          const samples = t.subpathIdx === 0 ? bracketSamples : xSamples
          for (let p = 0; p < t.n; p++) {
            let px = t.pts[p * 2]
            let py = t.pts[p * 2 + 1]
            if (mE > 0) {
              const idx = (t.logoOffset + p) % K_SUB
              const tx = cx + samples[idx * 2] * logoScale
              const ty = cy - samples[idx * 2 + 1] * logoScale
              px = px + (tx - px) * mE
              py = py + (ty - py) * mE
            }
            if (p === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
        }

        const batchRegular = () => {
          ctx.beginPath()
          for (let i = 0; i < pool.length; i++) {
            const t = pool[i]
            if (!t.active || t.sentinel || t.n < 2) continue
            drawTendril(t)
          }
        }

        // Outer halo: wide blur via ctx.filter. Filter rather than
        // shadowBlur so the halo reads as one continuous bleed across
        // the whole network instead of per-stroke halos that break
        // apart at crossings.
        ctx.filter = `blur(${12 * dpr}px)`
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * tendrilAlpha})`
        ctx.lineWidth = 3.6 * dpr
        batchRegular()
        ctx.stroke()

        // Crisp core.
        ctx.filter = 'none'
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * tendrilAlpha})`
        ctx.lineWidth = 2.4 * dpr
        batchRegular()
        ctx.stroke()

        // Sentinel — fatter + shadowBlur for a brighter point of focus.
        const batchSentinel = () => {
          ctx.beginPath()
          for (let i = 0; i < pool.length; i++) {
            const t = pool[i]
            if (!t.active || !t.sentinel || t.n < 2) continue
            drawTendril(t)
          }
        }
        ctx.shadowColor = `rgba(255,255,255,${0.9 * tendrilAlpha})`
        ctx.shadowBlur = 26 * dpr
        ctx.strokeStyle = `rgba(255,255,255,${0.95 * tendrilAlpha})`
        ctx.lineWidth = 4.2 * dpr
        batchSentinel()
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      if (scanClipped) ctx.restore()

      ctx.filter = 'none'
      ctx.globalCompositeOperation = 'source-over'
      ctx.shadowBlur = 0

      // ── Resolve phase: outside-in radial cleanup + logo settle ───
      if (resolveP > 0) {
        const resolveE = ease(resolveP)
        const cornerRadius = Math.hypot(width * 0.5, height * 0.5)
        const minHoleRadius = Math.min(width, height) * 0.12
        const holeRadius = cornerRadius + (minHoleRadius - cornerRadius) * resolveE
        const feather = Math.max(72 * dpr, Math.min(width, height) * 0.22)

        const vignette = ctx.createRadialGradient(
          cx,
          cy,
          Math.max(0, holeRadius),
          cx,
          cy,
          holeRadius + feather,
        )
        vignette.addColorStop(0, 'rgba(0,0,0,0)')
        vignette.addColorStop(0.72, `rgba(0,0,0,${0.88 * resolveE})`)
        vignette.addColorStop(1, `rgba(0,0,0,${Math.min(1, 0.98 * resolveE)})`)
        ctx.fillStyle = vignette
        ctx.fillRect(0, 0, width, height)
      }

      // Delay logo reveal until the outline has clearly formed.
      if (resolveP > 0 && logoPaths) {
        const logoRevealDelay = 0.14
        const logoP =
          resolveP <= logoRevealDelay
            ? 0
            : Math.min(1, (resolveP - logoRevealDelay) / (1 - logoRevealDelay))
        if (logoP > 0) {
          const logoE = ease(logoP)
          const logoScale = 1.16 - logoE * 0.16

          ctx.save()
          ctx.translate(cx, cy)
          ctx.scale(logoScale, logoScale)
          ctx.translate(-cx, -cy)

          ctx.globalCompositeOperation = 'lighter'

          ctx.filter = `blur(${54 * dpr}px)`
          ctx.fillStyle = `rgba(255,255,255,${0.48 * logoE})`
          ctx.fill(logoPaths.bracket)
          ctx.fill(logoPaths.x)

          ctx.filter = `blur(${18 * dpr}px)`
          ctx.fillStyle = `rgba(255,255,255,${0.68 * logoE})`
          ctx.fill(logoPaths.bracket)
          ctx.fill(logoPaths.x)

          ctx.filter = `blur(${6 * dpr}px)`
          ctx.fillStyle = `rgba(255,255,255,${0.84 * logoE})`
          ctx.fill(logoPaths.bracket)
          ctx.fill(logoPaths.x)

          ctx.filter = 'none'
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = `rgba(255,255,255,${logoE})`
          ctx.fill(logoPaths.bracket)
          ctx.fill(logoPaths.x)
          ctx.restore()
        }
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [mounted, onComplete, toneScanMs, growMs, morphMs, holdMs, resolveMs])

  if (!mounted) return null

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-[1000] overflow-hidden bg-black"
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {/* CrtEffects as a sibling overlay (same pattern as ChartLogoReveal)
          so the canvas stays on its own compositor layer and doesn't
          re-rasterise every wobble tick. Wobble is off here too — the
          tendril motion + white-fill bloom already carry the movement. */}
      <CrtEffects
        className="pointer-events-none absolute inset-0"
        wobble={false}
        vcr={{ opacity: 0.12, num: 56 }}
      />
    </div>
  )
}
