import { type CSSProperties, type PointerEvent } from 'react'
import { motion, useMotionTemplate, useMotionValue } from 'motion/react'

import { cn } from '@/lib/cn'

interface HeroCalloutCardProps {
  num: string
  kicker: string
  title: string
  body: string
  /** Reveal + transform styles from the parent (opacity, translateX, etc.). */
  style?: CSSProperties
  /** `local` reveal progress (0..1) for fading the dashed leader in sync. */
  leaderOpacity: number
}

/**
 * Annotation-style callout card for the landing hero's right rail.
 *
 * Inspired by reactbits' SpotlightCard + GlareHover patterns, layered on
 * top of the drafting/blueprint language already established on the page:
 *
 *   1. Gradient border ring — a radial-gradient-on-border-box trick that
 *      makes the 1px frame shimmer from brand-yellow → brand-green around
 *      the cursor (same primitive as `MagicCard`, retuned for a smaller
 *      surface and softer falloff).
 *   2. Cursor spotlight — a diffuse green radial glow that fades in on
 *      hover and follows the pointer, lifting the card off the dither
 *      background without competing with the chart.
 *   3. Diagonal glare sweep — a skewed sheen that rips across once per
 *      hover, matching the CRT/phosphor tone elsewhere on the landing.
 *   4. Left accent rail — vertical brand-gradient stripe that brightens
 *      on hover, reinforcing the "this is an annotation" language.
 *   5. Corner brackets — four L-shaped CAD marks at the corners, the
 *      same vocabulary as the oracle checkpoint ticks in the chart.
 *   6. Recording dot — the "Detail" label pairs with a pulsing green
 *      LED, giving the card a live-instrument feel.
 *
 * The mouse coordinates drive the radial gradients through MotionValues
 * (via `useMotionTemplate`) so there's no per-move React re-render.
 */
