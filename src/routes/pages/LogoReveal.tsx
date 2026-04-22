import { useEffect, useRef, useState } from 'react'

import { CrtEffects } from '@/ui/CrtEffects'

interface LogoRevealProps {
  onComplete: () => void
}

/**
 * Fullscreen landing intro. Plays the 5s scribble-and-logo-reveal video
 * (scribbles radiate in from the edges and resolve into the `()X` mark,
 * baked into a single MP4). When the video ends the dither-scrim fades,
 * the final logo frame holds briefly, then onComplete fires and the
 * whole overlay crossfades out while the caller's market card slides
 * up on top of it (the market wrapper is z-above this overlay, so it
 * specifically covers the logo as it rises).
 *
 * Timing:
 *   0.0s  video starts (scrim on top of video)
 *   5.0s  video ends → scrim fades (500ms)
 *   5.8s  onComplete fires, overlay begins fading (1500ms)
 *   7.3s  overlay unmounts
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
  const [mounted, setMounted] = useState(true)
  const completedRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setMounted(false)
      onComplete()
      return
    }

    const finish = () => {
      if (completedRef.current) return
      completedRef.current = true
      setScrimVisible(false)
      // Video's final frame is the fully-formed logo. Hold on it long
      // enough for the "paused" moment to read (scrim fade 500ms + logo
      // pause ~1500ms) before handing off, so the user has a beat to
      // register the logo before the market card rises over it.
      window.setTimeout(() => {
        onComplete()
        setHandingOff(true)
        // Unmount once the opacity fade completes.
        window.setTimeout(() => setMounted(false), 1500)
      }, 2000)
    }

    // Safety net — autoplay blocks or decode errors can leave onEnded
    // un-fired. 5400ms = video length (5s) + small buffer.
    const endFallbackTimer = window.setTimeout(finish, 5400)

    const video = videoRef.current
    const onEnded = () => finish()
    video?.addEventListener('ended', onEnded)
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
      window.clearTimeout(endFallbackTimer)
      video?.removeEventListener('ended', onEnded)
    }
  }, [onComplete])

  if (!mounted) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[1000] bg-black transition-opacity duration-[1500ms] ease-out ${
        handingOff ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* CRT/VHS wrapper — adds scanlines, VCR tracking noise, and a
          subtle wobble over the scribble video so the intro reads as a
          worn tape playing on an old monitor. Adapted from Mobius1's
          ScreenEffect CodePen; only the scanlines + vcr + wobble
          subset is enabled. The `blur(1.5px)` on the video itself
          mirrors the demo's `image.blur = 1.5` image-path setting, and
          combines with the existing scale(1.5) zoom (transform and
          filter stack independently, so both apply cleanly).

          Video fills the CRT wrapper via object-cover; the wrapper
          fills the viewport via absolute inset-0. scale(1.5) zooms
          past the video's built-in black border so the scribble
          content reaches the viewport edges. The video contains both
          the scribble animation AND the logo resolve — no separate
          overlay logo is needed. */}
      <CrtEffects
        className="absolute inset-0"
        vcr={{ opacity: 0.1, num: 56 }}
      >
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
      </CrtEffects>

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
