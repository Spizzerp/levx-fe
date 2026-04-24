import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import Lenis from 'lenis'

import { MarketPreview } from '@/features/market/MarketPreview'
import { MagicCard } from '@/ui/MagicCard'
import { SpreadLogoReveal } from './SpreadLogoReveal'
import { HeroCalloutCard } from './HeroCalloutCard'
import { TourCalloutCard } from './TourCalloutCard'
import './landing.css'
import { WaitlistModal } from '@/ui/WaitlistModal'
import { WaitlistForm, type WaitlistPayload } from '@/ui/WaitlistForm'
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
          <span className="block" style={{ ...itemStyle(exitTitleA), fontWeight: 400 }}>
            Predict the path
          </span>
        </span>
        <span
          className="hero-intro__item hero-intro__item--title-b text-ink-muted block"
          style={{ ['--stagger' as string]: '320ms' }}
        >
          <span className="block" style={{ ...itemStyle(exitTitleB), fontWeight: 360 }}>
            not the outcome
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
          className="text-nano flex items-center gap-8 font-mono tracking-[0.28em] text-white uppercase"
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
 * pans + zooms across five anchor points on the card. Each stop keys a
 * tooltip that explains the feature beneath the zoom: live price, the
 * forecast fan, the provider rail, custom-path draw, and leverage. The
 * waitlist CTA is no longer a tour stop — scrolling past the leverage
 * stop transitions directly into phase 5 (waitlist curtain rise).
 * Because the zoom is driven by `transform-origin`, the focused point
 * stays pinned to its original viewport location while the rest of the
 * card scales away from it — giving each stop a natural "magnifying
 * glass" feel without needing to know card dimensions.
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
  tooltip: {
    num: string
    kicker: string
    title: string
    body: string
  }
  /** Viewport position of the tooltip card (vw, vh). */
  tooltipAnchor: { x: number; y: number }
  /** Force which edge of the tooltip the leader line starts from.
   *  Defaults to automatic selection (nearest edge to the box center). */
  leaderFrom?: 'top' | 'right' | 'bottom' | 'left'
  /** Optional per-side tuning applied to the DOM-measured box. Each
   *  value is a fraction of the measured box dimension on that axis —
   *  positive extends the box outward on that side, negative trims it
   *  inward. Origin re-centers to the adjusted box so the camera still
   *  aims at the middle of what's highlighted. Useful when the tagged
   *  element has trailing whitespace (trim) or when the stop wants to
   *  cover a wider region than a single marker can express (expand).
   *  Ignored when no DOM measurement exists for the stop. */
  boxAdjust?: { left?: number; right?: number; top?: number; bottom?: number }
}

