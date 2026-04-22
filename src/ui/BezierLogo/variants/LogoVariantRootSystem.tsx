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
    const MASK = 256
    const mask = buildMaskPixels(MASK, MASK, 1.0)
    const maskScaleX = MASK / size.width
    const maskScaleY = MASK / size.height
    const isInside = (px: number, py: number): boolean => {
      const ix = (px * maskScaleX) | 0
      const iy = (py * maskScaleY) | 0
      if (ix < 0 || iy < 0 || ix >= MASK || iy >= MASK) return false
      return mask[(iy * MASK + ix) * 4 + 3] > 128
    }

    const cx = size.width / 2
    const cy = size.height / 2

    const { combined: logoPath } = buildLogoPaths(size.width, size.height, 1.0)

    // ─── Scanline + vignette (baked once) ──────────────────────────
    const tex = document.createElement('canvas')
    tex.width = size.width
    tex.height = size.height
    const tctx = tex.getContext('2d')
    if (tctx) {
      tctx.clearRect(0, 0, size.width, size.height)
      tctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
      const lineH = Math.max(1, size.dpr | 0)
      const step = 3 * size.dpr
      for (let y = 0; y < size.height; y += step) {
        tctx.fillRect(0, y, size.width, lineH)
      }
      const vg = tctx.createRadialGradient(
        cx,
        cy,
        Math.min(cx, cy) * 0.45,
        cx,
        cy,
        Math.max(cx, cy),
      )
      vg.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vg.addColorStop(1, 'rgba(0, 0, 0, 0.4)')
      tctx.fillStyle = vg
      tctx.fillRect(0, 0, size.width, size.height)
    }

    // ─── Sequence phases (ms) — one-shot, does not loop ────────────
    const BUILD_MS = 4200
    const SETTLE_MS = 700
    const RESOLVE_MS = 1500
    const T_BUILD = BUILD_MS
    const T_SETTLE = BUILD_MS + SETTLE_MS
    const T_RESOLVE = BUILD_MS + SETTLE_MS + RESOLVE_MS

    // ─── Tendril pool ──────────────────────────────────────────────
    const MAX_PTS = 220
    const MAX_TENDRILS = 180
    const SPAWN_TARGET = 160
    // Spawn rate ramps up through the build: number of tendrils that
    // should have spawned by progress p ∈ [0, 1] is SPAWN_TARGET·p² —
    // quadratic ease-in, so early seconds are sparse and the final
    // second rushes to fill.
    const spawnCurve = (p: number) => p * p

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

      const edge = (Math.random() * 4) | 0
      let x: number
      let y: number
      if (edge === 0) {
        x = Math.random() * size.width
        y = -4
      } else if (edge === 1) {
        x = size.width + 4
        y = Math.random() * size.height
      } else if (edge === 2) {
        x = Math.random() * size.width
        y = size.height + 4
      } else {
        x = -4
        y = Math.random() * size.height
      }
      const dx = cx - x
      const dy = cy - y
      const baseAng = Math.atan2(dy, dx)
      const ang = baseAng + (Math.random() - 0.5) * 0.9
      t.speed = (1.5 + Math.random() * 1.3) * size.dpr
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
      let tendrilAlpha = 1
      let logoAlpha = 0
      let shouldSpawn = false
      if (cycleElapsed < T_BUILD) {
        shouldSpawn = true
      } else if (cycleElapsed < T_SETTLE) {
        // Tendrils at full; no new spawns; individuals keep growing.
      } else if (cycleElapsed < T_RESOLVE) {
        const p = (cycleElapsed - T_SETTLE) / RESOLVE_MS
        tendrilAlpha = 1 - p
        logoAlpha = p
      } else {
        // HOLD — indefinite.
        tendrilAlpha = 0
        logoAlpha = 1
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
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = tendrilAlpha * 0.85
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.7 * size.dpr
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
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
      }

      if (logoAlpha > 0.01) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = logoAlpha
        ctx.fillStyle = '#ffffff'
        ctx.fill(logoPath)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(tex, 0, 0)

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
