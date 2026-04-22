import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import Lenis from 'lenis'

import { useNavigate } from '@tanstack/react-router'

import { MarketPreview } from '@/features/market/MarketPreview'
import { BezierLogo } from '@/ui/BezierLogo'

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
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())
  // Flips true after the card's 1.4s rise animation so the chart's dashed
  // marker lines (NOW / OPENS / END) appear only once the card is settled.
  const [markersReady, setMarkersReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMarkersReady(true), 1500)
    return () => clearTimeout(t)
  }, [])

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

  const goToApp = () => navigate({ to: '/markets' })

  return (
    <main className="relative min-h-dvh w-full bg-black">
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
        <section className="sticky top-0 flex h-dvh flex-col items-center justify-between overflow-hidden px-6 pt-24 pb-20 sm:px-10 sm:pt-28 sm:pb-24">
          {/* Pulsating brand-green dither BG — scoped to the hero only so
              it doesn't bleed into sections below when the page scrolls. */}
          <div className="landing-dither" aria-hidden="true" />

          {/* Typewriter headline — starts after the card's 1.4s rise
              animation finishes so the two animations don't overlap. */}
          <TypingHeadline
            text="Predict the path, not the outcome"
            startAfter={1500}
            scrollProgress={scrollProgress}
            className="text-ink-strong font-display text-display-sm text-center font-medium tracking-tight"
          />

          {/* zoom: 0.7 uniformly scales the card's rendered size AND its
              layout footprint — text, padding, chart, rail width all
              shrink by the same factor, unlike tweaking max-w +
              chartHeight piecemeal. */}
          <div
            className={`border-line-strong bg-surface landing-rise mx-auto w-full max-w-[1440px] rounded-2xl border-2 p-5 sm:p-7${
              markersReady ? '' : ' hide-chart-markers'
            }`}
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
              onCtaClick={goToApp}
            />
          </div>
        </section>
      </div>

      {/* Interactive SDF logo — hover it to swirl the shape around the
          cursor. Sits at the bottom of the page as a visual bookend; sized
          to fit the viewport so it feels deliberate rather than decorative.
          The square aspect wrapper keeps the logo proportions intact at
          any viewport width. */}
      <section className="flex min-h-dvh w-full items-center justify-center px-6 py-24 sm:px-10">
        <div className="aspect-square w-full max-w-[min(80vh,720px)]">
          <BezierLogo color="#ffffff" ariaLabel="LevX" />
        </div>
      </section>
    </main>
  )
}
