import { type CSSProperties } from 'react'

import { MagicCard } from '@/ui/MagicCard'
import { TiltCard } from '@/ui/TiltCard'

interface TourCalloutCardProps {
  num: string
  kicker: string
  title: string
  body: string
  style?: CSSProperties
}

/**
 * Tour-overlay variant of the callout card — same content layout as
 * HeroCalloutCard but pinned inside an outlined wrapper so it visually
 * pairs with the white dashed highlight box that TourOverlay draws over
 * the focused region of the market card. No leader dot here: the dashed
 * leader line from TourOverlay already connects the card to its target.
 *
 * The outline lives on an absolutely-positioned sibling inside TiltCard
 * so it sits within TiltCard's overflow-hidden box (otherwise a ring
 * drawn outside MagicCard would be clipped). pointer-events-none keeps
 * MagicCard's cursor-follow spotlight receiving hover events.
 */
export function TourCalloutCard({
  num,
  kicker,
  title,
  body,
  style,
}: TourCalloutCardProps) {
  return (
    <div className="relative" style={style}>
      <TiltCard
        tiltLimit={12}
        scale={1.03}
        perspective={1400}
        effect="evade"
        spotlight={false}
        className="rounded-lg"
      >
        <div className="relative rounded-lg">
          <MagicCard className="rounded-lg" gradientSize={220}>
            <header className="flex items-center border-b border-line px-4 py-2">
              <span className="text-ink-muted font-mono text-nano tracking-[0.18em] uppercase">
                {num} <span className="text-ink-dim">·</span> {kicker}
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
          </MagicCard>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-lg border border-white"
          />
        </div>
      </TiltCard>
    </div>
  )
}
