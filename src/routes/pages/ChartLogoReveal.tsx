import { useEffect, useRef, useState } from 'react'
import { CrtEffects } from '@/ui/CrtEffects'
import { mulberry32, normalRandom } from '@/lib/rng'
import { BRACKET_CUBICS, X_CUBICS, type CubicSegment } from '@/ui/BezierLogo/geometry'
import { buildLogoPaths } from '@/ui/BezierLogo/variants/maskUtils'

interface ChartLogoRevealProps {
  onComplete: () => void
  /**
   * Tone-scan duration in ms — the five dashed prediction lines reveal
   * left → right simultaneously behind a sweeping clip mask. Heads of
   * all five stay aligned at the same x, giving a "scan bar" read that
   * is visually distinct from the white line's per-vertex snake that
   * follows.
   */
  toneScanMs?: number
  /** Snake-in duration in ms — white "live price" line draws left → right. */
  snakeMs?: number
  /** Morph duration in ms — all six lines converge into the logo silhouette. */
  morphMs?: number
  /** Hold duration in ms — crisp logo lingers before hand-off. */
  holdMs?: number
  /**
   * White-fill duration in ms — a solid white silhouette fades in over
   * the breathing outline in VHS/CRT style: stepped opacity quantization
   * plus occasional flicker dips and bright tape spikes. No dithering or
   * noise here — the CRT overlay handles that.
   */
  whiteFillMs?: number
  /**
   * When true, applies a cinematic 3D camera that trucks from an
   * angled low-close view during the scan phase to a flat orthogonal
   * view by the end of the snake phase. The transform is CSS-applied
   * to the canvas element (the CrtEffects overlay stays flat). Off by
   * default — the camera is distinct enough visually that it reads as
   * a separate intro variant; we toggle it in at the landing-page
   * level rather than making it part of the base reveal.
   */
  cameraTransform?: boolean
}

/**
 * Time-driven intro playback, four phases:
 *   1. Tone-scan (toneScanMs) — the five jagged dashed "chart lines"
 *      (LevXChart's TONE_STYLES palette: greens/yellow/reds, anchored
 *      off-screen left) reveal left → right simultaneously behind a
 *      sweeping clip rect. All five heads stay aligned on the scan x,
 *      reading as a single scan pass that reveals the probability
 *      fan at once.
 *   2. Snake (snakeMs) — a solid white "live price" line draws in from
 *      the left edge on top of the already-revealed tone fan, with a
 *      white head dot tracking its leading vertex — the realized
 *      trajectory being written atop the predictions.
 *   3. Morph (morphMs) — all six lines (five tone-coloured predictions
 *      + the white realized path) converge simultaneously into the
 *      bezier logo silhouette. Additively blended so the tone-coloured
 *      outlines stack into a brand-tinted mark; the white outline
 *      boosts the silhouette toward crisp. The head dot fades + drops
 *      as the morph begins.
 *   4. Hold (holdMs) — crisp logo silhouette holds static.
 *   5. White-fill (whiteFillMs) — CRT bloom fade-in of a solid white
 *      silhouette over the outline; outlines cross-fade out.
 *   Hand-off — onComplete fires (market card begins its rise), then the
 *   overlay unmounts silently behind the rising card.
 *
 * prefers-reduced-motion: skips the playback and fires onComplete synchronously.
 */

