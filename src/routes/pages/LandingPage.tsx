import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, FileText } from 'lucide-react'
import Lenis from 'lenis'

import { useNavigate } from '@tanstack/react-router'

import { MarketPreview } from '@/features/market/MarketPreview'
import { MagicCard } from '@/ui/MagicCard'
import { LogoReveal } from './LogoReveal'
import './landing.css'

/**
 * Typewriter headline — reveals one character at a time after an optional
 * delay, then leaves a blinking cursor at the end. Respects
 * prefers-reduced-motion (shows the full string immediately) via the CSS
 * rule on `.typing-cursor`, since the JS interval itself is near-harmless
 * but we still want to not make the cursor strobe.
 */
function TypingHeadline({
  text,
  startAfter = 0,
  speed = 55,
  scrollProgress = 0,
  className,
}: {
  text: string
  startAfter?: number
  speed?: number
  /**
   * 0-1 scroll position through the hero. Once typing completes, this maps
   * linearly to the visible character count — as the user scrolls down, the
   * text reverses (appears to be deleted from the end).
   */
  scrollProgress?: number
  className?: string
}) {
  // `started` guards the cursor + text so nothing renders during the pre-roll.
  // Without it, the blinking cursor would appear alone before `startAfter`
  // elapses and look like a stray glyph on the empty page.
  const [started, setStarted] = useState(false)
  const [chars, setChars] = useState(0)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    const startTimer = setTimeout(() => {
      setStarted(true)
      intervalId = setInterval(() => {
        setChars((n) => {
          if (n >= text.length) {
            if (intervalId) clearInterval(intervalId)
            return n
          }
          return n + 1
        })
      }, speed)
    }, startAfter)

    return () => {
      clearTimeout(startTimer)
      if (intervalId) clearInterval(intervalId)
    }
  }, [text, startAfter, speed])

  // After typing finishes, hand control over to scrollProgress — characters
  // recede from the end proportional to how far the page has scrolled.
  const typingDone = chars >= text.length
  const clampedScroll = Math.max(0, Math.min(1, scrollProgress))
  const displayed = typingDone
    ? Math.max(0, text.length - Math.floor(clampedScroll * text.length))
    : chars

  // Hide the cursor once the scroll-delete has fully cleared the headline —
  // without this the blinking vertical bar lingers on an otherwise empty
  // hero as the user continues scrolling. `animation: none` is required
  // alongside the opacity override: CSS keyframe animations outrank
  // non-!important inline styles, so without it the blink animation would
  // keep driving opacity between 0 and 1 and the fade-out wouldn't stick.
  const cursorHidden = typingDone && displayed === 0

  return (
    <h1 className={className} aria-label={text}>
      {started && (
        <>
          <span aria-hidden="true">{text.slice(0, displayed)}</span>
          <span
            aria-hidden="true"
            className="typing-cursor"
            style={
              cursorHidden
                ? {
                    opacity: 0,
                    animation: 'none',
                    transition: 'opacity 300ms ease-out',
                  }
                : undefined
            }
          />
        </>
      )}
    </h1>
  )
}

/** X (Twitter) glyph — mirrors the one used in CommonLayout's footer. */
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
import { mulberry32, normalRandom } from '@/lib/rng'
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'
import type { PricePoint } from '@/types/market'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const CHECKPOINT_INTERVAL_SEC = 3600
const TOTAL_CHECKPOINTS = 168
const BASE_PRICE = 65_000

function buildMockHistory(now: number): PricePoint[] {
  const rng = mulberry32(0xbee5)
  const points: PricePoint[] = []
  let price = BASE_PRICE
  for (let i = 0; i < TOTAL_CHECKPOINTS; i++) {
    const time = now - (TOTAL_CHECKPOINTS - i) * HOUR_MS
    if (i > 0) {
      const z = normalRandom(rng)
      price = price * (1 + 0.0001 + 0.004 * z)
    }
    points.push({ time, value: price })
  }
  return points
}

