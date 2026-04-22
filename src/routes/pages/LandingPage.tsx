import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FileText } from 'lucide-react'
import Lenis from 'lenis'

import { MarketPreview } from '@/features/market/MarketPreview'
import { LogoReveal } from './LogoReveal'
import './landing.css'
import { BezierLogo } from '@/ui/BezierLogo'
import {
  LogoVariantCipher,
  LogoVariantFan,
  LogoVariantRootSystem,
} from '@/ui/BezierLogo/variants'
import { WaitlistModal, type WaitlistPayload } from '@/ui/WaitlistModal'

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

  return (
    <h1 className={className} aria-label={text}>
      {started && (
        <>
          <span aria-hidden="true">{text.slice(0, displayed)}</span>
          <span aria-hidden="true" className="typing-cursor" />
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
  const [now] = useState(() => Date.now())
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  const handleWaitlistSubmit = async (payload: WaitlistPayload) => {
    // TODO: wire to real endpoint
    console.log('[waitlist] submit', payload)
    await new Promise((r) => setTimeout(r, 600))
  }
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

  // Hero scroll progress (0 at the top, 1 at the end of the pin phase).
  // Feeds the TypingHeadline's reverse-delete effect. The divisor sets how
  // many viewports of scroll the text delete takes — larger = slower
  // vanish. 1.5 ≈ one-and-a-half viewports of wheel travel to fully clear
  // the headline.
  const [scrollProgress, setScrollProgress] = useState(0)
  useEffect(() => {
    const handleScroll = () => {
      const vh = window.innerHeight
      if (vh <= 0) return
      setScrollProgress(Math.max(0, Math.min(1, window.scrollY / (vh * 1.5))))
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

  const openWaitlist = useCallback(() => setWaitlistOpen(true), [])
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
        <img src="/logo_color.png" alt="LevX" className="h-12 w-auto" />
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

      {/* Pin wrapper — 250vh tall. The hero sticks to top:0 for the first
          150vh of scroll (the page visually freezes while scrollProgress
          drives the text delete), then the hero scrolls off normally once
          the user scrolls past. 150vh matches the scrollProgress divisor
          of 1.5 in the scroll handler. */}
      <div className="relative h-[250vh]">
        {/* z-[1100] lifts the sticky section's stacking context above
            LogoReveal's z-[1000] — sticky *creates* a stacking context
            even without z-index, so without this the market card inside
            gets painted below the intro overlay regardless of any z-index
            we put on it directly. */}
        <section className="sticky top-0 z-[1100] flex h-dvh flex-col items-center justify-between overflow-hidden px-6 pt-24 pb-20 sm:px-10 sm:pt-28 sm:pb-24">
          {/* Pulsating brand-green dither BG — scoped to the hero only so
              it doesn't bleed into sections below when the page scrolls.
              Wrapped with an opacity transition so it smoothly fades in
              after the market card lands (marketSettled) rather than
              popping into whatever mid-pulse state it happened to be in
              when LogoReveal unmounts. */}
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

          {/* zoom: 0.7 uniformly scales the card's rendered size AND its
              layout footprint — text, padding, chart, rail width all
              shrink by the same factor, unlike tweaking max-w +
              chartHeight piecemeal.
              `landing-rise` + markers-hidden are both gated on introDone —
              the card stays invisible + collapsed through the intro and
              only triggers the rise animation when the reveal hands off.
              `relative z-[1100]` stacks the card above LogoReveal's
              z-[1000] so it slides up AND OVER the still-visible video /
              logo during the rise — the overlay then crossfades out
              from underneath. */}
          <div
            className={`border-line-strong bg-surface relative z-[1100] mx-auto w-full max-w-[1440px] rounded-2xl border-2 p-5 sm:p-7 ${
              introDone ? 'landing-rise' : 'opacity-0'
            }${markersReady ? '' : ' hide-chart-markers'}`}
            style={{ zoom: 0.7 }}
          >
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
              onCtaClick={openWaitlist}
            />
          </div>
        </section>
      </div>

      {/* Logo variations — four renderings of the same bezier silhouette
          shown side-by-side as a CAD-sheet grid. Each panel has a small
          mono annotation (plate number + name) in the Nothing/drafting
          tradition. The canonical SDF (FLUID MERGE) occupies the top-left;
          the other three are Canvas 2D variants, each interpreting the
          mark through a different lens of the brand's visual language. */}
      <section className="flex min-h-dvh w-full items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[min(92vh,92vw,1400px)]">
          <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-4">
            <LogoPanel plate="01" name="FLUID MERGE">
              <BezierLogo color="#ffffff" ariaLabel="LevX" />
            </LogoPanel>
            <LogoPanel plate="02" name="CIPHER STREAM">
              <LogoVariantCipher />
            </LogoPanel>
            <LogoPanel plate="03" name="PROBABILITY FAN">
              <LogoVariantFan />
            </LogoPanel>
            <LogoPanel plate="04" name="ROOT SYSTEM">
              <LogoVariantRootSystem />
            </LogoPanel>
          </div>
        </div>
      </section>

      <WaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        onSubmit={handleWaitlistSubmit}
      />
    </main>
  )
}

/** CAD-sheet panel wrapper — thin border, mono plate annotation top-left. */
function LogoPanel({
  plate,
  name,
  children,
}: {
  plate: string
  name: string
  children: ReactNode
}) {
  return (
    <div className="border-line relative aspect-square overflow-hidden border">
      {/* Plate annotation — mirrors drafting-sheet conventions: plate
          number, slash separator, caps name. Sits atop the canvas so it
          reads regardless of what each variant renders underneath. */}
      <div className="pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1.5 font-mono text-[9px] leading-none tracking-[0.14em] uppercase">
        <span className="text-ink-dim">{plate}</span>
        <span className="text-ink-dim">/</span>
        <span className="text-ink-muted">{name}</span>
      </div>
      <div className="h-full w-full">{children}</div>
    </div>
  )
}