// Resolved once at module load so component render stays pure — avoids
// triggering setState-in-effect during the reduced-motion bail-out.
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ChartLogoReveal({
  onComplete,
  toneScanMs = 800,
  snakeMs = 4000,
  morphMs = 1000,
  holdMs = 300,
  whiteFillMs = 2000,
  cameraTransform = false,
}: ChartLogoRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Lazy initializer — if the user prefers reduced motion we skip the
  // overlay entirely (never rendered) and hand off to the caller from a
  // paint-free effect below.
  const [mounted, setMounted] = useState(() => !prefersReducedMotion())
  const completedRef = useRef(false)

  useEffect(() => {
    if (!mounted) {
      // Reduced-motion path: fire onComplete on next tick so callers'
      // setState in response doesn't collide with our mount cycle.
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
    // Filled silhouette paths, rebuilt on resize so the VHS white-fill
    // phase can paint them cheaply each frame via ctx.fill(path). Zoom
    // 0.62 matches the stroke path's `logoScale` factor below.
    let logoPaths: ReturnType<typeof buildLogoPaths> | null = null

    const resize = () => {
      const rect = container.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, Math.floor(rect.width * dpr))
      height = Math.max(1, Math.floor(rect.height * dpr))
      canvas.width = width
      canvas.height = height
      logoPaths = buildLogoPaths(width, height, 0.62)
    }
    resize()
    window.addEventListener('resize', resize)

    // Sample K points along a sequence of cubic Bezier segments, using the
    // segment-index parameter (not arclength). Segments in the logo are
    // roughly similar length so the visual spacing reads uniformly.
    const sampleBezier = (segments: readonly CubicSegment[], k: number): Float32Array => {
      const pts = new Float32Array(k * 2)
      const n = segments.length
      for (let i = 0; i < k; i++) {
        const fidx = (i / (k - 1)) * n
        const segIdx = Math.min(n - 1, Math.floor(fidx))
        const t = Math.min(1, fidx - segIdx)
        const s = segments[segIdx]
        const mt = 1 - t
        const mt2 = mt * mt
        const t2 = t * t
        pts[i * 2] = mt2 * mt * s[0] + 3 * mt2 * t * s[2] + 3 * mt * t2 * s[4] + t2 * t * s[6]
        pts[i * 2 + 1] = mt2 * mt * s[1] + 3 * mt2 * t * s[3] + 3 * mt * t2 * s[5] + t2 * t * s[7]
      }
      return pts
    }

    // K sets the polyline resolution. 100 gives the chunky per-segment
    // jaggedness of a real low-frequency GBM trajectory (each step is a
    // visible tick, matching the chart reference). The white snake line
    // still glides smoothly between vertices because its head is drawn
    // at a sub-vertex interpolated position.
    const K = 100
    const bracketPts = sampleBezier(BRACKET_CUBICS, K)
    const xPts = sampleBezier(X_CUBICS, K)

    // Five tone-coloured prediction lines lifted from LevXChart.TONE_STYLES.
    // Alphas tuned for the `lighter` blend mode — at >0.6 the brand green
    // (#5CF78B, B=139) saturates its green channel before its blue channel
    // under overlap, pushing greens cyan. Capped so bracket+X self-overlap
    // per line plus cross-line overlap at the left anchor stays within
    // channel budget.
    const LINES = [
      {
        color: [0x5c, 0xf7, 0x8b],
        dash: [5, 4],
        alpha: 0.55,
        drift: 0.0016,
        vol: 0.012,
        walkSeed: 1,
      },
      {
        color: [0x5c, 0xf7, 0x8b],
        dash: [4, 4],
        alpha: 0.38,
        drift: 0.0008,
        vol: 0.01,
        walkSeed: 2,
      },
      {
        color: [0xf6, 0xce, 0x48],
        dash: [2, 4],
        alpha: 0.55,
        drift: 0.0,
        vol: 0.0085,
        walkSeed: 3,
      },
      {
        color: [0xff, 0x48, 0x3b],
        dash: [4, 4],
        alpha: 0.38,
        drift: -0.0008,
        vol: 0.01,
        walkSeed: 4,
      },
      {
        color: [0xff, 0x48, 0x3b],
        dash: [5, 4],
        alpha: 0.55,
        drift: -0.0016,
        vol: 0.012,
        walkSeed: 5,
      },
    ] as const

    // Pre-compute deterministic GBM walks per line. Each walk is K log-
    // return samples cumulated from 0 — drift * i ± vol * sqrt(i) shape.
    const buildWalk = (seed: number, drift: number, vol: number): Float32Array => {
      const rng = mulberry32(seed * 7919 + 42)
      const walk = new Float32Array(K)
      let cum = 0
      walk[0] = 0
      for (let i = 1; i < K; i++) {
        cum += drift + vol * normalRandom(rng)
        walk[i] = cum
      }
      return walk
    }
    const walks = LINES.map((l) => buildWalk(l.walkSeed, l.drift, l.vol))
    // White "live price" walk — neutral drift, meaningfully higher vol so
    // it reads as a lively realized path riding through the calmer
    // predictions. Separate seed so it doesn't trace any of the coloured
    // lines.
    const whiteWalk = buildWalk(420, 0.0003, 0.022)

    // Cubic ease-in-out — soft ramp at both ends.
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

    const start = performance.now()
    let rafId = 0
    const tick = (t: number) => {
      const elapsed = t - start
      // Phase progress variables. Phase offsets stack: scan → snake →
      // morph → hold → fill. `elapsed` is measured from mount; each
      // sub-phase's local elapsed is derived by subtracting all
      // preceding phase durations.
      const scanP = Math.max(0, Math.min(1, elapsed / toneScanMs))
      const snakeP = Math.max(0, Math.min(1, (elapsed - toneScanMs) / snakeMs))
      const snakeE = ease(snakeP)
      const morphElapsed = elapsed - toneScanMs - snakeMs
      const morphP = Math.max(0, Math.min(1, morphElapsed / morphMs))
      const morphE = ease(morphP)

      // Hand-off once scan + snake + morph + hold + whiteFill have
      // all elapsed. Firing onComplete after whiteFill finishes means
      // the market card rise overlaps a fully-solidified white logo
      // rather than the outlines alone — the tail the user sees under
      // the rising card is the VHS-solid mark.
      if (
        elapsed >= toneScanMs + snakeMs + morphMs + holdMs + whiteFillMs &&
        !completedRef.current
      ) {
        completedRef.current = true
        onComplete()
        window.setTimeout(() => setMounted(false), 1950)
      }

      // Cinematic camera (opt-in via `cameraTransform`). A virtual 3D
      // camera trucks out from an angled low-close view (near the scan
      // origin at the plane's left edge, looking across toward where
      // the lines are going) to a flat orthogonal view by the end of
      // the snake phase. Driven by snakeP so the pan-back syncs with
      // the white live-price line drawing in — by the time the snake
      // reaches the right edge, the camera has settled flat. Applied
      // as a CSS 3D transform on the canvas element (the CrtEffects
      // sibling overlay stays flat so it reads as a CRT display
      // showing a tilted 3D scene). The compositor transforms the
      // already-rasterized 2D canvas texture — no per-point projection
      // needed inside the draw loop.
      if (cameraTransform) {
        // Starting pose puts the camera on the LEFT (at the lines'
        // origin point), looking across toward the destination on the
        // right. +rotateX tilts the plane toward edge-on; +rotateY
        // swings the left edge close to the viewer and the right edge
        // into vanishing distance.
        //
        // `translateX` slides the camera along +X as the pan plays —
        // at cameraP=0 the plane sits offset in view space (camera is
        // left of origin, so origin appears to the right of its view
        // centre), easing to 0 at cameraP=1. Placed BEFORE the
        // rotations in the transform string (to the LEFT, so it's
        // applied AFTER them mathematically) — that way the slide
        // happens in world/viewport coords rather than along the
        // rotated plane's local X axis, which would otherwise drift
        // the camera across the plane surface instead of across the
        // viewport.
        //
        // CAMERA_PAN_DELAY holds the camera at its starting pose for
        // the first fraction of the snake phase, so the white live-
        // price line has time to establish itself against the static
        // tilted chart before the camera begins trucking back. Beyond
        // the delay, cameraP ramps 0→1 over the REMAINDER of the
        // snake phase and still lands at the flat final pose exactly
        // when the morph begins.
        const CAMERA_PAN_DELAY = 0.15
        const cameraP = Math.max(
          0,
          Math.min(1, (snakeP - CAMERA_PAN_DELAY) / (1 - CAMERA_PAN_DELAY)),
        )
        const cameraInv = 1 - ease(cameraP)
        const tx = 160 * cameraInv
        const rx = 5 * cameraInv
        const ry = 40 * cameraInv
        const tz = 200 * cameraInv
        canvas.style.transform = `translateX(${tx}px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${tz}px)`
      }

      ctx.clearRect(0, 0, width, height)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.globalCompositeOperation = 'lighter'

      const cx = width / 2
      const cy = height / 2

      // Logo fills a comfortable fraction of the shortest viewport dim.
      const logoScale = (Math.min(width, height) / 2) * 0.62

      // Exact bezier silhouette — used for the morph crossfade target
      // and the static hold. Anchors (segment endpoints) are shared
      // across adjacent segments so the closure is automatic.
      const traceLogo = (segments: readonly CubicSegment[]) => {
        const s0 = segments[0]
        ctx.moveTo(cx + s0[0] * logoScale, cy - s0[1] * logoScale)
        for (let k = 0; k < segments.length; k++) {
          const s = segments[k]
          ctx.bezierCurveTo(
            cx + s[2] * logoScale,
            cy - s[3] * logoScale,
            cx + s[4] * logoScale,
            cy - s[5] * logoScale,
            cx + s[6] * logoScale,
            cy - s[7] * logoScale,
          )
        }
        ctx.closePath()
      }
      // Chart lines start off-screen left (anchorX < 0) and run to near
      // the right edge. Anchoring off-screen lets the leading head of
      // the snake-in white line arrive from outside the viewport rather
      // than popping into existence at the left margin.
      const anchorX = -width * 0.12
      const lineEndX = width * 0.97
      const lineSpanW = lineEndX - anchorX
      const walkYScale = Math.min(height * 1.6, logoScale * 6.5)
      // Crossfade between the polyline (chart-line lerp approximation)
      // and the exact bezier silhouette over the last 15% of the morph.
      // Without this, switching renderers in a single frame produces a
      // visible "snap" as the K=100 chord approximation pulls onto the
      // true curve — most obvious on tight segments (bracket's seg 8,
      // X's inner corners) where the chord cuts ~2–3 px inside the
      // curve. Additive blend means polyAlpha + bezierAlpha can stay
      // at 1 throughout, so total brightness is preserved.
      const blend = morphP < 0.85 ? 0 : Math.min(1, (morphP - 0.85) / 0.15)
      // White head dot: alpha 1 during snake, fades + drops during the
      // first ~40% of morph, then gone. The drop is a small downward
      // translation that scales with morphP² — reads as the marker
      // losing its anchor and falling as the line dissolves.
      const dotFade = Math.max(0, 1 - Math.min(1, morphP / 0.4))
      const dotDrop = morphP * morphP * (height * 0.08)

      // White-fill phase progress — also drives the outline fade-out
      // below so the tone-coloured lines + white breathing outline
      // dissolve as the glowing white silhouette comes in. Outlines
      // linger through the first ~10% of the fill, then ramp to zero
      // by ~60%, leaving the final stretch purely on the glowing fill.
      const fillElapsed = Math.max(0, elapsed - toneScanMs - snakeMs - morphMs - holdMs)
      const fillP = Math.max(0, Math.min(1, fillElapsed / whiteFillMs))
      const outlineFade = fillP < 0.1 ? 1 : Math.max(0, 1 - ease(Math.min(1, (fillP - 0.1) / 0.5)))

      // --- Draw the five tone-coloured prediction lines. --------------
      // Scan-reveal: during the toneScan phase the tone lines are drawn
      // under a clip rect that sweeps 0 → width, so all five lines
      // appear to reveal simultaneously from left to right with their
      // heads aligned on the scan x. Easing the scan gives a slight
      // build-up + settle at each end rather than a mechanically-linear
      // sweep. Once scanP reaches 1 the clip is skipped entirely.
      const scanClipped = scanP < 1
      if (scanClipped) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, ease(scanP) * width, height)
        ctx.clip()
      }
      for (let i = 0; i < LINES.length; i++) {
        const line = LINES[i]
        const walk = walks[i]

        ctx.lineWidth = (2.6 + 0.8 * morphE) * dpr

        // Dash: chunky during snake/early morph, tightens as the line
        // settles into the logo.
        const dashK = 1 - 0.7 * morphE
        const dashPattern: [number, number] = [
          line.dash[0] * dpr * (1 + dashK * 2.5),
          line.dash[1] * dpr * (1 + dashK * 2.5),
        ]
        ctx.lineDashOffset = -((elapsed * 0.06 * (1 - 0.85 * morphE)) % 1000)

        const crispStyle = `rgba(${line.color[0]},${line.color[1]},${line.color[2]},${line.alpha})`

        const drawMorph = (endPts: Float32Array, segments: readonly CubicSegment[]) => {
          // Early-out: once the white-fill phase has fully hidden the
          // outlines, skip stroking them entirely. Saves work without
          // changing the visual (alpha would be 0 anyway).
          if (outlineFade <= 0) return

          // Each stroke section is rendered twice: first as a SOLID
          // undashed stroke run through `ctx.filter = blur(...)` to
          // emit a continuous phosphor halo (shadowBlur is unreliable
          // on dashed strokes in Chromium — the shadow silently drops
          // or renders per-dash-segment at collapsed alpha), then as
          // the crisp dashed stroke on top with filter off. The
          // undashed halo reads as a smooth colored bleed while the
          // dashed pass keeps the dot pattern. composite is already
          // `lighter`, so the halo accumulates where lines overlap.
          const strokePair = () => {
            // Halo pass.
            ctx.setLineDash([])
            ctx.filter = `blur(${10 * dpr}px)`
            ctx.strokeStyle = crispStyle
            ctx.stroke()
            // Crisp pass.
            ctx.filter = 'none'
            ctx.setLineDash(dashPattern)
            ctx.strokeStyle = crispStyle
            ctx.stroke()
          }

          // Polyline (chart-line → bezier-sample lerp). Fades out as
          // blend rises from 0 → 1 over the morph's last 15%.
          if (blend < 1) {
            ctx.globalAlpha = (1 - blend) * outlineFade
            ctx.beginPath()
            for (let k = 0; k < K; k++) {
              const u = k / (K - 1)
              const chartX = anchorX + u * lineSpanW
              const chartY = cy - walk[k] * walkYScale
              const ex = endPts[k * 2]
              const ey = endPts[k * 2 + 1]
              const bigX = cx + ex * logoScale
              const bigY = cy - ey * logoScale
              const x = chartX + (bigX - chartX) * morphE
              const y = chartY + (bigY - chartY) * morphE
              if (k === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            strokePair()
          }
          // Exact bezier silhouette — the target the polyline fades
          // into over the morph's last 15%. Static once drawn; no
          // perturbation, so the hold phase reads as a crisp logo
          // outline rather than a breathing one.
          if (blend > 0) {
            ctx.globalAlpha = blend * outlineFade
            ctx.beginPath()
            traceLogo(segments)
            strokePair()
          }
          ctx.globalAlpha = 1
        }
        drawMorph(bracketPts, BRACKET_CUBICS)
        drawMorph(xPts, X_CUBICS)
      }
      if (scanClipped) ctx.restore()

      // --- Draw the white "live price" line. --------------------------
      // Hidden entirely during the tone-scan phase so the reveal reads
      // as tone-only first, then the realized white path.
      if (elapsed >= toneScanMs) {
        // During snake (morphP === 0): only the portion from k=0 to the
        // sub-vertex head is drawn — full vertices up to headKInt, then
        // one lerped sub-segment to the interpolated head position so the
        // tail (and dot) glide smoothly between discrete GBM vertices
        // rather than teleporting on each K-step. During morph: full line
        // rendered and interpolated toward the logo silhouette along with
        // the others; dot fades and drops.
        const whiteLineWidth = (3.6 + 0.8 * morphE) * dpr
        // Slight alpha taper so the boosted white outline doesn't flatten
        // the tone colours at peak overlap.
        const whiteAlpha = 0.9 - 0.25 * morphE
        ctx.strokeStyle = `rgba(255,255,255,${whiteAlpha})`
        ctx.lineWidth = whiteLineWidth
        // White-phosphor halo. The white line is solid (no dash), so we
        // can use the cheaper single-pass shadowBlur here — the tone
        // lines need a filter-based 2-pass workaround because Chromium
        // doesn't reliably emit shadows on dashed strokes.
        ctx.shadowColor = 'rgba(255,255,255,0.85)'
        ctx.shadowBlur = 16 * dpr
        // Solid — this is the realized path, not a prediction; no dash.
        ctx.setLineDash([])

        // Float head index — head travels continuously across the K
        // vertices rather than snapping to integer k. During morph it's
        // pinned to the final vertex (headKFrac === 0).
        const headKFloat = morphP > 0 ? K - 1 : snakeE * (K - 1)
        const headKInt = Math.min(K - 1, Math.floor(headKFloat))
        const headKFrac = Math.max(0, headKFloat - headKInt)

        const whitePosAt = (k: number, endPts: Float32Array): [number, number] => {
          const u = k / (K - 1)
          const chartX = anchorX + u * lineSpanW
          const chartY = cy - whiteWalk[k] * walkYScale
          const ex = endPts[k * 2]
          const ey = endPts[k * 2 + 1]
          const bigX = cx + ex * logoScale
          const bigY = cy - ey * logoScale
          return [chartX + (bigX - chartX) * morphE, chartY + (bigY - chartY) * morphE]
        }
        // Interpolated position at a float k — lerps between discrete
        // vertex positions so the snake head and its trailing tail segment
        // travel smoothly frame-to-frame.
        const whitePosAtFloat = (kf: number, endPts: Float32Array): [number, number] => {
          const ki = Math.min(K - 1, Math.floor(kf))
          const kn = Math.min(K - 1, ki + 1)
          const kr = kf - ki
          const [x0, y0] = whitePosAt(ki, endPts)
          if (kr <= 0 || ki === kn) return [x0, y0]
          const [x1, y1] = whitePosAt(kn, endPts)
          return [x0 + (x1 - x0) * kr, y0 + (y1 - y0) * kr]
        }

        const drawWhite = (endPts: Float32Array, segments: readonly CubicSegment[]) => {
          if (outlineFade <= 0) return
          // Polyline (fades out through the morph's last 15%). During
          // snake this also handles the sub-vertex head glide.
          if (blend < 1) {
            ctx.globalAlpha = (1 - blend) * outlineFade
            ctx.beginPath()
            for (let k = 0; k <= headKInt; k++) {
              const [x, y] = whitePosAt(k, endPts)
              if (k === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            if (headKFrac > 0 && headKInt < K - 1) {
              const [hx, hy] = whitePosAtFloat(headKFloat, endPts)
              ctx.lineTo(hx, hy)
            }
            ctx.stroke()
          }
          // Exact bezier silhouette — the static target the polyline
          // resolves into during the morph crossfade.
          if (blend > 0) {
            ctx.globalAlpha = blend * outlineFade
            ctx.beginPath()
            traceLogo(segments)
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        }
        drawWhite(bracketPts, BRACKET_CUBICS)
        drawWhite(xPts, X_CUBICS)

        // White head dot — sized like a chart current-price marker. Drawn
        // in source-over (not additive) so it reads as a solid disc even
        // over the bright line; surrounding strokes stay additive.
        if (dotFade > 0) {
          const [headX, headY] = whitePosAtFloat(headKFloat, bracketPts)
          ctx.globalCompositeOperation = 'source-over'
          // Larger shadowBlur than the strokes so the dot reads as the
          // brightest phosphor point on screen — a focused live-price
          // marker against the duller predictions.
          ctx.shadowColor = `rgba(255,255,255,${dotFade * 0.95})`
          ctx.shadowBlur = 22 * dpr
          ctx.fillStyle = `rgba(255,255,255,${dotFade})`
          ctx.beginPath()
          ctx.arc(headX, headY + dotDrop, 5 * dpr, 0, Math.PI * 2)
          ctx.fill()
          // Soft inner halo — retained in addition to the shadowBlur so
          // the dot has a crisp bright rim before the shadow takes over.
          ctx.fillStyle = `rgba(255,255,255,${dotFade * 0.25})`
          ctx.beginPath()
          ctx.arc(headX, headY + dotDrop, 10 * dpr, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalCompositeOperation = 'lighter'
        }
      } // end of: if (elapsed >= toneScanMs) — white line + dot

      ctx.setLineDash([])
      ctx.globalCompositeOperation = 'source-over'
      // Shadow state persists across draws; clear it before the white-
      // fill phase so its filter-based bloom isn't double-halo'd by a
      // stale shadowBlur from the last tone stroke.
      ctx.shadowBlur = 0

      // --- White-fill phase: old VHS/CRT on-screen-text glow reveal. ---
      // Solid white silhouette that slowly fades in behind an
      // excessive phosphor bloom — the kind of wide, soft glow that
      // old VHS title cards have where the halo leaks far beyond the
      // letterforms before the crisp shape resolves. Three additive
      // blur passes stacked under a source-over core fill:
      //   outer halo  — wide blur, moderate alpha → ambient bleed into
      //                 the surrounding black
      //   mid halo    — medium blur, higher alpha → the characteristic
      //                 soft fringe hugging the shape
      //   inner glow  — tight blur → the bright rim where phosphor is
      //                 near saturation
      //   crisp core  — source-over so the solid interior fully
      //                 occludes the faded-out outlines once fillP=1
      // The glow alpha is driven by `glowE`, the core by `fillE`; the
      // glow slightly precedes the core so the image reads as "bloom
      // first, shape solidifies after" — matches how magnetic-tape
      // luma blooms outward before the signal settles. No flicker,
      // no dithering — CRT overlay handles tape texture.
      if (fillP > 0 && logoPaths) {
        // Ease-out on the core — rapid brightness uptake at the start
        // of the phase, long slow settle toward full.
        const fillE = 1 - Math.pow(1 - fillP, 2.2)
        // Glow leads the core by ~15% — already at ~75% intensity when
        // the crisp fill is only ~55%.
        const glowP = Math.min(1, fillP / 0.85)
        const glowE = 1 - Math.pow(1 - glowP, 2)

        ctx.globalCompositeOperation = 'lighter'

        // Outer halo — extra-wide blur. Blur radii are expressed in
        // canvas pixels and scaled by `dpr` so the CSS-space halo
        // size stays constant across display densities.
        ctx.filter = `blur(${64 * dpr}px)`
        ctx.fillStyle = `rgba(255,255,255,${0.55 * glowE})`
        ctx.fill(logoPaths.bracket)
        ctx.fill(logoPaths.x)

        // Mid halo — the main "soft text edge" pass.
        ctx.filter = `blur(${24 * dpr}px)`
        ctx.fillStyle = `rgba(255,255,255,${0.7 * glowE})`
        ctx.fill(logoPaths.bracket)
        ctx.fill(logoPaths.x)

        // Tight fringe — a few CSS pixels of blur for the bright
        // near-edge rim.
        ctx.filter = `blur(${7 * dpr}px)`
        ctx.fillStyle = `rgba(255,255,255,${0.8 * glowE})`
        ctx.fill(logoPaths.bracket)
        ctx.fill(logoPaths.x)

        // Crisp core. source-over so the final solid white interior
        // fully covers any residual outline underneath once fillE=1.
        ctx.filter = 'none'
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = `rgba(255,255,255,${fillE})`
        ctx.fill(logoPaths.bracket)
        ctx.fill(logoPaths.x)
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [mounted, onComplete, toneScanMs, snakeMs, morphMs, holdMs, whiteFillMs, cameraTransform])

  if (!mounted) return null

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-[1000] overflow-hidden bg-black"
      // Perspective is set as a CSS property on the parent rather than
      // as a `perspective()` function inside the canvas's transform.
      // With the function form, some browsers fold translateX into the
      // projection in a way that zeroes out its screen-space effect
      // (visible motion from rotateX/Y but no lateral camera slide).
      // Parent-level `perspective` establishes a proper 3D viewing
      // context so translate/rotate on the child composite as expected.
      // Omitted when cameraTransform is off so non-ChartCam variants
      // don't incur the 3D-context cost.
      style={cameraTransform ? { perspective: '1200px' } : undefined}
    >
      {/* The CRT scanlines + VCR noise are layered as a SIBLING overlay
          rather than wrapping the canvas. Wrapping placed the canvas
          inside `.crt-inner.crt-wobble`, which applies a 100ms
          `translateY(1px)` transform to the subtree — browsers re-
          rasterize the whole canvas layer on every transform tick, which
          fights this component's own 60fps render loop and can suppress
          the effect visually. Sibling layering keeps the canvas on its
          own compositor layer and floats the CRT overlay on top via
          pointer-events-none. Wobble is disabled here for the same
          reason — the chart already has its own motion; the scanlines
          + noise carry the CRT read on their own. */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          // Match the RAF loop's snakeP=0 pose so the canvas paints
          // at the starting angular camera on its very first frame,
          // before the first rAF tick overwrites `transform` with the
          // same value. Without this the first paint briefly renders
          // flat and then snaps into the tilt on the next frame.
          // Omitted entirely when cameraTransform is off so the canvas
          // isn't promoted to its own compositor layer for no reason.
          ...(cameraTransform && {
            // Must match the RAF loop's snakeP=0 pose so the first
            // frame paints at the starting pose — otherwise there's a
            // one-frame snap when RAF takes over. Perspective lives on
            // the parent container now, so it's not included here.
            transform: 'translateX(160px) rotateX(5deg) rotateY(40deg) translateZ(200px)',
            transformOrigin: '50% 50%',
            willChange: 'transform',
          }),
        }}
      />
      <CrtEffects
        className="pointer-events-none absolute inset-0"
        wobble={false}
        vcr={{ opacity: 0.12, num: 56 }}
      />
    </div>
  )
}
