import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import Lenis from 'lenis'

import { MarketPreview } from '@/features/market/MarketPreview'
import { MagicCard } from '@/ui/MagicCard'
import { SpreadLogoReveal } from './SpreadLogoReveal'
import { HeroCalloutCard } from './HeroCalloutCard'
import { TourCalloutCard } from './TourCalloutCard'
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
        scrollProgress > 0.1 && 'pointer-events-none select-none',
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
            LevX Protocol <span className="text-ink-dim">·</span> v1 Devnet
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
            Predict the path
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
        className="hero-intro__item hero-intro__item--spec mt-8 mb-2 flex items-center justify-center gap-4"
        style={{ ['--stagger' as string]: '520ms' }}
      >
        <div
          style={itemStyle(exitSpec)}
          className="flex items-center gap-8 text-white text-nano font-mono tracking-[0.28em] uppercase"
        >
          <span>Live Scoring</span>
          <span>AI + Human Predictions</span>
          <span>No Order Book</span>
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
    kicker: 'Predict',
    title: 'Predict the path, not just the price.',
    body: 'AI generates possible futures. You pick the one you believe — or draw your own.',
  },
  {
    num: '02',
    kicker: 'Score',
    title: 'Accuracy pays.',
    body: 'Paths are scored continuously against reality. The closer your prediction tracks what actually happens, the more you earn.',
  },
  {
    num: '03',
    kicker: 'Edge',
    title: 'Beat the AI, keep the edge.',
    body: "Think you see something the models don't? Draw your own line on the chart. If you're right and the crowd is wrong, you earn more per dollar than anyone else.",
  },
] as const

