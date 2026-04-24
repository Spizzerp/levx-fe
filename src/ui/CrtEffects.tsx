import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import './CrtEffects.css'

interface CrtEffectsProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** Horizontal 2px scanline overlay + 3px RGB chroma bands. */
  scanlines?: boolean
  /** 100ms 1px Y-jitter, simulates a slightly unsteady CRT frame. */
  wobble?: boolean
  /**
   * VCR tracking noise on a canvas overlay. `false` disables the whole
   * layer. A config object tunes opacity, density, and band placement.
   */
  vcr?: false | VcrConfig
}

interface VcrConfig {
  /** Alpha of the noise canvas as a whole (0–1). */
  opacity?: number
  /** Gaussian blur on the noise canvas in pixels. */
  blur?: number
  /** Number of dot+tail pairs drawn per frame — higher reads as "older tape". */
  num?: number
  /**
   * Top band start, as a fraction of canvas height (0–1). The band's
   * starting y increments by 3px/dot within the frame, so this is the
   * lower bound of the first dot and the visual "peak" of the tear.
   */
  topBand?: number
  /**
   * Bottom band start (as a fraction of canvas height). Dots are drawn
   * in `[0, bottomBand*height]` with the upper bound decreasing by 3px/dot.
   */
  bottomBand?: number
}

const DEFAULT_VCR: Required<VcrConfig> = {
  opacity: 0.1,
  blur: 1,
  num: 56,
  // 173.2/360 and 227/360 — the CodePen's hand-tuned tracking/tape-age
  // values for a 640×360 canvas, converted to canvas-height fractions so
  // the bands land in the same relative spot on any viewport.
  topBand: 0.481,
  bottomBand: 0.63,
}

function getRandomInt(min: number, max: number) {
  const lo = Math.ceil(min)
  const hi = Math.floor(max)
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

function renderTail(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const n = getRandomInt(1, 50)
  const dir = Math.random() < 0.5 ? -1 : 1
  let rd = radius
  let r = radius
  for (let i = 0; i < n; i++) {
    const step = 0.01
    rd -= step
    r = getRandomInt(rd, radius)
    const dx = getRandomInt(1, 4) * dir
    radius -= 0.1
    x += dx
    ctx.fillRect(x, y, r, r)
    ctx.fill()
  }
}

function renderTrackingNoise(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: Required<VcrConfig>,
) {
  const radius = 2
  let posy1 = config.topBand * height
  const posy2 = height
  let posy3 = config.bottomBand * height

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.beginPath()

  for (let i = 0; i <= config.num; i++) {
    const x = Math.random() * width
    // Mirror the CodePen's in-loop mutation of posy1/posy3 — the bands
    // sweep downward/upward across the frame as dots accumulate, which
    // is what gives each frame its diagonal "tear" feel rather than a
    // flat horizontal strip.
    const y1 = getRandomInt((posy1 += 3), posy2)
    const y2 = getRandomInt(0, (posy3 -= 3))
    ctx.fillRect(x, y1, radius, radius)
    ctx.fillRect(x, y2, radius, radius)
    ctx.fill()
    renderTail(ctx, x, y1, radius)
    renderTail(ctx, x, y2, radius)
  }
  ctx.closePath()
}

/**
 * CRT/VHS screen overlay, adapted from Mobius1's ScreenEffect CodePen
 * (ZNgwbr). Wraps any visual child (video, image, iframe…) and stacks
 * scanlines, VCR tracking noise, and a subtle wobble on top of it to
 * sell the "worn tape on a CRT" read.
 *
 * Only the effects we actually use are ported — no snow, roll, vignette,
 * or turn-on/turn-off shader. Canvas is sized to the container rect and
 * re-measures on viewport resize. The tracking-noise RAF loop pauses
 * under prefers-reduced-motion, drawing a single static frame instead
 * of the 60fps animation.
 */
export function CrtEffects({
  children,
  className,
  style,
  scanlines = true,
  wobble = true,
  vcr = {},
}: CrtEffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const vcrConfig: Required<VcrConfig> | null = vcr === false ? null : { ...DEFAULT_VCR, ...vcr }

  useEffect(() => {
    if (!vcrConfig) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0

    const resize = () => {
      const rect = container.getBoundingClientRect()
      // Bail on zero-sized containers (the hero briefly measures 0 during
      // intro mount) — drawing into a 0-dim canvas throws in some browsers.
      if (rect.width === 0 || rect.height === 0) return
      canvas.width = Math.floor(rect.width)
      canvas.height = Math.floor(rect.height)
    }

    resize()

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      // Static frame so the effect still reads, just without the strobe.
      renderTrackingNoise(ctx, canvas.width, canvas.height, vcrConfig)
    } else {
      const loop = () => {
        renderTrackingNoise(ctx, canvas.width, canvas.height, vcrConfig)
        rafId = requestAnimationFrame(loop)
      }
      loop()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    window.addEventListener('resize', resize)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('resize', resize)
    }
    // DEFAULT_VCR spread turns into a new object each render — stringify
    // the resolved config so the effect only re-subscribes on real changes.
  }, [vcrConfig ? JSON.stringify(vcrConfig) : null]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className={cn('crt-root', className)} style={style}>
      <div className={cn('crt-inner', wobble && 'crt-wobble')}>
        {children}
        {vcrConfig && (
          <canvas
            ref={canvasRef}
            className="crt-vcr"
            style={{
              opacity: vcrConfig.opacity,
              filter: `blur(${vcrConfig.blur}px)`,
            }}
            aria-hidden="true"
          />
        )}
        {scanlines && <div className="crt-scanlines" aria-hidden="true" />}
      </div>
    </div>
  )
}
