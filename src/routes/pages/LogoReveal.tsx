import { useEffect, useRef, useState } from 'react'

import { CrtEffects } from '@/ui/CrtEffects'
import { buildLogoPaths } from '@/ui/BezierLogo/variants/maskUtils'

interface LogoRevealProps {
  onComplete: () => void
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Fullscreen landing intro. Plays the 5s scribble-and-logo-reveal video
 * (scribbles radiate in from the edges and resolve into the `()X` mark,
 * baked into a single MP4). Near video end, a canvas overlay paints the
 * same white phosphor logo fill used by ChartLogoReveal, so the final
 * lockup resolves to a bright branded mark on top of the footage.
 *
 * Timing:
 *   video running     MP4 playback + CRT texture
 *   near end          white logo bloom fades in over the video
 *   video ended       scrim fades (500ms), logo holds and settles
 *   +2000ms           onComplete fires, overlay begins fade-out (1500ms)
 *   +3500ms           overlay unmounts
 *
 * Respects prefers-reduced-motion: skips the video entirely and fires
 * onComplete synchronously.
 */
export function LogoReveal({ onComplete }: LogoRevealProps) {
  const [scrimVisible, setScrimVisible] = useState(true)
  // Flips true once the post-video hold ends — triggers the container's
  // opacity fade so the overlay crossfades out while the market card
  // slides up above it.
  const [handingOff, setHandingOff] = useState(false)
  const [mounted, setMounted] = useState(() => !prefersReducedMotion())
  const completedRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const logoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const logoRevealStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (!mounted) {
      if (!completedRef.current) {
        completedRef.current = true
        queueMicrotask(onComplete)
      }
      return
    }

    const video = videoRef.current
    const logoCanvas = logoCanvasRef.current
    const logoCtx = logoCanvas?.getContext('2d') ?? null

    const HOLD_AFTER_END_MS = 2000
    const FADE_OUT_MS = 1500
    const SAFETY_END_MS = 5400
    const LOGO_FADE_MS = 1100
    const LOGO_LEAD_SEC = 2.45
    const LOGO_ZOOM = 0.78
    const LOGO_OFFSET_X = 12
    const LOGO_OFFSET_Y = 12
    const LOGO_BRACKET_OFFSET_X = 8

    logoRevealStartRef.current = null
    let handoffTimer = 0
    let unmountTimer = 0
    let endFallbackTimer = 0
    let rafId = 0

    let width = 0
    let height = 0
    let dpr = 1
    let logoPaths: ReturnType<typeof buildLogoPaths> | null = null

    const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

    const startLogoReveal = (at = performance.now()) => {
      if (logoRevealStartRef.current !== null) return
      logoRevealStartRef.current = at
    }

    const resizeLogoCanvas = () => {
      if (!logoCanvas || !logoCtx) return
      const rect = logoCanvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, Math.floor(rect.width * dpr))
      height = Math.max(1, Math.floor(rect.height * dpr))
      logoCanvas.width = width
      logoCanvas.height = height
      logoPaths = buildLogoPaths(width, height, LOGO_ZOOM)
    }

    const drawOverlayLogo = (progress: number) => {
      if (!logoCtx || !logoPaths || width <= 0 || height <= 0) return
      logoCtx.clearRect(0, 0, width, height)
      if (progress <= 0) return

      const eased = ease(clamp01(progress))
      const fillE = 1 - Math.pow(1 - eased, 2.2)
      const glowP = Math.min(1, eased / 0.85)
      const glowE = 1 - Math.pow(1 - glowP, 2)
      const scale = 1.1 - eased * 0.1
      const cx = width / 2
      const cy = height / 2

      logoCtx.save()
      // Apply a true screen-space offset for the whole logo group.
      logoCtx.translate(LOGO_OFFSET_X * dpr, LOGO_OFFSET_Y * dpr)
      logoCtx.translate(cx, cy)
      logoCtx.scale(scale, scale)
      logoCtx.translate(-cx, -cy)

      logoCtx.globalCompositeOperation = 'lighter'

      const fillPair = () => {
        // Shift only the first glyph ("L"/bracket) right; keep X fixed.
        logoCtx.save()
        logoCtx.translate(LOGO_BRACKET_OFFSET_X * dpr, 0)
        logoCtx.fill(logoPaths.bracket)
        logoCtx.restore()
        logoCtx.fill(logoPaths.x)
      }

      logoCtx.filter = `blur(${64 * dpr}px)`
      logoCtx.fillStyle = `rgba(255,255,255,${0.55 * glowE})`
      fillPair()

      logoCtx.filter = `blur(${24 * dpr}px)`
      logoCtx.fillStyle = `rgba(255,255,255,${0.7 * glowE})`
      fillPair()

      logoCtx.filter = `blur(${7 * dpr}px)`
      logoCtx.fillStyle = `rgba(255,255,255,${0.8 * glowE})`
      fillPair()

      logoCtx.filter = 'none'
      logoCtx.globalCompositeOperation = 'source-over'
      logoCtx.fillStyle = `rgba(255,255,255,${fillE})`
      fillPair()

      logoCtx.restore()
    }