function HeroFeatureCallouts({
  progress,
  fadeOut,
}: {
  progress: number
  /** 0..1 phase-3 progress — drives the per-card fade-out + slide-right
   *  as the chart zooms into focus below. */
  fadeOut: number
}) {
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
  // Callouts should be completely gone by ~40% into phase 3 so they
  // don't compete with the chart-explainer that takes over the reading
  // role below. Faster fade than reveal makes room for the zoom.
  const exit = clamp01(fadeOut / 0.4)

  return (
    <div
      aria-hidden={progress < 0.02 || exit > 0.95}
      data-hero-callouts=""
      className={cn(
        'pointer-events-none fixed inset-y-0 top-[16%] left-[72%] z-[1200] flex flex-col justify-center gap-3 py-20',
        'w-[28vw] max-w-[340px]',
      )}
    >
      {HERO_CALLOUTS.map((c, i) => {
        const start = REVEAL_START + i * REVEAL_STEP
        const local = clamp01((progress - start) / REVEAL_WINDOW)
        // Once the hero has begun tilting, lift the card to MIN_OPACITY so
        // it's never invisible-but-mounted. Before phase-2 starts we keep
        // it fully hidden so nothing clutters the centered intro state.
        const revealBase = progress > 0.01 ? Math.max(MIN_OPACITY, local) : 0
        // Phase-3 exit: opacity fades to zero and each card slides a
        // further ~80px to the right — trailing cards exit last.
        const reveal = revealBase * (1 - exit)
        const translate = (1 - local) * 48 + exit * (80 + i * 12)
        return (
          <HeroCalloutCard
            key={c.num}
            num={c.num}
            kicker={c.kicker}
            title={c.title}
            body={c.body}
            leaderOpacity={local * (1 - exit)}
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

/**
 * Guided tour through the market preview — phase-4 scroll choreography.
 *
 * After phase-3 settles the card at "full view" (scale 1.0), the camera
 * pans + zooms across six anchor points on the card. Each stop keys a
 * tooltip that explains the feature beneath the zoom: live price, the
 * forecast fan, the provider rail, custom-path draw, leverage, and the
 * waitlist CTA. Because the zoom is driven by `transform-origin`, the
 * focused point stays pinned to its original viewport location while
 * the rest of the card scales away from it — giving each stop a natural
 * "magnifying glass" feel without needing to know card dimensions.
 *
 * Tooltip anchors are set in viewport units (vw/vh) so they sit in the
 * empty space opposite the focused element — price tooltip on the right
 * since the price lives upper-left of the card, provider tooltip on the
 * left since the rail is upper-right, etc.
 */
interface TourStop {
  id: string
  /** transform-origin percentages relative to the card's post-zoom box. */
  origin: { x: number; y: number }
  /** multiplied on top of the card's existing cardScale to magnify. */
  scale: number
  /** Highlight box dimensions in card rest percentages (width, height). The
   *  box is drawn centered on `origin` so the focused element stays framed
   *  even as the camera zooms. */
  box: { w: number; h: number }
  /** If null, no tooltip card is rendered for this stop — only the
   *  highlight box + zoom. Used for the waitlist CTA which gets a pulse
   *  highlight instead of an explainer card. */
  tooltip: {
    num: string
    kicker: string
    title: string
    body: string
  } | null
  /** Viewport position of the tooltip card (vw, vh). Unused when
   *  `tooltip` is null. */
  tooltipAnchor: { x: number; y: number }
  /** Force which edge of the tooltip the leader line starts from.
   *  Defaults to automatic selection (nearest edge to the box center). */
  leaderFrom?: 'top' | 'right' | 'bottom' | 'left'
}

const TOUR_STOPS: readonly TourStop[] = [
  {
    id: 'price',
    origin: { x: 16, y: 9.3 },
    scale: 2.2,
    box: { w: 30, h: 14 },
    tooltip: {
      num: '01',
      kicker: 'Token Pairs',
      title: 'Start with the familiar',
      body: 'In its early stages, LevX will support common crypto markets like BTC, SOL, and ETH with USDC or USDT parity.',
    },
    tooltipAnchor: { x: 50, y: 48 },
  },
  {
    id: 'paths',
    origin: { x: 46, y: 40 },
    scale: 1.9,
    box: { w: 52, h: 38 },
    tooltip: {
      num: '02',
      kicker: 'Quantum Reality',
      title: 'A novel scoring engine.',
      body: 'Visualize the many possible realities you can wager on. Each line/path is comprised of checkpoints that accrue P&L actively as time persists.',
    },
    tooltipAnchor: { x: 6, y: 8 },
    leaderFrom: 'bottom',
  },
  {
    id: 'providers',
    origin: { x: 86, y: 28 },
    scale: 2.3,
    box: { w: 28, h: 28 },
    tooltip: {
      num: '03',
      kicker: 'Providers',
      title: 'Five base agents, each at its own multiplier.',
      body: 'Chronos-2, TimesFM, GJR-GARCH, Merton-JD, Monte Carlo. Multipliers reflect how the room has priced each reading.',
    },
    tooltipAnchor: { x: 18, y: 36 },
  },
  {
    id: 'drawPath',
    origin: { x: 86, y: 50 },
    scale: 2.5,
    box: { w: 28, h: 6 },
    tooltip: {
      num: '04',
      kicker: 'Custom Path',
      title: 'Or draw your own conviction.',
      body: 'Sketch a 168-hour curve by hand when no agent matches your read. Your path picks up a multiplier based on how the pool tags it.',
    },
    tooltipAnchor: { x: 18, y: 52 },
  },
  {
    id: 'leverage',
    origin: { x: 86, y: 64 },
    scale: 2.4,
    box: { w: 28, h: 14 },
    tooltip: {
      num: '05',
      kicker: 'Leverage',
      title: 'Size the bet against duration.',
      body: 'Leverage cap scales with market length — shorter markets carry higher ceilings. Seven-day curves top out at 20×.',
    },
    tooltipAnchor: { x: 18, y: 58 },
  },
  {
    id: 'waitlist',
    origin: { x: 86, y: 94 },
    scale: 2.6,
    box: { w: 28, h: 6 },
    // No tooltip card — the pulsing highlight + zoomed button is the
    // whole focus. User wanted a direct "click me" moment here rather
    // than another explanation.
    tooltip: null,
    tooltipAnchor: { x: 0, y: 0 },
  },
]

/** Smoothstep — ease-in-out with zero slope at endpoints. */
function smoothstep(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Resolve the current camera state (origin + scale) from phase-4 scroll
 * progress. Timeline is [0, STOPS.length+1]:
 *   - [0, 1]      — pan from "full view" into stop 0
 *   - [N, N+1]    — dwell on stop N-1, then transition to stop N
 *   - [N+1, ...]  — hold on final stop
 *
 * smoothstep on the transition fraction gives each stop a natural dwell
 * at its endpoint, so the tooltip has a steady moment to read.
 */
function resolveCamera(progress4: number): {
  originX: number
  originY: number
  scale: number
} {
  const FULL_VIEW = { originX: 50, originY: 50, scale: 1 }
  // timeline: 0 at entry, 1 at stop 0, 2 at stop 1, ..., STOPS.length at stop N-1
  const timeline = progress4 * (TOUR_STOPS.length + 0.4)

  if (timeline <= 0) return FULL_VIEW
  if (timeline >= TOUR_STOPS.length) {
    const last = TOUR_STOPS[TOUR_STOPS.length - 1]
    return { originX: last.origin.x, originY: last.origin.y, scale: last.scale }
  }

  // Determine the two endpoints to interpolate between.
  const segment = Math.floor(timeline) // 0..STOPS.length-1
  const t = smoothstep(timeline - segment)
  const prev =
    segment === 0
      ? FULL_VIEW
      : {
          originX: TOUR_STOPS[segment - 1].origin.x,
          originY: TOUR_STOPS[segment - 1].origin.y,
          scale: TOUR_STOPS[segment - 1].scale,
        }
  const next = TOUR_STOPS[segment]
  return {
    originX: lerp(prev.originX, next.origin.x, t),
    originY: lerp(prev.originY, next.origin.y, t),
    scale: lerp(prev.scale, next.scale, t),
  }
}

/**
 * Tooltip visibility for stop N — peak when timeline is centered on N+1
 * (the moment the camera arrives and before it starts panning to N+2).
 * Triangular window keeps the fade snappy so stacked tooltips don't
 * bleed into each other.
 */
function tooltipVisibility(progress4: number, stopIndex: number): number {
  const timeline = progress4 * (TOUR_STOPS.length + 0.4)
  const peak = stopIndex + 1
  const d = Math.abs(timeline - peak)
  if (d < 0.25) return 1
  if (d > 0.55) return 0
  return 1 - (d - 0.25) / 0.3
}

function ChartTour({
  progress,
  onMeasure,
}: {
  progress: number
  onMeasure: (id: string, height: number) => void
}) {
  // Don't mount tooltips at all until phase 4 has started; this keeps
  // the DOM lean during phases 1-3 when no tooltip is visible.
  if (progress <= 0) return null
  return (
    <div aria-hidden={progress < 0.02} className="pointer-events-none fixed inset-0 z-[1250]">
      {TOUR_STOPS.map((stop, i) => {
        if (!stop.tooltip) return null
        const opacity = tooltipVisibility(progress, i)
        if (opacity < 0.01) return null
        return (
          <TourTooltip
            key={stop.id}
            stop={stop}
            opacity={opacity}
            onMeasure={onMeasure}
          />
        )
      })}
    </div>
  )
}

/** Tooltip wrapper — measures its rendered height on mount + layout and
 *  reports it up via onMeasure so TourArrow can anchor the leader line
 *  to the actual bottom edge (not a constant approximation). */
function TourTooltip({
  stop,
  opacity,
  onMeasure,
}: {
  stop: TourStop
  opacity: number
  onMeasure: (id: string, height: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const report = () => onMeasure(stop.id, el.getBoundingClientRect().height)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [stop.id, onMeasure])
  if (!stop.tooltip) return null
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute w-[min(360px,38vw)]"
      style={{
        left: `${stop.tooltipAnchor.x}vw`,
        top: `${stop.tooltipAnchor.y}vh`,
        opacity,
        willChange: 'opacity',
      }}
    >
      <TourCalloutCard
        num={stop.tooltip.num}
        kicker={stop.tooltip.kicker}
        title={stop.tooltip.title}
        body={stop.tooltip.body}
      />
    </div>
  )
}

/**
 * Schematic overlay — dashed highlight rectangles over the focused
 * region of the card, plus a leader line + arrowhead from each tooltip
 * to its target. Sits above the card transform but below the tooltip
 * cards so the arrow lands *into* each tooltip visually.
 *
 * Geometry: because the card's phase-4 transform uses
 * `transform-origin` set to the target point, that point stays pinned
 * to its rest viewport location during zoom. Given the CURRENT
 * (transformed) bounding rect, the formula `rect.left + origin.x% *
 * rect.width` always resolves to the same viewport position — so we
 * can reuse the current rect for both target position and current box
 * size without juggling separate "rest" and "zoomed" measurements.
 *
 * The waitlist stop skips the arrow + tooltip and instead pulses its
 * highlight box so the zoomed button reads as the final call-to-action.
 */
function TourOverlay({
  progress,
  cardRect,
  tooltipHeights,
}: {
  progress: number
  cardRect: DOMRect | null
  tooltipHeights: Record<string, number>
}) {
  if (progress <= 0 || !cardRect || cardRect.width === 0) return null

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1245] h-screen w-screen"
    >
      <defs>
        <marker
          id="tour-arrowhead"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#FFFFFF" />
        </marker>
      </defs>
      {TOUR_STOPS.map((stop, i) => {
        const opacity = tooltipVisibility(progress, i)
        if (opacity < 0.01) return null

        // Target viewport position — invariant during phase-4 zoom
        // because transform-origin is set to this point.
        const targetX = cardRect.left + (stop.origin.x / 100) * cardRect.width
        const targetY = cardRect.top + (stop.origin.y / 100) * cardRect.height

        // Box size scales with the current zoom because cardRect is the
        // transformed rect (width already multiplied by current scale).
        const boxW = (stop.box.w / 100) * cardRect.width
        const boxH = (stop.box.h / 100) * cardRect.height
        const boxLeft = targetX - boxW / 2
        const boxTop = targetY - boxH / 2

        const isWaitlist = stop.tooltip === null

        return (
          <g key={stop.id} opacity={opacity}>
            <rect
              x={boxLeft}
              y={boxTop}
              width={boxW}
              height={boxH}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={isWaitlist ? 2.75 : 2}
              strokeDasharray={isWaitlist ? '6 5' : '5 4'}
              className={isWaitlist ? 'tour-waitlist-pulse' : undefined}
            />
            {/* Corner ticks — four short L-marks at the highlight box's
                corners. Reinforces the CAD/drafting language used
                elsewhere on the landing. */}
            {!isWaitlist && (
              <>
                <TourCornerTick x={boxLeft} y={boxTop} kind="tl" />
                <TourCornerTick x={boxLeft + boxW} y={boxTop} kind="tr" />
                <TourCornerTick x={boxLeft} y={boxTop + boxH} kind="bl" />
                <TourCornerTick x={boxLeft + boxW} y={boxTop + boxH} kind="br" />
              </>
            )}
            {stop.tooltip && (
              <TourArrow
                tooltipAnchor={stop.tooltipAnchor}
                box={{ left: boxLeft, top: boxTop, width: boxW, height: boxH }}
                leaderFrom={stop.leaderFrom}
                tipHeight={tooltipHeights[stop.id]}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Tiny 8px L-shaped tick drawn at each corner of a highlight box. */
function TourCornerTick({
  x,
  y,
  kind,
}: {
  x: number
  y: number
  kind: 'tl' | 'tr' | 'bl' | 'br'
}) {
  const L = 8
  const dx = kind === 'tr' || kind === 'br' ? -L : L
  const dy = kind === 'bl' || kind === 'br' ? -L : L
  return (
    <path
      d={`M ${x + dx} ${y} L ${x} ${y} L ${x} ${y + dy}`}
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={2}
      strokeLinecap="round"
    />
  )
}

/**
 * Leader arrow from a tooltip card to its highlight box. The arrow
 * starts at the midpoint of the tooltip's edge nearest the target and
 * ends at the nearest edge of the highlight box — so the arrowhead
 * visually "lands" on the box rather than crossing it.
 *
 * Tooltip card dimensions are approximated (width = min(360, 38vw),
 * height ~170px). Overshoot is acceptable since the arrow + tooltip
 * share the same opacity fade.
 */
function TourArrow({
  tooltipAnchor,
  box,
  leaderFrom,
  tipHeight,
}: {
  tooltipAnchor: { x: number; y: number }
  box: { left: number; top: number; width: number; height: number }
  leaderFrom?: 'top' | 'right' | 'bottom' | 'left'
  tipHeight?: number
}) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const tipX = (tooltipAnchor.x / 100) * vw
  const tipY = (tooltipAnchor.y / 100) * vh
  const tipW = Math.min(360, vw * 0.38)
  // Prefer the measured tooltip height so the line anchors to the real
  // bottom edge regardless of body length. Falls back to 160 only for
  // the single frame between first render and the first measurement.
  const tipH = tipHeight ?? 160

  const boxCx = box.left + box.width / 2
  const boxCy = box.top + box.height / 2

  // Pick tooltip edge: either the explicit override or the nearest to
  // the box center.
  let startX: number, startY: number
  const side = leaderFrom ?? (
    boxCx > tipX + tipW ? 'right'
    : boxCx < tipX ? 'left'
    : boxCy > tipY + tipH ? 'bottom'
    : 'top'
  )
  if (side === 'right') {
    startX = tipX + tipW
    startY = tipY + tipH / 2
  } else if (side === 'left') {
    startX = tipX
    startY = tipY + tipH / 2
  } else if (side === 'bottom') {
    startX = tipX + tipW / 2
    startY = tipY + tipH
  } else {
    startX = tipX + tipW / 2
    startY = tipY
  }

  // Clip the end point to the box's perimeter so the arrowhead sits on
  // the edge (not inside the box).
  const endX = Math.max(box.left, Math.min(box.left + box.width, startX))
  const endY = Math.max(box.top, Math.min(box.top + box.height, startY))

  return (
    <line
      x1={startX}
      y1={startY}
      x2={endX}
      y2={endY}
      stroke="#FFFFFF"
      strokeWidth={2}
      strokeDasharray="5 4"
      strokeLinecap="butt"
      opacity={0.9}
    />
  )
}

/** Ease-out cubic — softens scroll-driven transforms so motion starts
 * gently and decelerates. Used by the hero card's tilt + slide so the
 * pivot feels like it's settling rather than tracking the wheel 1:1. */
function easeOutCubic(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - x, 3)
}

/** Ease-in-out cubic — gentle S-curve used for the phase-3 chart zoom
 * so the scale-up starts slow, accelerates through the middle, and
 * settles at the end. Avoids the "sudden stop" a pure ease-out gives
 * when the scale amplitude is large. */
function easeInOutCubic(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
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

export function LandingPage() {
  const [now] = useState(() => Date.now())
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  const handleWaitlistSubmit = async (payload: WaitlistPayload) => {
    await submitWaitlist(payload)
  }
  // Intro gate — flips when the active intro overlay signals completion.
  // Every scripted hero animation below keys off this flag so the typing
  // headline and card rise only begin once the reveal is handing off.
  const [introDone, setIntroDone] = useState(false)
  // Tracks the moment the intro overlay fully unmounts so the sticky
  // hero can stay underneath it for the entire fade-out window.
  const [introOverlayHidden, setIntroOverlayHidden] = useState(false)
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
    if (!introOverlayHidden) return

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
  }, [introOverlayHidden])

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

  // Live bounding rect of the market card — feeds the phase-4 TourOverlay
  // so highlight boxes + arrows can be drawn in viewport pixels over the
  // (transformed) card. Tracked on scroll/resize because phase-2/3/4
  // transforms move and scale the card's visible rect; getBoundingClientRect
  // returns the current post-transform box. For the tour geometry that's
  // exactly what we want — see TourOverlay for why.
  const [cardRect, setCardRect] = useState<DOMRect | null>(null)
  // Per-stop tooltip heights — measured by TourTooltip via ResizeObserver
  // so TourArrow can anchor the leader line to the tooltip's real bottom
  // edge instead of a constant approximation.
  const [tooltipHeights, setTooltipHeights] = useState<Record<string, number>>({})
  const handleTooltipMeasure = useCallback((id: string, height: number) => {
    setTooltipHeights((prev) =>
      prev[id] !== undefined && Math.abs(prev[id] - height) < 0.5 ? prev : { ...prev, [id]: height },
    )
  }, [])
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

  // Track the card's viewport rect on scroll + resize so the TourOverlay
  // can position highlight boxes + arrows over it. rAF-throttled so we
  // don't call getBoundingClientRect more than once per frame even under
  // a flood of scroll events.
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    let rafId = 0
    let pending = false
    const schedule = () => {
      if (pending) return
      pending = true
      rafId = requestAnimationFrame(() => {
        pending = false
        if (cardRef.current) setCardRect(cardRef.current.getBoundingClientRect())
      })
    }
    schedule()
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  // Four-phase hero scroll progress (all clamp 0-1).
  //   `scrollProgress`  — phase 1, 0..1 over the first 1.5 viewports; drives
  //                       the hero-intro fade + lift.
  //   `scrollProgress2` — phase 2, 0..1 over the next 1.5 viewports; drives
  //                       the market card's rightward slide + rotateY tilt,
  //                       and the right-rail callouts' reveal.
  //   `scrollProgress3` — phase 3, 0..1 over the following 2 viewports; drives
  //                       the un-tilt and settles the card at "full view"
  //                       (scale 1.0 — MarketPreview fully visible).
  //   `scrollProgress4` — phase 4, 0..1 over the following 6 viewports; drives
  //                       the guided tour across six tour stops (price, paths,
  //                       providers, draw-path, leverage, waitlist).
  // Pin wrapper sized to 1200vh so the sticky hero stays pinned through all
  // 11 viewports of travel before releasing. Thresholds: phase-1 0→1.5vh,
  // phase-2 1.5→3vh, phase-3 3→5vh, phase-4 5→11vh.
  const [scrollProgress, setScrollProgress] = useState(0)
  const [scrollProgress2, setScrollProgress2] = useState(0)
  const [scrollProgress3, setScrollProgress3] = useState(0)
  const [scrollProgress4, setScrollProgress4] = useState(0)
  useEffect(() => {
    const handleScroll = () => {
      const vh = window.innerHeight
      if (vh <= 0) return
      const y = window.scrollY
      setScrollProgress(Math.max(0, Math.min(1, y / (vh * 1.5))))
      setScrollProgress2(Math.max(0, Math.min(1, (y - vh * 1.5) / (vh * 1.5))))
      setScrollProgress3(Math.max(0, Math.min(1, (y - vh * 3) / (vh * 2))))
      setScrollProgress4(Math.max(0, Math.min(1, (y - vh * 5) / (vh * 6))))
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
  // Memoized so the intro's handoff effect doesn't re-run when introDone
  // flips — a new function reference each render would re-trigger the
  // effect's cleanup and restart the handoff timer.
  const handleIntroComplete = useCallback(() => setIntroDone(true), [])

  return (
    <main className="relative min-h-dvh w-full bg-black">
      {/* Plays before any hero content is visible. Unmounts itself once
          its own fade-out completes; onComplete fires as the logo begins
          fading so the hero's entrance animations overlap the last tail
          of the intro — the market card rises over the still-visible
          reveal as the overlay crossfades out from underneath. */}
      <SpreadLogoReveal
        onComplete={handleIntroComplete}
        onHidden={() => setIntroOverlayHidden(true)}
      />

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

      {/* Pin wrapper — 1200vh tall. The hero sticks to top:0 for 11
          viewports of sticky travel: 1.5 for phase 1 (hero intro fade)
          + 1.5 for phase 2 (card slide + tilt) + 2 for phase 3 (un-tilt
          + settle at full view) + 6 for phase 4 (six-stop guided tour).
          Matches the four scrollProgress divisors above. */}
      <div className="relative h-[1200vh]">
        {/* z-[1100] lifts the sticky section's stacking context above
            SpreadLogoReveal's z-[1000] — sticky *creates* a stacking
            context even without z-index, so without this the market card
            inside gets painted below the intro overlay regardless of any
            z-index we put on it directly. */}
        <section
          className={cn(
            'sticky top-0 flex h-dvh flex-col items-center justify-between overflow-hidden px-6 pt-24 pb-20 sm:px-10 sm:pt-28 sm:pb-24',
            introOverlayHidden ? 'z-[1100]' : 'z-[900]',
          )}
        >
          {/* Pulsating brand-green dither aura — scoped to the hero only so
              it doesn't bleed into sections below when the page scrolls.
              Wrapped with an opacity transition so it smoothly fades in
              after the market card lands (marketSettled) rather than
              popping into whatever mid-pulse state it happened to be in
              when the intro unmounts. Intentionally static — it doesn't
              translate or scale with the card's scroll-tilt, so the aura
              stays centered on the viewport as the card slides over it. */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-[1000ms] ease-out"
            style={{
              opacity: marketSettled ? 1 : 0,
              transform: scrollProgress2 > 0 || scrollProgress3 > 0
                ? (() => {
                    const uncrunch = easeOutCubic(
                      Math.max(0, Math.min(1, scrollProgress3 / 0.35)),
                    )
                    const tiltX = -easeOutCubic(scrollProgress2) * 13 * (1 - uncrunch)
                    const tiltY = -easeOutCubic(scrollProgress2) * 3.5
                    return `translateX(${tiltX}vw) translateY(${tiltY}vh)`
                  })()
                : undefined,
            }}
            aria-hidden="true"
          >
            {marketSettled && <div className="landing-dither" aria-hidden="true" />}
          </div>

          <HeroIntro show={introDone} scrollProgress={scrollProgress} />

          <div
            className="mx-auto w-full max-w-[1000px]"
            style={
              scrollProgress2 > 0 || scrollProgress3 > 0
                ? (() => {
                    const uncrunch = easeOutCubic(
                      Math.max(0, Math.min(1, scrollProgress3 / 0.35)),
                    )
                    const tiltX = -easeOutCubic(scrollProgress2) * 13 * (1 - uncrunch)
                    const tiltY = -easeOutCubic(scrollProgress2) * 3.5
                    return {
                      perspective: '1600px',
                      transform: `translateX(${tiltX}vw) translateY(${tiltY}vh)`,
                    }
                  })()
                : undefined
            }
          >
            <div
              style={
                scrollProgress2 > 0 || scrollProgress3 > 0
                  ? (() => {
                      const uncrunch = easeOutCubic(
                        Math.max(0, Math.min(1, scrollProgress3 / 0.35)),
                      )
                      const zoomP = easeInOutCubic(
                        Math.max(0, Math.min(1, (scrollProgress3 - 0.25) / 0.65)),
                      )
                      const rot = easeOutCubic(scrollProgress2) * 16 * (1 - uncrunch)
                      const basePhase2Scale = 1 - easeOutCubic(scrollProgress2) * 0.08
                      // Settle at 1.0 (full MarketPreview visible) by end
                      // of phase 3 — was 1.95 previously, which zoomed
                      // past the card's natural fit.
                      const scale = basePhase2Scale + zoomP * (1.0 - basePhase2Scale)
                      return {
                        transform: `rotateY(${rot}deg) scale(${scale})`,
                        transformOrigin: 'center center',
                      }
                    })()
                  : undefined
              }
            >
              {/* Phase-4 zoom-into-point wrapper. Applies `transform-origin`
                  + `scale` to magnify a specific region of the card per
                  tour stop. Sits inside the phase-2/3 rotation wrapper
                  so its origin is independent of the rotateY pivot. */}
              <div
                style={
                  scrollProgress4 > 0
                    ? (() => {
                        const cam = resolveCamera(scrollProgress4)
                        return {
                          transform: `scale(${cam.scale})`,
                          transformOrigin: `${cam.originX}% ${cam.originY}%`,
                          willChange: 'transform',
                        }
                      })()
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
                      - `relative z-[1100]` stacks above SpreadLogoReveal's
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
                  } ${markersReady ? '' : 'hide-chart-markers'}`}
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
          </div>

          {/* Right-rail feature callouts — reveal as the card tilts away
              during phase 2 of hero scroll. Pointer-events disabled so
              they never intercept clicks on the card behind. Hidden on
              narrow viewports where the tilt composition doesn't read. */}
          <HeroFeatureCallouts progress={scrollProgress2} fadeOut={scrollProgress3} />

          {/* Phase-4 guided tour — six tooltips keyed to the camera
              panning/zooming across the card. One per feature: live
              price, forecast fan, providers, custom-path, leverage,
              and the waitlist CTA. Each fades in when the camera
              arrives at its stop and fades out as it moves to the
              next. TourOverlay renders the dashed highlight boxes +
              leader arrows beneath the tooltip cards; ChartTour
              renders the explainer cards themselves. */}
          <TourOverlay
            progress={scrollProgress4}
            cardRect={cardRect}
            tooltipHeights={tooltipHeights}
          />
          <ChartTour progress={scrollProgress4} onMeasure={handleTooltipMeasure} />

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
