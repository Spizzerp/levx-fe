import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import Lenis from 'lenis'

import { MarketPreview } from '@/features/market/MarketPreview'
import { MagicCard } from '@/ui/MagicCard'
import { LogoReveal } from './LogoReveal'
import { ChartLogoReveal } from './ChartLogoReveal'
import { SpreadLogoReveal } from './SpreadLogoReveal'
import { HeroCalloutCard } from './HeroCalloutCard'
import './landing.css'
import { WaitlistModal, type WaitlistPayload } from '@/ui/WaitlistModal'
import { submitWaitlist } from '@/lib/supabase/auth'
import { cn } from '@/lib/cn'

/**
 * Editorial hero intro — a four-register choreographed composition:
 *   1. Eyebrow kicker — monospace caps flanked by hairline brand rules.
 *   2. Display H1 line A — Bricolage Grotesque at display-xl.
 *   3. Display H1 line B — same family, softened weight + muted ink so
 *      the negation reads as counter-voice rather than continuation.
 *   4. Spec strip — three monospace caps separated by hairline ticks,
 *      a printed-spec line that anchors the protocol's concrete shape.
 *
 * Entrance: each register has its OWN stagger + duration + lift + blur
 * so they don't arrive as a uniform block — eyebrow snaps in, title
 * lines glide in with a longer ease, spec strip drifts in last.
 *
 * Exit (scroll-driven): per-register parallax — the eyebrow lifts and
 * fades fastest, title line A slightly slower, line B slower still,
 * and the spec strip lingers the longest. Each register also picks up
 * a touch of exit blur. The differential rates create depth: the page
 * doesn't slide away as one card; the hero dissolves register-by-
 * register the way an editorial spread might wipe between pages.
 */
