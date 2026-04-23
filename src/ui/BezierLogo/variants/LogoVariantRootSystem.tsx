import { useEffect, useRef } from 'react'

import { useCanvasSize } from '../useCanvasSize'
import { buildLogoPaths, buildMaskPixels } from './maskUtils'

export interface LogoVariantRootSystemProps {
  ariaLabel?: string
}

/**
 * Root system.
 *
 * A one-shot narrative sequence — plays once end-to-end and holds on
 * the resolved logo forever. Does not loop.
 *
 *   BUILD   — tendrils spawn at a steady rate from the canvas edges and
 *             grow inward, deflecting tangentially along the logo's
 *             outline. The tendril count monotonically increases.
 *   SETTLE  — spawning stops; already-spawned tendrils finish their
 *             individual growth trajectories. Visual peak density.
 *   RESOLVE — crossfade: tendrils fade out, the logo silhouette fades
 *             in as pure white.
 *   HOLD    — the mark sits at full brightness indefinitely. Scrolling
 *             offscreen and back pauses and resumes in the hold state
 *             — the sequence never replays.
 *
 * Each tendril stores its own full polyline history and is drawn as a
 * continuous stroke — real lines, not fade-accumulated particle trails.
 * Look-ahead deflection with velocity blending produces curved turns
 * along the outline, so tendrils wrap the logo like roots around an
 * obstacle rather than kinking at sharp right-angles.
 *
 * Perf:
 *   • Fixed tendril pool (no allocation mid-cycle).
 *   • All tendrils rendered in a single `stroke()` call per frame (one
 *     shared alpha via `globalAlpha`).
 *   • 256² mask lookup for inside/look-ahead tests.
 *   • Scanline + vignette baked offscreen, blitted once per frame.
 *   • rAF pauses when the panel is offscreen.
 */