// Fallback config. The landing measures these targets off the DOM at
// runtime (`[data-tour]` markers inside MarketPreview) and overrides
// `origin` + `box` with the live values. The constants here are used
// (a) before the first measurement lands, and (b) as a safety net if a
// marker is missing or unmeasurable.
const TOUR_STOPS_FALLBACK: readonly TourStop[] = [
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
    // The price wrapper is full-column width but its content (pair +
    // price + delta) is left-aligned, leaving a lot of trailing
    // whitespace. Trim most of the right so the highlight hugs the
    // actual header content.
    boxAdjust: { right: -0.55 },
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
    // Asymmetric trim: more off the left than the right, which narrows
    // the box AND shifts it toward the right side of the ChartFrame so
    // it sits over the active forecast-fan area instead of the earlier
    // history.
    boxAdjust: { left: -0.20, right: -0.02 },
  },
  {
    id: 'providers',
    origin: { x: 86, y: 34 },
    scale: 2.3,
    box: { w: 28, h: 38 },
    tooltip: {
      num: '03',
      kicker: 'AI Providers',
      title: 'Internal & external AI provide possibile price paths',
      body: 'Multiple AI providers compete to offer price paths that users can select and use as a wager base. Multipliers reflect how the market has priced each path',
    },
    tooltipAnchor: { x: 18, y: 36 },
  },
  {
    id: 'drawPath',
    origin: { x: 86, y: 58 },
    scale: 2.5,
    box: { w: 28, h: 6 },
    tooltip: {
      num: '04',
      kicker: 'Custom Path',
      title: 'Draw your own conviction',
      body: "Beat the AI, keep the edge. Think you see something the models don't? Draw your own line on the chart. If you're right and the crowd is wrong, you earn more per dollar than anyone else.",
    },
    tooltipAnchor: { x: 18, y: 52 },
  },
  {
    id: 'leverage',
    origin: { x: 86, y: 70 },
    scale: 2.0,
    box: { w: 28, h: 14 },
    tooltip: {
      num: '05',
      kicker: 'Leverage',
      title: 'Size up your bets',
      body: 'Leverage cap scales with market length. Shorter markets carry higher ceilings',
    },
    tooltipAnchor: { x: 18, y: 58 },
    // The leverage marker tags only the label + slider block, but the
    // collateral input below it reads as part of the same "sizing"
    // beat — extend the frame downward to include it. Sides get a
    // small breathing-room extension so the highlight doesn't cut
    // flush against the rail edges at zoom.
    boxAdjust: { left: 0.08, right: 0.08, bottom: 1.25 },
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
 *
 * `stops` is the runtime-resolved tour config — see `useTourStops` in
 * LandingPage, which merges DOM measurements into the fallback config.
 */
function resolveCamera(
  progress4: number,
  stops: readonly TourStop[],
): {
  originX: number
  originY: number
  scale: number
} {
  const FULL_VIEW = { originX: 50, originY: 50, scale: 1 }
  // timeline: 0 at entry, 1 at stop 0, 2 at stop 1, ..., STOPS.length at stop N-1
  const timeline = progress4 * (stops.length + 0.4)

  if (timeline <= 0) return FULL_VIEW
  if (timeline >= stops.length) {
    const last = stops[stops.length - 1]
    return { originX: last.origin.x, originY: last.origin.y, scale: last.scale }
  }

  // Determine the two endpoints to interpolate between.
  const segment = Math.floor(timeline) // 0..STOPS.length-1
  const t = smoothstep(timeline - segment)
  const prev =
    segment === 0
      ? FULL_VIEW
      : {
          originX: stops[segment - 1].origin.x,
          originY: stops[segment - 1].origin.y,
          scale: stops[segment - 1].scale,
        }
  const next = stops[segment]
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
function tooltipVisibility(progress4: number, stopIndex: number, stopCount: number): number {
  const timeline = progress4 * (stopCount + 0.4)
  const peak = stopIndex + 1
  const d = Math.abs(timeline - peak)
  if (d < 0.25) return 1
  if (d > 0.55) return 0
  return 1 - (d - 0.25) / 0.3
}

function ChartTour({
  progress,
  stops,
}: {
  progress: number
  stops: readonly TourStop[]
}) {
  // Don't mount tooltips at all until phase 4 has started; this keeps
  // the DOM lean during phases 1-3 when no tooltip is visible.
  if (progress <= 0) return null
  return (
    <div aria-hidden={progress < 0.02} className="pointer-events-none fixed inset-0 z-[1250]">
      {stops.map((stop, i) => {
        const opacity = tooltipVisibility(progress, i, stops.length)
        if (opacity < 0.01) return null
        return <TourTooltip key={stop.id} stop={stop} opacity={opacity} />
      })}
    </div>
  )
}

function TourTooltip({
  stop,
  opacity,
}: {
  stop: TourStop
  opacity: number
}) {
  return (
    <div
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
 * Implemented as a cinematic spotlight: a viewport-wide dim layer with
 * a rounded-rect cutout over the currently-focused region, plus a
 * crisp white rim + soft brand-green halo around the cutout. The
 * focus region is interpolated (origin + box) between adjacent stops
 * as phase-4 scroll pans the camera, so the spotlight morphs smoothly
 * rather than snapping between stops. Tooltip cards float at their
 * configured anchors outside the lit area — the brightness contrast
 * carries the association without a leader line.
 */
function TourOverlay({
  progress,
  stops,
  cardRect,
}: {
  progress: number
  stops: readonly TourStop[]
  cardRect: DOMRect | null
}) {
  if (progress <= 0 || !cardRect || cardRect.width === 0) return null

  const focus = resolveFocusBox(progress, stops)
  if (!focus) return null

  // Floor the minimum rendered size so an extreme trim on boxAdjust
  // can't produce a zero-area cutout that would render as invisible.
  const focusW = Math.max(24, (focus.box.w / 100) * cardRect.width)
  const focusH = Math.max(24, (focus.box.h / 100) * cardRect.height)
  const focusCx = cardRect.left + (focus.origin.x / 100) * cardRect.width
  const focusCy = cardRect.top + (focus.origin.y / 100) * cardRect.height
  const focusLeft = focusCx - focusW / 2
  const focusTop = focusCy - focusH / 2
  const rx = 8

  // Stable mask id isn't strictly required (only one overlay exists),
  // but keeping it explicit documents intent.
  const maskId = 'tour-spotlight-mask'

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1245] h-screen w-screen"
    >
      <defs>
        {/* Feather filter on the cutout edge — reads as a soft vignette
            between lit and dim rather than a hard geometric cut. */}
        <filter id="tour-spotlight-feather" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={focusLeft}
            y={focusTop}
            width={focusW}
            height={focusH}
            rx={rx}
            fill="black"
            filter="url(#tour-spotlight-feather)"
          />
        </mask>
      </defs>

      {/* Dim layer — everything except the focused region is muted,
          pulling the user's eye straight to the lit cutout. Intensity
          ramps in as the camera commits to the first stop so the dim
          doesn't pop on instantly. */}
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.6)"
        mask={`url(#${maskId})`}
        opacity={focus.intensity}
      />

      {/* Outer brand-green halo — a blurred glow just beyond the rim.
          Gives the spotlight a "lit" quality instead of the flat look
          of a bare white border. */}
      <rect
        x={focusLeft - 3}
        y={focusTop - 3}
        width={focusW + 6}
        height={focusH + 6}
        rx={rx + 3}
        fill="none"
        stroke="rgba(92, 247, 139, 0.5)"
        strokeWidth={6}
        opacity={focus.intensity * 0.75}
        style={{ filter: 'blur(6px)' }}
      />

      {/* Crisp white rim — the primary edge of the lit region. Higher
          alpha (0.95) and thicker stroke (1.75) than the old hairline
          so it's clearly legible without the corner brackets. */}
      <rect
        x={focusLeft}
        y={focusTop}
        width={focusW}
        height={focusH}
        rx={rx}
        fill="none"
        stroke="rgba(255, 255, 255, 0.95)"
        strokeWidth={1.75}
        opacity={focus.intensity}
      />

    </svg>
  )
}

/**
 * Interpolate the current spotlight region from phase-4 progress.
 * Timeline mirrors `resolveCamera`'s so origin/scale/box stay aligned:
 *   • [0, 1]        — fade spotlight in while camera pans to stop 0.
 *   • [N, N+1]      — morph origin + box from stop N-1 to stop N.
 *   • [stops.length, …] — hold on final stop.
 *
 * `intensity` is the overall strength of the dim + rim (0-1) so the
 * overlay can fade in on entry without popping.
 */
function resolveFocusBox(
  progress4: number,
  stops: readonly TourStop[],
): {
  origin: { x: number; y: number }
  box: { w: number; h: number }
  intensity: number
} | null {
  const timeline = progress4 * (stops.length + 0.4)
  if (timeline <= 0) return null

  if (timeline >= stops.length) {
    const last = stops[stops.length - 1]
    return {
      origin: last.origin,
      box: last.box,
      intensity: 1,
    }
  }

  const segment = Math.floor(timeline)
  const t = smoothstep(timeline - segment)
  const next = stops[segment]
  if (segment === 0) {
    // Before the first stop — fade the spotlight in as the camera
    // arrives. Use `t` directly for intensity so nothing is visible
    // until timeline starts advancing.
    return {
      origin: next.origin,
      box: next.box,
      intensity: t,
    }
  }

  const prev = stops[segment - 1]
  return {
    origin: {
      x: lerp(prev.origin.x, next.origin.x, t),
      y: lerp(prev.origin.y, next.origin.y, t),
    },
    box: {
      w: lerp(prev.box.w, next.box.w, t),
      h: lerp(prev.box.h, next.box.h, t),
    },
    intensity: 1,
  }
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
  // Desktop-only: on mobile the pin wrapper is capped to one viewport
  // (no scroll room past the hero), and native touch scrolling beats
  // Lenis's RAF interpolation on small devices anyway.
  useEffect(() => {
    if (!introOverlayHidden) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(min-width: 768px)').matches) return

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
  // Tracks whether any phase-2/3/4 CSS transform is currently applied to
  // the card's ancestors. `getBoundingClientRect()` returns post-transform
  // dimensions, so if we recomputed `cardScale` while the card was rotated
  // or zoomed by the scroll-driven camera, the measured "logical" size
  // would be inflated by the ancestor scale and we'd feed a wrong scale
  // back into `zoom`. Freezing recomputation during scroll animations
  // preserves the scale the card had on entry — and the card's intrinsic
  // logical size doesn't change mid-tour, so there's nothing to recompute.
  const scrollXformActiveRef = useRef(false)

  // Live bounding rect of the market card — feeds the phase-4 TourOverlay
  // so highlight boxes + arrows can be drawn in viewport pixels over the
  // (transformed) card. Tracked on scroll/resize because phase-2/3/4
  // transforms move and scale the card's visible rect; getBoundingClientRect
  // returns the current post-transform box. For the tour geometry that's
  // exactly what we want — see TourOverlay for why.
  const [cardRect, setCardRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const compute = () => {
      // Skip while the scroll-driven camera is transforming the card.
      // `getBoundingClientRect()` would include those ancestor transforms
      // (e.g. phase-4 `scale(cam.scale)` around an off-center origin) and
      // feed a distorted aspect ratio back into `zoom`, producing the
      // wide-and-short collapse when the viewport crosses MarketPreview's
      // grid breakpoint mid-tour.
      if (scrollXformActiveRef.current) return
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

  // Measured per-stop layouts keyed by `data-tour` id — each entry is
  // the element's center and size expressed as a percentage of the
  // card's bounding box. Because both the card and its descendants are
  // scaled by the same phase transforms, these ratios are invariant
  // under the current camera state, so it's safe to measure at any
  // time (including during phases 2-4). The measurement overrides the
  // hardcoded `origin` + `box` in TOUR_STOPS_FALLBACK.
  const [tourLayouts, setTourLayouts] = useState<
    Record<string, { origin: { x: number; y: number }; box: { w: number; h: number } }>
  >({})

  useEffect(() => {
    const cardEl = cardRef.current
    if (!cardEl) return

    const measure = () => {
      const cardRect = cardEl.getBoundingClientRect()
      if (cardRect.width === 0 || cardRect.height === 0) return
      const next: Record<
        string,
        { origin: { x: number; y: number }; box: { w: number; h: number } }
      > = {}
      cardEl.querySelectorAll<HTMLElement>('[data-tour]').forEach((el) => {
        const id = el.dataset.tour
        if (!id) return
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        next[id] = {
          origin: {
            x: ((r.left + r.width / 2 - cardRect.left) / cardRect.width) * 100,
            y: ((r.top + r.height / 2 - cardRect.top) / cardRect.height) * 100,
          },
          box: {
            w: (r.width / cardRect.width) * 100,
            h: (r.height / cardRect.height) * 100,
          },
        }
      })
      setTourLayouts((prev) => {
        const prevKeys = Object.keys(prev)
        const nextKeys = Object.keys(next)
        if (prevKeys.length !== nextKeys.length) return next
        for (const k of nextKeys) {
          const p = prev[k]
          const n = next[k]
          if (!p) return next
          if (
            Math.abs(p.origin.x - n.origin.x) > 0.1 ||
            Math.abs(p.origin.y - n.origin.y) > 0.1 ||
            Math.abs(p.box.w - n.box.w) > 0.1 ||
            Math.abs(p.box.h - n.box.h) > 0.1
          ) {
            return next
          }
        }
        return prev
      })
    }

    // Measure on next paint so the MarketPreview children have mounted.
    const rafId = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(cardEl)
    // Any child growing/shrinking (e.g., wallet chip appearing, font
    // swap) changes the layout too — observe descendants as well.
    cardEl.querySelectorAll<HTMLElement>('[data-tour]').forEach((el) => ro.observe(el))
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Merge measurements into the fallback config. Until the first
  // measurement lands, the hardcoded values carry the camera — that
  // way we never flash the tour at (0, 0) before the DOM has rendered.
  //
  // `boxAdjust` (per-stop, optional) lets a stop extend or trim the
  // measured box on any side. Positive values extend outward; negative
  // trim inward. Origin re-centers to the adjusted rectangle so the
  // camera aims at the middle of the visible highlight.
  const resolvedTourStops = useMemo<readonly TourStop[]>(
    () =>
      TOUR_STOPS_FALLBACK.map((stop) => {
        const measured = tourLayouts[stop.id]
        if (!measured) return stop
        const adj = stop.boxAdjust
        if (!adj) return { ...stop, origin: measured.origin, box: measured.box }

        const padL = adj.left ?? 0
        const padR = adj.right ?? 0
        const padT = adj.top ?? 0
        const padB = adj.bottom ?? 0
        const { w, h } = measured.box
        return {
          ...stop,
          origin: {
            x: measured.origin.x + (w * (padR - padL)) / 2,
            y: measured.origin.y + (h * (padB - padT)) / 2,
          },
          box: {
            w: w * (1 + padL + padR),
            h: h * (1 + padT + padB),
          },
        }
      }),
    [tourLayouts],
  )

  // Four-phase hero scroll progress (all clamp 0-1).
  //   `scrollProgress`  — phase 1, 0..1 over the first 1.5 viewports; drives
  //                       the hero-intro fade + lift.
  //   `scrollProgress2` — phase 2, 0..1 over the next 1.5 viewports; drives
  //                       the market card's rightward slide + rotateY tilt,
  //                       and the right-rail callouts' reveal.
  //   `scrollProgress3` — phase 3, 0..1 over the following 2 viewports; drives
  //                       the un-tilt and settles the card at "full view"
  //                       (scale 1.0 — MarketPreview fully visible).
  //   `scrollProgress4` — phase 4, 0..1 over the following 5 viewports; drives
  //                       the guided tour across five tour stops (price, paths,
  //                       providers, draw-path, leverage).
  //   `scrollProgress5` — phase 5, 0..1 over the following 2 viewports; drives
  //                       the waitlist curtain's rise from the bottom of
  //                       the viewport, and the staggered fade-in of the
  //                       waitlist chrome + form inside it.
  // Pin wrapper sized to 1400vh — 12 viewports of scripted travel plus a
  // 100vh dwell past reveal=1 so the fully-staggered waitlist form gets a
  // resting beat at the bottom of the scroll (otherwise reveal=1 lines up
  // exactly with max scrollY and the final stagger ticks never settle in
  // practice). Thresholds: phase-1 0→1.5vh, phase-2 1.5→3vh, phase-3
  // 3→5vh, phase-4 5→10vh, phase-5 10→12vh, dwell 12→13vh.
  const [scrollProgress, setScrollProgress] = useState(0)
  const [scrollProgress2, setScrollProgress2] = useState(0)
  const [scrollProgress3, setScrollProgress3] = useState(0)
  const [scrollProgress4, setScrollProgress4] = useState(0)
  const [scrollProgress5, setScrollProgress5] = useState(0)
  useEffect(() => {
    const handleScroll = () => {
      const vh = window.innerHeight
      if (vh <= 0) return
      const y = window.scrollY
      const p2 = Math.max(0, Math.min(1, (y - vh * 1.5) / (vh * 1.5)))
      const p3 = Math.max(0, Math.min(1, (y - vh * 3) / (vh * 2)))
      const p4 = Math.max(0, Math.min(1, (y - vh * 5) / (vh * 5)))
      setScrollProgress(Math.max(0, Math.min(1, y / (vh * 1.5))))
      setScrollProgress2(p2)
      setScrollProgress3(p3)
      setScrollProgress4(p4)
      setScrollProgress5(Math.max(0, Math.min(1, (y - vh * 10) / (vh * 2))))
      // See `scrollXformActiveRef` declaration: gate the cardScale
      // ResizeObserver against phases that apply transforms to the card's
      // ancestors, so a mid-tour window resize doesn't feed distorted
      // getBoundingClientRect values back into zoom.
      scrollXformActiveRef.current = p2 > 0 || p3 > 0 || p4 > 0
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
    <main className="relative min-h-dvh w-full bg-black max-md:h-dvh max-md:max-h-dvh max-md:overflow-hidden">
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
          page scrolls. Hidden during the SpreadLogoReveal intro —
          `introOverlayHidden` flips true once the intro has fully faded
          out, and the nav eases in afterward so it doesn't compete
          visually with the logo reveal. z-[1400] keeps the X link
          clickable above the phase-5 WaitlistCurtain (z-[1300]), the
          ChartTour tooltips (z-[1250]), and the sticky hero section
          (z-[1100]). `safe-area-inset-top` padding on top of pb-4
          pushes the nav below an iOS notch / dynamic island. */}
      <div
        className={cn(
          'pointer-events-none fixed top-0 right-0 left-0 z-[1400] flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top),1rem)] pb-4 transition-opacity duration-700 ease-out',
          introOverlayHidden ? 'opacity-100' : 'opacity-0',
          introOverlayHidden && 'pointer-events-auto',
        )}
      >
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
          {/* Docs link placeholder — dimmed + non-interactive until the
              docs site goes live. Keeps the icon in the nav for visual
              balance without a broken `href="#"` target. */}
          <span
            aria-label="LevX docs (coming soon)"
            className="text-ink-dim pointer-events-none opacity-50"
          >
            <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </div>
      </div>

      {/* Pin wrapper — 1400vh tall on desktop for the full scripted
          story: 1.5 for phase 1 (hero intro fade) + 1.5 for phase 2
          (card slide + tilt) + 2 for phase 3 (un-tilt + settle at
          full view) + 5 for phase 4 (five-stop guided tour) + 2 for
          phase 5 (waitlist curtain rise) + 1 dwell. On mobile the
          wrapper caps to one viewport (`h-dvh`) so the user can't
          scroll past the hero — the zoom/tilt choreography doesn't
          read on small screens, and native touch scrolling past the
          card would strand the user in empty phase transitions. The
          card's "Join Waitlist" CTA still opens the modal. */}
      <div className="relative h-dvh md:h-[1400vh]">
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
              transform:
                scrollProgress2 > 0 || scrollProgress3 > 0
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
                    const uncrunch = easeOutCubic(Math.max(0, Math.min(1, scrollProgress3 / 0.35)))
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
                        const cam = resolveCamera(scrollProgress4, resolvedTourStops)
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

          {/* Phase-4 guided tour — five tooltips keyed to the camera
              panning/zooming across the card. One per feature: live
              price, forecast fan, providers, custom-path, leverage.
              Each fades in when the camera arrives at its stop and
              fades out as it moves to the next. TourOverlay renders
              the dashed highlight boxes + leader arrows beneath the
              tooltip cards; ChartTour renders the explainer cards
              themselves. */}
          <TourOverlay
            progress={scrollProgress4}
            stops={resolvedTourStops}
            cardRect={cardRect}
          />
          <ChartTour progress={scrollProgress4} stops={resolvedTourStops} />

          {/* Editorial scroll cue — hairline rule + mono caps + a green
              tracer that drops down the rule on a 2.4s cycle. Replaces
              the previous bare chevron with a piece of typographic
              instrumentation that matches the rest of the page's
              drafting language. Fades out the moment the user starts
              scrolling so it never competes with the title's fade. */}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute bottom-7 left-1/2 z-[1100] hidden -translate-x-1/2 transition-opacity duration-700 ease-out md:block',
              marketSettled && scrollProgress < 0.02 ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="flex flex-col items-center gap-2.5">
              <span className="text-nano animate-pulse font-mono tracking-[0.32em] text-white uppercase">
                Scroll
              </span>
              <span className="hero-scroll-rule" />
            </div>
          </div>
        </section>
      </div>

      {/* ── Waitlist curtain ──────────────────────────────────
          Phase-5 handoff. Rather than sliding a panel in from an edge,
          the transition is a "focus pull": the hero stays in place
          behind, but a viewport-wide overlay defocuses and desaturates
          it (backdrop-filter) while a black tint fades in on top. The
          waitlist composition materializes inside with a subtle scale
          emergence + register-by-register stagger — the same editorial
          cadence the HeroIntro uses on entrance, but played in reverse
          to close the page.

          The sticky hero is pinned throughout phase 5 (pin wrapper
          extended to 1400vh for this), so there's no competing scroll
          motion — only the overlay's focus shift. */}
      <WaitlistCurtain reveal={scrollProgress5} onSubmit={handleWaitlistSubmit} />

      <WaitlistModal
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        onSubmit={handleWaitlistSubmit}
      />
    </main>
  )
}

/** Focus-pull curtain hosting the inline waitlist form. The panel is
 * pinned to the viewport (`fixed inset-0`) and never literally slides —
 * instead, phase-5 scroll drives a cinematic handoff:
 *
 *   • Backdrop — blurs + desaturates the hero behind, like a camera
 *     rack-focus pulling off the near subject.
 *   • Tint — a black veil fades in on top, settling the hero into deep
 *     background.
 *   • Composition — inner content emerges from slight depth (scale
 *     0.96 → 1) while the HeroIntro-style registers (kicker rule,
 *     Bricolage title, mono spec strip, form frame) fade in one by
 *     one, mirroring the page's opening cadence in reverse.
 *
 * This reads as "the page shifts its attention" rather than "another
 * section scrolled in", which gives the close a more premium, editorial
 * beat than a simple translate. */
function WaitlistCurtain({
  reveal,
  onSubmit,
}: {
  reveal: number
  onSubmit: (payload: WaitlistPayload) => Promise<void> | void
}) {
  // Don't mount before phase-5 scroll begins — keeps DOM lean during
  // phases 1-4 and prevents the form from intercepting stray events
  // while invisible.
  if (reveal <= 0) return null

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)
  const easeInOut = (t: number) => {
    const x = clamp01(t)
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
  }

  // Focus pull — the backdrop blur + desaturation ramp in first (while
  // the tint is still thin), so the hero reads as "going out of focus"
  // before it's hidden by the veil. Both finish by reveal=0.72 so the
  // last third is pure settling.
  const defocusT = easeOutCubic(reveal / 0.72)
  const veilT = easeInOut(reveal / 0.85)

  // Emergent scale on the content wrapper — a small depth cue so the
  // composition feels like it comes forward as the backdrop recedes.
  const contentT = easeOutCubic(reveal / 0.9)
  const contentScale = 0.96 + 0.04 * contentT

  // Inner chrome stagger — begins once the veil has taken hold so the
  // registers feel like they're printing onto a settled surface rather
  // than materializing into a still-forming backdrop.
  const kickerT = easeOutCubic((reveal - 0.32) / 0.45)
  const titleT = easeOutCubic((reveal - 0.44) / 0.45)
  const specT = easeOutCubic((reveal - 0.54) / 0.45)
  const formT = easeOutCubic((reveal - 0.66) / 0.4)

  const itemStyle = (t: number, lift = 18) => ({
    opacity: t,
    transform: `translateY(${(1 - t) * lift}px)`,
    willChange: 'opacity, transform',
  })

  // Backdrop filter is the expensive part — skip it entirely before the
  // user commits to the transition (avoids paying full-viewport blur
  // cost for an imperceptible amount of filter).
  const blurPx = 28 * defocusT
  const saturate = 1 - 0.55 * defocusT
  const brightness = 1 - 0.35 * defocusT
  const backdropFilter =
    defocusT > 0.01 ? `blur(${blurPx}px) saturate(${saturate}) brightness(${brightness})` : 'none'

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center overflow-hidden px-6 py-20 sm:px-10 sm:py-24"
      style={{
        // Black veil that thickens as the user scrolls — pure alpha
        // animation, no translation, so the hero stays in place behind.
        backgroundColor: `rgba(0, 0, 0, ${veilT})`,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        // Only accept pointer events once the curtain is substantially
        // present, so the hero stays interactive early in the reveal.
        pointerEvents: reveal > 0.25 ? 'auto' : 'none',
        willChange: 'background-color, backdrop-filter',
      }}
    >
      {/* Ambient brand-green dither aura. Same language as the hero's
          landing-dither, but anchored here to tie the closing composition
          back to the opening. Its own opacity trails the veil slightly
          so the glow arrives after the scene has settled to black. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ opacity: 0.5 * easeOutCubic((reveal - 0.2) / 0.75) }}
      >
        <div className="landing-dither" />
      </div>

      {/* Soft center vignette — a faint radial fade that adds depth
          around the form, reading as a spotlight on the composition
          rather than flat black. Sits above the dither, below content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.85 * veilT,
          background:
            'radial-gradient(ellipse 60% 55% at 50% 52%, transparent 0%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.9) 100%)',
        }}
      />

      <div
        className="relative z-10 flex w-full max-w-[560px] flex-col items-center text-center"
        style={{
          transform: `scale(${contentScale})`,
          opacity: contentT,
          willChange: 'transform, opacity',
        }}
      >
        {/* Eyebrow kicker — hairline rules + mono caps, same as HeroIntro. */}
        <div className="flex items-center gap-3" style={itemStyle(kickerT, 10)}>
          <span aria-hidden className="hero-intro__rule" />
          <span className="text-ink-muted text-nano font-mono tracking-[0.32em] uppercase">
            Early Access <span className="text-ink-dim">·</span> v1 Devnet
          </span>
          <span aria-hidden className="hero-intro__rule hero-intro__rule--right" />
        </div>

        {/* Editorial display title — Bricolage Grotesque, one tier
            down from hero sizing so the closing doesn't compete. */}
        <h2
          className="text-ink-strong mt-7 text-[44px] leading-[0.96] tracking-[-0.035em] sm:text-[56px] md:text-[64px]"
          style={{
            fontFamily: 'var(--font-editorial)',
            fontVariationSettings: '"opsz" 96',
          }}
        >
          <span className="block" style={{ ...itemStyle(titleT, 22), fontWeight: 400 }}>
            Join the waitlist
          </span>
          <span
            className="text-ink-muted block"
            style={{ ...itemStyle(titleT, 22), fontWeight: 360 }}
          >
            Get early access
          </span>
        </h2>

        {/* Spec strip — mono-caps facts. */}
        <div
          className="text-nano mt-8 flex items-center justify-center gap-8 font-mono tracking-[0.28em] text-white/80 uppercase"
          style={itemStyle(specT, 12)}
        >
          <span>Live Scoring</span>
          <span>AI + Human Predictions</span>
          <span>No Order Book</span>
        </div>

        {/* Form — `tone="dark"` switches the input underline + focus
            colors to a white set that reads on the now-black backdrop. */}
        <div className="mt-12 w-full px-6 py-10 text-left sm:px-10 sm:py-12">
          <div style={itemStyle(formT, 16)}>
            <WaitlistForm onSubmit={onSubmit} tone="dark" />
          </div>
        </div>
      </div>
    </div>
  )
}