function HeroIntro({ show, scrollProgress }: { show: boolean; scrollProgress: number }) {
  // Per-register exit speed multipliers — eyebrow accelerates fastest
  // because its visual weight is light; the spec strip lags so it's the
  // last vestige left as the card begins its tilt.
  const exitFor = (speed: number) => {
    const t = Math.max(0, Math.min(1, scrollProgress * speed))
    // Ease-in (cube) so each register starts gently and accelerates
    // toward zero — feels like the page is "letting go" rather than
    // being yanked away.
    const eased = t * t * t
    return {
      opacity: 1 - eased,
      lift: -eased * 32,
      blur: eased * 6,
    }
  }
  const exitEyebrow = exitFor(1.7)
  const exitTitleA = exitFor(1.35)
  const exitTitleB = exitFor(1.15)
  const exitSpec = exitFor(0.95)

  const itemStyle = (e: { opacity: number; lift: number; blur: number }) => ({
    opacity: e.opacity,
    transform: `translateY(${e.lift}px)`,
    filter: e.blur > 0.05 ? `blur(${e.blur}px)` : 'none',
    willChange: 'opacity, transform, filter',
  })

  return (
    <div
      aria-hidden={!show}
      className={cn(
        'relative z-[1200] flex w-full max-w-[920px] flex-col items-center px-4 text-center',
        show && 'hero-intro--show',
      )}
      style={{
        transition: show ? 'none' : 'opacity 400ms ease-out',
        opacity: show ? 1 : 0,
      }}
    >
      {/* Eyebrow kicker — hairline rules + monospace caps. Reads as a
          dek rule on an editorial page; the brand-green tip anchors
          the protocol lineage without shouting. */}
      <div
        className="hero-intro__item hero-intro__item--eyebrow flex items-center gap-3"
        style={{ ['--stagger' as string]: '0ms' }}
      >
        <div style={itemStyle(exitEyebrow)} className="flex items-center gap-3">
          <span aria-hidden className="hero-intro__rule" />
          <span className="text-ink-muted text-nano font-mono tracking-[0.32em] uppercase">
            LevX Protocol <span className="text-ink-dim">·</span> v0.1 Beta
          </span>
          <span aria-hidden className="hero-intro__rule hero-intro__rule--right" />
        </div>
      </div>

      {/* Display title — Bricolage Grotesque at display-xl. Line-height
          under 1 so the two lines kern into a single visual column.
          Tight negative tracking (-0.035em) pulls the grotesque metrics
          into a confident mass at hero size. Slightly trimmed from the
          previous 88px ceiling for a tauter editorial mass. */}
      <h1
        className="text-ink-strong mt-7 text-[52px] leading-[0.96] tracking-[-0.035em] sm:text-[68px] md:text-[80px]"
        style={{
          fontFamily: 'var(--font-editorial)',
          fontVariationSettings: '"opsz" 96',
        }}
      >
        <span
          className="hero-intro__item hero-intro__item--title-a block"
          style={{ ['--stagger' as string]: '160ms' }}
        >
          <span
            className="block"
            style={{ ...itemStyle(exitTitleA), fontWeight: 400 }}
          >
            Predict the path,
          </span>
        </span>
        <span
          className="hero-intro__item hero-intro__item--title-b text-ink-muted block"
          style={{ ['--stagger' as string]: '320ms' }}
        >
          <span
            className="block"
            style={{ ...itemStyle(exitTitleB), fontWeight: 360 }}
          >
            not the outcome.
          </span>
        </span>
      </h1>

      {/* Spec strip — printed-instrument metadata. Three concrete facts
          about the protocol, separated by hairline ticks. Sits at nano
          size in mono caps so it reads as a dek/spec line, not a
          tagline. The tick separators reuse the hairline language of
          the chart's checkpoint marks. */}
      <div
        className="hero-intro__item hero-intro__item--spec mt-8 flex items-center justify-center gap-4"
        style={{ ['--stagger' as string]: '520ms' }}
      >
        <div
          style={itemStyle(exitSpec)}
          className="flex items-center gap-4 text-ink-muted text-nano font-mono tracking-[0.28em] uppercase"
        >
          <span>168 HR Horizon</span>
          <span aria-hidden className="hero-intro__tick" />
          <span>Hourly Oracles</span>
          <span aria-hidden className="hero-intro__tick" />
          <span>5 Base Agents</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Right-rail feature callouts that reveal as the market card tilts away.
 *
 * Each item is keyed to a specific area of the tilted dashboard:
 *   01 · Trajectory  — about the chart/prediction paths
 *   02 · Checkpoints — about the hourly oracle marks on the axis
 *   03 · Agents      — about the model roster in the sidebar
 *
 * `progress` is the hero's phase-2 scroll (0..1). Each card has its own
 * start offset so they reveal in sequence, sliding in from the right while
 * the dashboard rotates and slides to the left. A dashed annotation
 * leader line extends from each card toward the dashboard — a schematic
 * "leader" that ties the callout to the UI it's describing.
 *
 * Hidden under `lg` because the tilt composition itself only reads well
 * on wide screens; on tablet/mobile the dashboard alone carries the hero.
 */
interface HeroCallout {
  num: string
  kicker: string
  title: string
  body: string
}

const HERO_CALLOUTS: readonly HeroCallout[] = [
  {
    num: '01',
    kicker: 'Trajectory',
    title: 'Trade the line, not the strike.',
    body: 'Every forecast is a 168-step curve. P&L accrues for every hour the tape shadows your path — not just where it lands.',
  },
  {
    num: '02',
    kicker: 'Checkpoints',
    title: 'Hour-by-hour resolution.',
    body: 'Oracles stamp the price on the hour. Miss six, win the next fifty. Shape of the curve beats endpoint luck.',
  },
  {
    num: '03',
    kicker: 'Agents',
    title: 'Borrow conviction from the floor.',
    body: 'Fork GJR-GARCH. Stack Merton-JD. Draft your own against the room, and let the tape settle the argument.',
  },
] as const

function HeroFeatureCallouts({ progress }: { progress: number }) {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
  // Wider reveal window (0.26) than step (0.14) so adjacent cards
  // crossfade instead of arriving as discrete pop-ins.
  const REVEAL_STEP = 0.14
  const REVEAL_WINDOW = 0.26
  const REVEAL_START = 0.04
  // Floor each card's visibility so they never fully disappear once the
  // hero has begun tilting — solves the "nothing on the right at all"
  // moment when progress is small. Cards still slide/fade in, just not
  // from zero.
  const MIN_OPACITY = 0.12

  return (
    <div
      aria-hidden={progress < 0.02}
      data-hero-callouts=""
      className={cn(
        'pointer-events-none fixed inset-y-0 top-[10%] left-[72%] z-[1200] flex flex-col justify-center gap-3 py-20',
        'w-[28vw] max-w-[340px]',
      )}
    >
      {HERO_CALLOUTS.map((c, i) => {
        const start = REVEAL_START + i * REVEAL_STEP
        const local = clamp01((progress - start) / REVEAL_WINDOW)
        // Once the hero has begun tilting, lift the card to MIN_OPACITY so
        // it's never invisible-but-mounted. Before phase-2 starts we keep
        // it fully hidden so nothing clutters the centered intro state.
        const reveal = progress > 0.01 ? Math.max(MIN_OPACITY, local) : 0
        const translate = (1 - local) * 48
        return (
          <HeroCalloutCard
            key={c.num}
            num={c.num}
            kicker={c.kicker}
            title={c.title}
            body={c.body}
            leaderOpacity={local}
            style={{
              opacity: reveal,
              transform: `translateX(${translate}px)`,
              willChange: 'opacity, transform',
            }}
          />
        )
      })}
    </div>
  )
}

/** Ease-out cubic — softens scroll-driven transforms so motion starts
 * gently and decelerates. Used by the hero card's tilt + slide so the
 * pivot feels like it's settling rather than tracking the wheel 1:1. */
function easeOutCubic(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - x, 3)
}

/** X (Twitter) glyph — mirrors the one used in CommonLayout's footer. */
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

type IntroKind = 'video' | 'chart' | 'chartCam' | 'spread'
const INTRO_STORAGE_KEY = 'levx:landing:intro'
const INTRO_KINDS: readonly IntroKind[] = ['video', 'chart', 'chartCam', 'spread']

function loadIntroKind(): IntroKind {
  if (typeof window === 'undefined') return 'video'
  try {
    const v = window.localStorage.getItem(INTRO_STORAGE_KEY)
    return (INTRO_KINDS as readonly string[]).includes(v ?? '') ? (v as IntroKind) : 'video'
  } catch {
    return 'video'
  }
}

export function LandingPage() {
  const [now] = useState(() => Date.now())
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  const handleWaitlistSubmit = async (payload: WaitlistPayload) => {
    await submitWaitlist(payload)
  }
  // Which intro to play — persisted so refresh keeps the user's choice.
  // Toggling at runtime remounts the chosen overlay via `key` below so the
  // new intro plays from the start instead of jumping to the already-
  // completed handoff state.
  const [introKind, setIntroKind] = useState<IntroKind>(loadIntroKind)
  // Intro gate — flips when the active intro overlay signals completion.
  // Every scripted hero animation below keys off this flag so the typing
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

  const openWaitlist = useCallback(() => setWaitlistOpen(true), [])
  // Memoized so LogoReveal's effect doesn't re-run when introDone flips —
  // a new function reference each render would cause the effect's cleanup
  // + re-execution to call video.play() again, restarting the ended video.
  const handleIntroComplete = useCallback(() => setIntroDone(true), [])

  // Swap intros: reset the handoff gates so the new intro plays from the
  // top, persist the choice, and let the `key={introKind}` prop on the
  // overlay below remount the chosen component.
  const switchIntro = useCallback((kind: IntroKind) => {
    setIntroKind((current) => {
      if (current === kind) return current
      try {
        window.localStorage.setItem(INTRO_STORAGE_KEY, kind)
      } catch {
        // Private mode etc. — non-fatal, the choice just won't persist.
      }
      setIntroDone(false)
      setMarkersReady(false)
      setMarketSettled(false)
      return kind
    })
  }, [])

  return (
    <main className="relative min-h-dvh w-full bg-black">
      {/* Plays before any hero content is visible. Unmounts itself once
          its own fade-out completes; onComplete fires as the logo begins
          fading so the hero's entrance animations overlap the last tail
          of the intro — the market card rises over the still-visible
          video as the overlay crossfades out from underneath.
          `key={introKind}` forces a remount when the toggle flips so the
          newly-selected intro plays from t=0 instead of inheriting the
          previous one's handoff state. */}
      {introKind === 'video' && <LogoReveal key="video" onComplete={handleIntroComplete} />}
      {introKind === 'chart' && <ChartLogoReveal key="chart" onComplete={handleIntroComplete} />}
      {introKind === 'chartCam' && (
        <ChartLogoReveal key="chartCam" onComplete={handleIntroComplete} cameraTransform />
      )}
      {introKind === 'spread' && <SpreadLogoReveal key="spread" onComplete={handleIntroComplete} />}

      {/* Intro kind toggle — tiny segmented pill pinned top-right, above
          the intro overlay (z-[1200] > z-[1000]) so it remains reachable
          even while the intro is playing. Choice is persisted to
          localStorage via switchIntro. */}
      <IntroToggle value={introKind} onChange={switchIntro} />

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

          {/* Editorial hero — always mounted to reserve its own vertical
              rhythm during the intro overlay. `show` stays false until
              the LogoReveal hands off, at which point the staggered
              blur-up reveal kicks in. The block also responds to phase-1
              scroll by fading + lifting to clear the stage for the
              market-card tilt in phase-2. */}
          <HeroIntro show={introDone} scrollProgress={scrollProgress} />

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
          {/* Tilt math — apply ease-out (cubic) to the linear scroll
              progress so motion starts gently and decelerates. Couple
              with a tiny upward float so the card feels like it's
              releasing from gravity as it pivots, instead of just
              sliding flatly across the stage. Angle slightly trimmed
              (16°) so the perspective never gets cartoon-deep. */}
          <div
            className="mx-auto w-full max-w-[1000px]"
            style={
              scrollProgress2 > 0
                ? {
                    perspective: '1600px',
                    transform: `translateX(${-easeOutCubic(scrollProgress2) * 13}vw) translateY(${-easeOutCubic(scrollProgress2) * 3.5}vh)`,
                  }
                : undefined
            }
          >
            <div
              style={
                scrollProgress2 > 0
                  ? {
                      transform: `rotateY(${easeOutCubic(scrollProgress2) * 16}deg) scale(${1 - easeOutCubic(scrollProgress2) * 0.08})`,
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
                }${markersReady ? '' : 'hide-chart-markers'}`}
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
                    onCtaClick={openWaitlist}
                  />
                </div>
              </MagicCard>
            </div>
          </div>

          {/* Right-rail feature callouts — reveal as the card tilts away
              during phase 2 of hero scroll. Pointer-events disabled so
              they never intercept clicks on the card behind. Hidden on
              narrow viewports where the tilt composition doesn't read. */}
          <HeroFeatureCallouts progress={scrollProgress2} />

          {/* Editorial scroll cue — hairline rule + mono caps + a green
              tracer that drops down the rule on a 2.4s cycle. Replaces
              the previous bare chevron with a piece of typographic
              instrumentation that matches the rest of the page's
              drafting language. Fades out the moment the user starts
              scrolling so it never competes with the title's fade. */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute bottom-7 left-1/2 z-[1100] -translate-x-1/2 transition-opacity duration-700 ease-out',
              marketSettled && scrollProgress < 0.02 ? 'opacity-60' : 'opacity-0',
            )}
          >
            <div className="flex flex-col items-center gap-2.5">
              <span className="text-ink-muted font-mono text-nano tracking-[0.32em] uppercase">
                Scroll
              </span>
              <span className="hero-scroll-rule" />
            </div>
          </div>
        </section>
      </div>

      <WaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        onSubmit={handleWaitlistSubmit}
      />
    </main>
  )
}

/**
 * Intro kind toggle — segmented two-option pill. Pinned top-right at
 * z-[1200] so it sits above the fullscreen intro overlay (z-[1000]) and
 * the fixed header (z-20), letting the user switch intros even mid-play.
 * Monospace caps match the drafting/CAD annotation language used elsewhere
 * on the landing page.
 */
function IntroToggle({
  value,
  onChange,
}: {
  value: IntroKind
  onChange: (kind: IntroKind) => void
}) {
  return (
    <div
      className="border-line-strong bg-surface/80 fixed top-4 right-6 z-[1200] flex items-center gap-0 overflow-hidden rounded-full border font-mono text-[10px] leading-none tracking-[0.14em] uppercase backdrop-blur-sm"
      role="group"
      aria-label="Intro style"
    >
      <IntroToggleOption
        label="Video"
        active={value === 'video'}
        onClick={() => onChange('video')}
      />
      <IntroToggleOption
        label="Chart"
        active={value === 'chart'}
        onClick={() => onChange('chart')}
      />
      <IntroToggleOption
        label="ChartCam"
        active={value === 'chartCam'}
        onClick={() => onChange('chartCam')}
      />
      <IntroToggleOption
        label="Spread"
        active={value === 'spread'}
        onClick={() => onChange('spread')}
      />
    </div>
  )
}

function IntroToggleOption({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`duration-short ease-levx px-3 py-1.5 transition-colors ${
        active ? 'bg-ink-strong text-surface' : 'text-ink-muted hover:text-ink-strong'
      }`}
    >
      {label}
    </button>
  )
}