export function HeroCalloutCard({
  num,
  kicker,
  title,
  body,
  style,
  leaderOpacity,
}: HeroCalloutCardProps) {
  const mouseX = useMotionValue(-400)
  const mouseY = useMotionValue(-400)

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }

  const handlePointerLeave = () => {
    mouseX.set(-400)
    mouseY.set(-400)
  }

  // Border-box radial — bright at the cursor, falls off to a dim line
  // color at the perimeter. `padding-box` stays fully transparent so the
  // inner z-0 surface div paints the interior; only the 1px border ring
  // reads the radial gradient.
  const borderSpotlight = useMotionTemplate`
    linear-gradient(transparent 0 0) padding-box,
    radial-gradient(220px circle at ${mouseX}px ${mouseY}px,
      rgba(244, 250, 77, 0.85),
      rgba(92, 247, 139, 0.55) 40%,
      rgba(255, 255, 255, 0.08) 80%
    ) border-box
  `

  // Inner cursor glow — soft brand-green wash that only becomes visible
  // on hover (opacity gate via `group-hover`).
  const innerSpotlight = useMotionTemplate`
    radial-gradient(180px circle at ${mouseX}px ${mouseY}px,
      rgba(92, 247, 139, 0.18),
      transparent 70%
    )
  `

  return (
    <motion.article
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        'group pointer-events-auto relative isolate overflow-hidden rounded-sm',
        'border border-transparent',
      )}
      style={{
        ...style,
        background: borderSpotlight,
      }}
    >
      {/* Dashed annotation leader — extends off the card's left edge
          toward the tilted dashboard. Opacity synced to the reveal
          progress so it fades in alongside the card. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-full h-px w-[5vw] max-w-[72px] -translate-y-1/2"
        style={{
          background:
            'repeating-linear-gradient(to right, var(--color-line-strong) 0 4px, transparent 4px 8px)',
          opacity: leaderOpacity * 0.85,
        }}
      />

      {/* Leader terminator — tiny brand dot on the card's left edge
          that marks where the dashed line "lands". */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, var(--color-brand-to) 0%, var(--color-brand-to) 40%, transparent 75%)',
          opacity: leaderOpacity,
          boxShadow: '0 0 8px rgba(92, 247, 139, 0.9)',
        }}
      />

      {/* Inner surface fill — translucent dark, keeps the interior
          opaque against the chart/dither while the outer border paints
          the radial gradient ring behind it. */}
      <div
        aria-hidden="true"
        className="absolute inset-px z-0 rounded-[inherit]"
        style={{
          backgroundColor: 'rgba(14, 14, 14, 0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Left accent rail — brand-gradient stripe that brightens on
          hover. Gradient fades to transparent at both ends so the rail
          doesn't clash with the corner brackets. */}
      <span
        aria-hidden="true"
        className="duration-medium ease-levx pointer-events-none absolute top-0 left-0 z-10 h-full w-[2px] opacity-40 transition-opacity group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, var(--color-brand-from) 22%, var(--color-brand-to) 78%, transparent 100%)',
        }}
      />

      {/* Corner brackets — four L-shaped CAD ticks. Dimmed at rest,
          snap to full brand-green on hover. */}
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      {/* Cursor spotlight — soft inner green wash that fades in on
          hover. Sits above the surface fill (z-10) but below the
          content (z-40). */}
      <motion.div
        aria-hidden="true"
        className="duration-medium pointer-events-none absolute inset-px z-10 rounded-[inherit] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: innerSpotlight }}
      />

      {/* Diagonal glare sweep — skewed sheen that rips left→right on
          hover. The outer span clips so the sheen doesn't leak past
          the card edges; the inner span carries the gradient + the
          transition-transform it'll animate. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]"
      >
        <span
          className={cn(
            'absolute top-[-20%] left-0 h-[140%] w-[35%]',
            '-translate-x-[180%] skew-x-[-22deg]',
            'group-hover:translate-x-[420%]',
            'transition-transform duration-[900ms] ease-out',
          )}
          style={{
            background:
              'linear-gradient(100deg, transparent 10%, rgba(244, 250, 77, 0.10) 40%, rgba(92, 247, 139, 0.16) 55%, transparent 85%)',
          }}
        />
      </span>

      {/* Scanline veil — barely-there horizontal stripes that nod to
          the CRT aesthetic without reducing readability. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-[0.05] mix-blend-screen"
        style={{
          background:
            'repeating-linear-gradient(to bottom, transparent 0 2px, rgba(255,255,255,0.55) 2px 3px)',
        }}
      />

      {/* Content layer */}
      <div className="relative z-40">
        <header
          className={cn(
            'flex items-center border-b border-line px-4 py-2',
          )}
        >
          <span className="text-ink-muted flex items-center gap-1.5 font-mono text-nano tracking-[0.18em] uppercase">
            <span
              aria-hidden="true"
              className="inline-block h-[3px] w-[3px] rounded-full"
              style={{
                backgroundColor: 'var(--color-brand-to)',
                boxShadow: '0 0 6px rgba(92, 247, 139, 0.8)',
              }}
            />
            <span>
              {num} <span className="text-ink-dim">·</span> {kicker}
            </span>
          </span>
        </header>

        <div className="px-4 py-4">
          <h3 className="text-ink-strong text-body font-sans leading-snug tracking-tight">
            {title}
          </h3>
          <p className="text-ink-muted text-body-sm mt-2 font-sans leading-normal">
            {body}
          </p>
        </div>
      </div>
    </motion.article>
  )
}

function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const placement =
    position === 'tl'
      ? 'top-[5px] left-[5px] border-t border-l'
      : position === 'tr'
        ? 'top-[5px] right-[5px] border-t border-r'
        : position === 'bl'
          ? 'bottom-[5px] left-[5px] border-b border-l'
          : 'bottom-[5px] right-[5px] border-b border-r'
  return (
    <span
      aria-hidden="true"
      className={cn(
        'duration-medium ease-levx pointer-events-none absolute z-30 h-[9px] w-[9px] opacity-50 transition-opacity group-hover:opacity-100',
        placement,
      )}
      style={{
        borderColor: 'var(--color-brand-to)',
      }}
    />
  )
}