    const finish = () => {
      if (completedRef.current) return
      completedRef.current = true
      startLogoReveal()
      setScrimVisible(false)
      // Video's final frame is the fully-formed logo. Hold on it long
      // enough for the "paused" moment to read (scrim fade + logo hold)
      // before handing off, so the user has a beat to
      // register the logo before the market card rises over it.
      handoffTimer = window.setTimeout(() => {
        onComplete()
        setHandingOff(true)
        // Unmount once the opacity fade completes.
        unmountTimer = window.setTimeout(() => setMounted(false), FADE_OUT_MS)
      }, HOLD_AFTER_END_MS)
    }

    // Safety net — autoplay blocks or decode errors can leave onEnded
    // un-fired. 5400ms = video length (5s) + small buffer.
    endFallbackTimer = window.setTimeout(finish, SAFETY_END_MS)

    const onEnded = () => finish()
    video?.addEventListener('ended', onEnded)

    resizeLogoCanvas()
    window.addEventListener('resize', resizeLogoCanvas)

    const tick = (ts: number) => {
      if (video && logoRevealStartRef.current === null) {
        const dur = video.duration
        if (Number.isFinite(dur) && dur > 0) {
          const secsToEnd = dur - video.currentTime
          if (secsToEnd <= LOGO_LEAD_SEC) {
            startLogoReveal(ts - Math.max(0, (LOGO_LEAD_SEC - secsToEnd) * 1000))
          }
        }
      }

      const revealStart = logoRevealStartRef.current
      const revealP = revealStart === null ? 0 : clamp01((ts - revealStart) / LOGO_FADE_MS)
      drawOverlayLogo(revealP)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    // Kick playback explicitly — some browsers need this even with
    // autoplay+muted+playsInline (notably iOS after app-switch return).
    // Guard against replaying an already-ended video if this effect
    // re-runs for any reason (a non-memoized onComplete would cause
    // play() on an ended video to restart it from the beginning).
    if (video && !video.ended) {
      void video.play().catch(() => {
        // Ignore — the safety timer will advance the sequence.
      })
    }

    return () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(unmountTimer)
      window.clearTimeout(handoffTimer)
      window.clearTimeout(endFallbackTimer)
      video?.removeEventListener('ended', onEnded)
      window.removeEventListener('resize', resizeLogoCanvas)
    }
  }, [mounted, onComplete])

  if (!mounted) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[1000] bg-black transition-opacity duration-[1500ms] ease-out ${
        handingOff ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Video fills the viewport via object-cover. scale(1.5) zooms
          past the video's built-in black border so the scribble
          content reaches the viewport edges; blur(0.5px) softens the
          linework so it reads as tape signal rather than crisp vector. */}
      <video
        ref={videoRef}
        src="/levx-logo-reveal.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        style={{ transform: 'scale(1.5)', filter: 'blur(0.5px)' }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* ChartLogoReveal-style final white phosphor logo painted on top
          of the MP4 and faded in at the end of playback. */}
      <canvas
        ref={logoCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* CRT/VHS overlay — scanlines + VCR tracking noise painted as a
          sibling above the video (not a wrapper). Matches the settings
          ChartLogoReveal uses so the two intro variants feel visually
          consistent: wobble off (the frame stays rock-steady under the
          typewriter + card-rise animations that follow) and vcr
          opacity 0.12 for a touch more tape-texture density than the
          0.10 default. Adapted from Mobius1's ScreenEffect CodePen via
          the shared @/ui/CrtEffects component. */}
      <CrtEffects
        className="pointer-events-none absolute inset-0"
        wobble={false}
        vcr={{ opacity: 0.12, num: 56 }}
      />

      {/* Dither-scrim — 2×2 mask + backdrop blur + soft black tint; sits
          above the video. Fades at video end so the final logo frame
          reads crisply through the short hold before the handoff. */}
      <div
        className={`reveal-scrim transition-opacity duration-500 ease-out ${
          scrimVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