export function LogoVariantRootSystem({ ariaLabel = 'LevX' }: LogoVariantRootSystemProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useCanvasSize(containerRef)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || size.width === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = size.width
    canvas.height = size.height

    // ─── Silhouette mask + logo fill path ──────────────────────────
    // Mask must share the canvas aspect ratio so the tendril-deflection
    // silhouette matches the logo path rendered at resolve-time pixel
    // for pixel. Scaling a square mask with per-axis factors stretches
    // the silhouette and makes the root-system outline diverge from the
    // final white fade-in.
    const MASK_LONG = 256
    const aspect = size.width / size.height
    const MASK_W = aspect >= 1 ? MASK_LONG : Math.max(1, Math.round(MASK_LONG * aspect))
    const MASK_H = aspect >= 1 ? Math.max(1, Math.round(MASK_LONG / aspect)) : MASK_LONG
    const mask = buildMaskPixels(MASK_W, MASK_H, 1.0)
    const maskScaleX = MASK_W / size.width
    const maskScaleY = MASK_H / size.height
    const isInside = (px: number, py: number): boolean => {
      const ix = (px * maskScaleX) | 0
      const iy = (py * maskScaleY) | 0
      if (ix < 0 || iy < 0 || ix >= MASK_W || iy >= MASK_H) return false
      return mask[(iy * MASK_W + ix) * 4 + 3] > 128
    }

    const cx = size.width / 2
    const cy = size.height / 2

    const { bracket: logoBracket, x: logoX } = buildLogoPaths(size.width, size.height, 1.0)

    // ─── Scanlines (baked once, drawn at full strength) ────────────
    const scanTex = document.createElement('canvas')
    scanTex.width = size.width
    scanTex.height = size.height
    const sctx = scanTex.getContext('2d')
    if (sctx) {
      sctx.clearRect(0, 0, size.width, size.height)
      sctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      const lineH = Math.max(1, size.dpr | 0)
      const step = 3 * size.dpr
      for (let y = 0; y < size.height; y += step) {
        sctx.fillRect(0, y, size.width, lineH)
      }
    }

    // ─── Vignette (built per frame with animated radii) ────────────
    // Drawn live each tick rather than baked so the inner/outer radii
    // and end-stop alpha can close in toward the logo through SETTLE,
    // progressively darkening tendril tails from the edges inward.
    // Rendered between the tendril and logo passes so the logo bloom
    // is unaffected — the vignette only touches the tendril field.
    const minDim = Math.min(size.width, size.height)
    const maxDim = Math.max(size.width, size.height)
    // Radii at phase start (wide, barely visible) and phase end (tight
    // ring just outside the logo silhouette). `minDim * 0.5` outer at
    // full close keeps the silhouette region bright — the logo lives
    // inside roughly `min(w,h)/2` from center at zoom=1.
    const VIGNETTE_OUTER_WIDE = maxDim
    const VIGNETTE_OUTER_TIGHT = minDim * 0.5
    const VIGNETTE_INNER_WIDE = minDim * 0.45
    const VIGNETTE_INNER_TIGHT = minDim * 0.08
    const VIGNETTE_END_ALPHA_WIDE = 0.4
    const VIGNETTE_END_ALPHA_TIGHT = 0.92
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    // ─── Sequence phases (ms) — one-shot, does not loop ────────────
    const BUILD_MS = 2000
    const SETTLE_MS = 3000
    const RESOLVE_MS = 1500
    const T_BUILD = BUILD_MS
    const T_SETTLE = BUILD_MS + SETTLE_MS
    const T_RESOLVE = BUILD_MS + SETTLE_MS + RESOLVE_MS

    // ─── Tendril pool ──────────────────────────────────────────────
    const MAX_PTS = 400
    const MAX_TENDRILS = 60
    const SPAWN_TARGET = 60
    // Front-loaded: target by progress p is SPAWN_TARGET·(1-(1-p)³) —
    // cubic ease-out, so the bulk of tendrils appear in the first third
    // of the build and only a trickle spawn near the end.
    const spawnCurve = (p: number) => 1 - (1 - p) * (1 - p) * (1 - p)

    interface Tendril {
      pts: Float32Array
      n: number
      vx: number
      vy: number
      speed: number
      age: number
      growth: number
      active: boolean
    }

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
      })
    }

    // ─── Stratified perimeter spawn points ─────────────────────────
    // Uniform-random edge sampling clumps visibly at low tendril
    // counts (one edge ends up with a cluster, another bald). Instead
    // we bin the full perimeter into SPAWN_TARGET slots and jitter each
    // spawn within its slot, then shuffle the order — so coverage is
    // guaranteed even but spawn order feels unpredictable.
    const perimeter = 2 * (size.width + size.height)
    const binSize = perimeter / SPAWN_TARGET
    const JITTER = 0.7 // fraction of bin width — >0 breaks the grid, <1 keeps bins disjoint
    const perimeterToPoint = (s: number): { x: number; y: number } => {
      let r = ((s % perimeter) + perimeter) % perimeter
      if (r < size.width) return { x: r, y: -4 }
      r -= size.width
      if (r < size.height) return { x: size.width + 4, y: r }
      r -= size.height
      if (r < size.width) return { x: size.width - r, y: size.height + 4 }
      r -= size.width
      return { x: -4, y: size.height - r }
    }
    const spawnPoints: { x: number; y: number }[] = []
    for (let i = 0; i < SPAWN_TARGET; i++) {
      const jitter = (Math.random() - 0.5) * binSize * JITTER
      spawnPoints.push(perimeterToPoint((i + 0.5) * binSize + jitter))
    }
    for (let i = spawnPoints.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0
      const tmp = spawnPoints[i]
      spawnPoints[i] = spawnPoints[j]
      spawnPoints[j] = tmp
    }

    function spawnTendril() {
      let t: Tendril | null = null
      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].active) {
          t = pool[i]
          break
        }
      }
      if (!t) return
      t.active = true

      // Pull the next stratified+shuffled perimeter point. Guarded in
      // case MAX_TENDRILS ever exceeds SPAWN_TARGET — fall back to a
      // random edge rather than repeat a slot.
      const point = spawnPoints[spawnedCount] ?? perimeterToPoint(Math.random() * perimeter)
      const x = point.x
      const y = point.y
      const dx = cx - x
      const dy = cy - y
      const baseAng = Math.atan2(dy, dx)
      const ang = baseAng + (Math.random() - 0.5) * 0.9
      t.speed = (5.0 + Math.random() * 1.3) * size.dpr
      t.vx = Math.cos(ang) * t.speed
      t.vy = Math.sin(ang) * t.speed
      t.pts[0] = x
      t.pts[1] = y
      t.n = 1
      t.age = 0
      t.growth = 110 + ((Math.random() * 130) | 0)
    }

    function growOneStep(t: Tendril) {
      if (t.n >= MAX_PTS) return
      const headIdx = (t.n - 1) * 2
      const hx = t.pts[headIdx]
      const hy = t.pts[headIdx + 1]

      // Wig scaled by current speed so the relative jitter stays
      // particle-like regardless of tuned base speed — with speed 5 and
      // WIG_FRAC 0.28 each step bends by up to ~16° from the prior
      // heading, accumulating into the brownian/wandering lines the
      // reference shot shows in the open black field.
      const WIG_FRAC = 0.28
      const wig = WIG_FRAC * t.speed
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

    // ─── Cycle + timing state ──────────────────────────────────────
    let cycleElapsed = 0
    let spawnedCount = 0
    let lastT = performance.now()
    let rafId = 0
    let running = true

    const tick = (ts: number) => {
      if (!running) return
      // Clamp dt so tab-wakes/long-pauses don't teleport the sequence.
      const dt = Math.min(60, ts - lastT)
      lastT = ts
      // Cap elapsed at the end of the sequence — once resolved, time
      // stops advancing so the panel holds on the bright logo forever.
      if (cycleElapsed < T_RESOLVE) {
        cycleElapsed = Math.min(T_RESOLVE, cycleElapsed + dt)
      }

      // ── Phase resolution ─────────────────────────────────────────
      // `vignetteAlpha` eases 0 → 1 across SETTLE so the frame tightens
      // around the tendril mass only after spawning stops, and holds at
      // full through RESOLVE/HOLD.
      let tendrilAlpha = 1
      let logoAlpha = 0
      let vignetteAlpha = 0
      let shouldSpawn = false
      if (cycleElapsed < T_BUILD) {
        shouldSpawn = true
      } else if (cycleElapsed < T_SETTLE) {
        const p = (cycleElapsed - T_BUILD) / SETTLE_MS
        // Smoothstep for a soft in/out ease on the darkening.
        vignetteAlpha = p * p * (3 - 2 * p)
      } else if (cycleElapsed < T_RESOLVE) {
        const p = (cycleElapsed - T_SETTLE) / RESOLVE_MS
        tendrilAlpha = 1 - p
        logoAlpha = p
        vignetteAlpha = 1
      } else {
        // HOLD — indefinite.
        tendrilAlpha = 0
        logoAlpha = 1
        vignetteAlpha = 1
      }

      // ── Spawn during BUILD — catch up to the easing curve ────────
      if (shouldSpawn) {
        const progress = Math.min(1, cycleElapsed / BUILD_MS)
        const targetSpawned = Math.floor(SPAWN_TARGET * spawnCurve(progress))
        while (spawnedCount < targetSpawned) {
          spawnTendril()
          spawnedCount++
        }
      }

      // ── Advance every active tendril ────────────────────────────
      for (let i = 0; i < pool.length; i++) {
        const t = pool[i]
        if (!t.active) continue
        if (t.age < t.growth) growOneStep(t)
        t.age++
      }

      // ── Render ───────────────────────────────────────────────────
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, size.width, size.height)

      if (tendrilAlpha > 0.01) {
        // Width decays smoothly from BASE at cycle start to MIN by the
        // end of SETTLE, then holds thin through RESOLVE — so the mass
        // reads as dense at first and wisps out as the vignette closes.
        const WIDTH_BASE = 10.0
        const WIDTH_MIN = 2.0
        const widthP = Math.min(1, cycleElapsed / T_SETTLE)
        const tendrilWidth = lerp(WIDTH_BASE, WIDTH_MIN, widthP) * size.dpr
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = tendrilAlpha * 0.85
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = tendrilWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        // Phosphor bloom around the stroke — single-pass shadowBlur
        // matches the white-fill halo ChartLogoReveal uses and is cheap
        // because the whole pool is drawn in one stroke() call, so the
        // shadow is cast once over the composite path.
        ctx.shadowColor = 'rgba(255,255,255,0.85)'
        ctx.shadowBlur = 24 * size.dpr
        ctx.beginPath()
        for (let i = 0; i < pool.length; i++) {
          const t = pool[i]
          if (!t.active || t.n < 2) continue
          ctx.moveTo(t.pts[0], t.pts[1])
          for (let p = 1; p < t.n; p++) {
            ctx.lineTo(t.pts[p * 2], t.pts[p * 2 + 1])
          }
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // ── Vignette — closes in on the logo through SETTLE ─────────
      // Drawn BEFORE the logo so the final bloom+fill is untouched.
      // `vignetteAlpha` is the closing progress (0 during BUILD, 0→1
      // smoothstep across SETTLE, 1 during RESOLVE/HOLD).
      if (vignetteAlpha > 0.01) {
        const outerR = lerp(VIGNETTE_OUTER_WIDE, VIGNETTE_OUTER_TIGHT, vignetteAlpha)
        const innerR = lerp(VIGNETTE_INNER_WIDE, VIGNETTE_INNER_TIGHT, vignetteAlpha)
        const endA = lerp(VIGNETTE_END_ALPHA_WIDE, VIGNETTE_END_ALPHA_TIGHT, vignetteAlpha)
        const vg = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
        vg.addColorStop(0, 'rgba(0,0,0,0)')
        vg.addColorStop(1, `rgba(0,0,0,${endA})`)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = vg
        ctx.fillRect(0, 0, size.width, size.height)
      }

      // ── Final white-fill with VHS/CRT phosphor bloom ────────────
      // Lifted from ChartLogoReveal's white-fill phase: three additive
      // blur passes stacked under a crisp source-over core fill, with
      // the glow leading the core by ~15% so the image reads as
      // "bloom first, shape solidifies after". `logoAlpha` is the
      // RESOLVE progress p ∈ [0, 1]; 1 during HOLD.
      if (logoAlpha > 0) {
        const fillP = logoAlpha
        const fillE = 1 - Math.pow(1 - fillP, 2.2)
        const glowP = Math.min(1, fillP / 0.85)
        const glowE = 1 - Math.pow(1 - glowP, 2)

        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'lighter'

        ctx.filter = `blur(${64 * size.dpr}px)`
        ctx.fillStyle = `rgba(255,255,255,${0.55 * glowE})`
        ctx.fill(logoBracket)
        ctx.fill(logoX)

        ctx.filter = `blur(${24 * size.dpr}px)`
        ctx.fillStyle = `rgba(255,255,255,${0.7 * glowE})`
        ctx.fill(logoBracket)
        ctx.fill(logoX)

        ctx.filter = `blur(${7 * size.dpr}px)`
        ctx.fillStyle = `rgba(255,255,255,${0.8 * glowE})`
        ctx.fill(logoBracket)
        ctx.fill(logoX)

        ctx.filter = 'none'
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = `rgba(255,255,255,${fillE})`
        ctx.fill(logoBracket)
        ctx.fill(logoX)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(scanTex, 0, 0)

      rafId = requestAnimationFrame(tick)
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !running) {
            running = true
            lastT = performance.now() // avoid a huge dt after pause
            rafId = requestAnimationFrame(tick)
          } else if (!entry.isIntersecting && running) {
            running = false
            if (rafId) cancelAnimationFrame(rafId)
          }
        }
      },
      { threshold: 0 },
    )
    io.observe(container)
    rafId = requestAnimationFrame(tick)

    return () => {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      io.disconnect()
    }
  }, [size.width, size.height, size.dpr])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      role="img"
      aria-label={`${ariaLabel} (root system)`}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