export function LandingPage() {
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())
  // Intro gate — flips when the LogoReveal overlay signals completion
  // (~5.9s after mount, as the logo begins its 400ms fade-out). Every
  // scripted hero animation below keys off this flag so the typing
  // headline and card rise only begin once the reveal is handing off.
  const [introDone, setIntroDone] = useState(false)
  // Flips true after the card's 1.8s rise animation so the chart's dashed
  // marker lines (NOW / OPENS / END) appear only once the card is settled.
  // Same timer also flips marketSettled which triggers the dither fade-in
  // below — both are keyed to the same "card has landed" moment.
  const [markersReady, setMarkersReady] = useState(false)
  const [marketSettled, setMarketSettled] = useState(false)
  useEffect(() => {
    if (!introDone) return
    const markersT = setTimeout(() => setMarkersReady(true), 1900)
    const settledT = setTimeout(() => setMarketSettled(true), 1900)
    return () => {
      clearTimeout(markersT)
      clearTimeout(settledT)
    }
  }, [introDone])

  // Lenis smooth-scroll. Inertial easing on wheel/trackpad — drives
  // scroll-linked animations as we add sections below the hero.
  useEffect(() => {
    const lenis = new Lenis()
    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  // Dynamic card scale — the market card's `zoom` is driven by the viewport
  // so the whole card (header + chart + comments + sidebar) always fits the
  // hero on any screen ratio. Measured via ResizeObserver on the card: we
  // infer the card's logical (un-zoomed) dimensions by dividing the rendered
  // rect by the currently-applied zoom, then compute the scale needed to
  // fit within 72% of viewport height and 88% of viewport width. Capped at
  // 0.7 (original design scale) and floored at 0.35 (so the card doesn't
  // shrink to illegibility on very small viewports). Uses a ref to track
  // the latest scale inside the observer callback so we avoid a stale
  // closure that would prevent convergence.
  const cardRef = useRef<HTMLDivElement>(null)
  const cardScaleRef = useRef(0.55)
  const [cardScale, setCardScale] = useState(0.55)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const compute = () => {
      const rect = el.getBoundingClientRect()
      const currentScale = cardScaleRef.current
      if (rect.width === 0 || rect.height === 0) return
      const logicalH = rect.height / currentScale
      const logicalW = rect.width / currentScale
      const vh = window.innerHeight
      const vw = window.innerWidth
      const byH = (vh * 0.72) / logicalH
      const byW = (vw * 0.88) / logicalW
      const newScale = Math.min(0.7, Math.max(0.35, Math.min(byH, byW)))
      if (Math.abs(newScale - currentScale) > 0.01) {
        cardScaleRef.current = newScale
        setCardScale(newScale)
      }
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [])

  // Two-phase hero scroll progress (both clamp 0-1).
  //   `scrollProgress`  — phase 1, 0..1 over the first 1.5 viewports; drives
  //                       the typewriter reverse-delete + cursor fade.
  //   `scrollProgress2` — phase 2, 0..1 over the next 1.5 viewports; drives
  //                       the market card's rightward slide + rotateY tilt.
  // The pin wrapper below is sized to 400vh so the sticky hero stays pinned
  // for all 3 viewports of phase-1 + phase-2 travel before releasing.
  const [scrollProgress, setScrollProgress] = useState(0)
  const [scrollProgress2, setScrollProgress2] = useState(0)
  useEffect(() => {
    const handleScroll = () => {
      const vh = window.innerHeight
      if (vh <= 0) return
      const y = window.scrollY
      setScrollProgress(Math.max(0, Math.min(1, y / (vh * 1.5))))
      setScrollProgress2(Math.max(0, Math.min(1, (y - vh * 1.5) / (vh * 1.5))))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  const { history, predictions, marketStart, marketEnd } = useMemo(() => {
    const marketStart = now - 2 * DAY_MS
    const marketEnd = now + 5 * DAY_MS
    const history = buildMockHistory(now)
    // Anchor predictions at the history price at marketStart so the paths
    // fan out from the point where the price line crosses the start marker.
    const startPoint = history.find((p) => p.time >= marketStart) ?? history[history.length - 1]
    const predictions = buildAiPathFixture({
      startTime: marketStart,
      checkpointInterval: CHECKPOINT_INTERVAL_SEC,
      totalCheckpoints: TOTAL_CHECKPOINTS,
      basePrice: startPoint?.value ?? BASE_PRICE,
    })
    return { history, predictions, marketStart, marketEnd }
  }, [now])

  const goToApp = () => navigate({ to: '/markets' })
  // Memoized so LogoReveal's effect doesn't re-run when introDone flips —
  // a new function reference each render would cause the effect's cleanup
  // + re-execution to call video.play() again, restarting the ended video.
  const handleIntroComplete = useCallback(() => setIntroDone(true), [])

  return (
    <main className="relative min-h-dvh w-full bg-black">
      {/* Plays before any hero content is visible. Unmounts itself once
          its own fade-out completes; onComplete fires as the logo begins
          fading so the hero's entrance animations overlap the last tail
          of the intro — the market card rises over the still-visible
          video as the overlay crossfades out from underneath. */}
      <LogoReveal onComplete={handleIntroComplete} />

      {/* Fixed (not absolute) so it stays pinned to the viewport while the
          page scrolls. */}
      <div className="fixed top-0 right-0 left-0 z-20 flex items-center justify-between px-6 py-4">
        <img src="/logo_wordmark.png" alt="LevX" className="h-5 w-auto" />
        <div className="flex items-center gap-4">
          <a
            href="https://x.com/LevXtrade"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LevX on X"
            className="text-ink-strong duration-short ease-levx transition-opacity hover:opacity-70"
          >
            <XIcon size={16} />
          </a>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LevX docs"
            className="text-ink-strong duration-short ease-levx transition-opacity hover:opacity-70"
          >
            <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Pin wrapper — 400vh tall. The hero sticks to top:0 for 300vh of
          sticky travel (3 viewports): 1.5 viewports for phase 1 (text
          delete) + 1.5 viewports for phase 2 (market card slide + tilt),
          matching the two scrollProgress divisors above. */}
      <div className="relative h-[400vh]">
        {/* z-[1100] lifts the sticky section's stacking context above
            LogoReveal's z-[1000] — sticky *creates* a stacking context
            even without z-index, so without this the market card inside
            gets painted below the intro overlay regardless of any z-index
            we put on it directly. */}
        <section className="sticky top-0 z-[1100] flex h-dvh flex-col items-center justify-between overflow-hidden px-6 pt-24 pb-20 sm:px-10 sm:pt-28 sm:pb-24">
          {/* Pulsating brand-green dither aura — scoped to the hero only so
              it doesn't bleed into sections below when the page scrolls.
              Wrapped with an opacity transition so it smoothly fades in
              after the market card lands (marketSettled) rather than
              popping into whatever mid-pulse state it happened to be in
              when LogoReveal unmounts. Intentionally static — it doesn't
              translate or scale with the card's scroll-tilt, so the aura
              stays centered on the viewport as the card slides over it. */}
          <div
            className="absolute inset-0 transition-opacity duration-[1000ms] ease-out"
            style={{ opacity: marketSettled ? 1 : 0 }}
            aria-hidden="true"
          >
            {marketSettled && <div className="landing-dither" aria-hidden="true" />}
          </div>

          {/* Typewriter headline — only mounts once the intro is handing
              off. startAfter=1900 delays typing until the card's 1.8s
              rise finishes, preserving the non-overlapping rhythm with
              the slightly slower rise. */}
          {introDone && (
            <TypingHeadline
              text="Predict the path, not the outcome"
              startAfter={1900}
              scrollProgress={scrollProgress}
              className="text-ink-strong font-display text-display-sm text-center font-medium tracking-tight"
            />
          )}
          {/* Placeholder preserves vertical rhythm during the intro so the
              sticky hero layout doesn't shift when the headline mounts.
              aria-hidden + invisible keeps it out of the a11y tree while
              reserving its line-box. */}
          {!introDone && (
            <h1
              aria-hidden="true"
              className="text-display-sm invisible font-display text-center font-medium tracking-tight"
            >
              &nbsp;
            </h1>
          )}

          {/* Two transform wrappers around the card so three independent
              transforms stay cleanly separated:
                outer  — perspective container + horizontal slide driven by
                         scrollProgress2 (phase 2 of hero scroll).
                middle — rotateY tilt + shrink, also driven by
                         scrollProgress2. A separate element so it doesn't
                         collide with the landing-rise animation that
                         lives on the card.
                card   — keeps `landing-rise` (translateY + opacity) +
                         `zoom: 0.7` exactly as before; no inline transform
                         so the keyframe animation runs unobstructed.
              The inline `perspective` and `transform` values are only set
              once scroll has advanced into phase 2 — at rest they're
              omitted entirely. Applying any transform (even identity)
              promotes the subtree to a GPU compositor layer and can
              cause sub-pixel blur/shift on the card's text, so the card
              needs to be transform-free while it's sitting flat. */}
          <div
            className="mx-auto w-full max-w-[1000px]"
            style={
              scrollProgress2 > 0
                ? {
                    perspective: '1400px',
                    transform: `translateX(${-scrollProgress2 * 15}vw)`,
                  }
                : undefined
            }
          >
            <div
              style={
                scrollProgress2 > 0
                  ? {
                      transform: `rotateY(${scrollProgress2 * 18}deg) scale(${1 - scrollProgress2 * 0.1})`,
                      transformOrigin: 'center center',
                    }
                  : undefined
              }
            >
              {/* MagicCard owns the surface fill, the 1px gradient
                  border-ring that tracks the cursor, and the soft inner
                  spotlight that fades in on hover. We keep the card's
                  existing responsibilities on the wrapper itself:
                    - `ref={cardRef}` feeds the ResizeObserver that drives
                       the dynamic `zoom`.
                    - `landing-card-glow` provides the diffuse outer halo
                       (brand-green + faint white) that sits on top of the
                       dither aura behind.
                    - `zoom: cardScale` uniformly scales rendered size
                       AND layout footprint.
                    - `relative z-[1100]` stacks above LogoReveal's
                       z-[1000] so the rise animation plays above the
                       still-fading intro overlay.
                    - `landing-rise` / `opacity-0` + marker-hide gates
                       stay on MagicCard — the intro rise keyframes
                       animate the whole card including MagicCard's
                       border and spotlight layers.
                  Padding for MarketPreview's inner content moves onto
                  an inner div because MagicCard's z-stack needs direct
                  ownership of its outer edges (padding there would pull
                  the z-20 surface + z-30 spotlight layers inward). */}
              <MagicCard
                ref={cardRef}
                className={`landing-card-glow relative z-[1100] mx-auto rounded-2xl ${
                  introDone ? 'landing-rise' : 'opacity-0'
                }${markersReady ? '' : ' hide-chart-markers'}`}
                style={{ zoom: cardScale }}
              >
                <div className="p-5 sm:p-7">
                  <MarketPreview
                    pair="BTC/USDC"
                    history={history}
                    predictions={predictions}
                    now={now}
                    marketStart={marketStart}
                    marketEnd={marketEnd}
                    checkpointInterval={CHECKPOINT_INTERVAL_SEC}
                    totalCheckpoints={TOTAL_CHECKPOINTS}
                    chartHeight={420}
                    onCtaClick={goToApp}
                  />
                </div>
              </MagicCard>
            </div>
          </div>

          {/* Scroll hint — gentle down-chevron that fades in once the
              market card has landed, then fades out again the moment the
              user starts scrolling. Absolute-positioned so it sits within
              the section's bottom padding without reflowing the flex
              layout above. pointer-events-none so it never intercepts
              clicks on the card below. */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 transition-opacity duration-700 ease-out ${
              marketSettled && scrollProgress < 0.02 ? 'opacity-60' : 'opacity-0'
            }`}
          >
            <ChevronDown
              className="scroll-hint text-ink-muted"
              size={28}
              strokeWidth={1.5}
            />
          </div>
        </section>
      </div>

    </main>
  )
}
