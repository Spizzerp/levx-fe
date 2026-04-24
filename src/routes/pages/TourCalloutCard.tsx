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
 * Tour-overlay variant of the callout card. Shares its chrome vocabulary
 * with the phase-4 overlay brackets so the tooltip reads as "the
 * annotation attached to the viewfinder":
 *
 *   • Hairline outer ring (white ~15% alpha) instead of a chunky solid
 *     border — lets the MagicCard's cursor-follow spotlight do the
 *     heavy lifting for edge definition.
 *   • Header has a brand-green dot leading the kicker (matches the
 *     brand accent on each bracket's inner tip) and a subdued step
 *     number on the right so the reader can track tour position
 *     without the number dominating the card.
 *   • Soft layered drop-shadow lifts the card off the dither backdrop
 *     with a whisper of brand-green so it feels lit, not pasted on.
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
        tiltLimit={8}
        scale={1.015}
        perspective={1400}
        effect="evade"
        spotlight={false}
        className="rounded-lg"
      >
        <div
          className="relative rounded-lg"
          style={{
            boxShadow:
              '0 24px 60px rgba(0, 0, 0, 0.55), 0 0 42px rgba(92, 247, 139, 0.08)',
          }}
        >
          <MagicCard className="rounded-lg" gradientSize={260}>
            <header className="border-line/60 flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="bg-brand-to inline-block h-1 w-1 rounded-full"
                  style={{ boxShadow: '0 0 6px rgba(92, 247, 139, 0.9)' }}
                />
                <span className="text-ink-muted font-mono text-nano tracking-[0.22em] uppercase">
                  {kicker}
                </span>
              </div>
              <span className="text-ink-dim font-mono text-nano tracking-[0.22em]">
                {num}
              </span>
            </header>

            <div className="px-5 py-4">
              <h3 className="text-ink-strong text-body font-sans leading-snug tracking-tight">
                {title}
              </h3>
              <p className="text-ink-muted text-body-sm mt-2 font-sans leading-relaxed">
                {body}
              </p>
            </div>
          </MagicCard>

          {/* Hairline ring — replaces the old solid white border. Sits
              above MagicCard inside TiltCard's overflow-hidden box so
              it doesn't get clipped. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-lg border border-white/15"
          />
        </div>
      </TiltCard>
    </div>
  )
}
