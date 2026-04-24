import { type CSSProperties } from 'react'

import { MagicCard } from '@/ui/MagicCard'
import { TiltCard } from '@/ui/TiltCard'

interface HeroCalloutCardProps {
  num: string
  kicker: string
  title: string
  body: string
  style?: CSSProperties
  leaderOpacity: number
}

export function HeroCalloutCard({
  num,
  kicker,
  title,
  body,
  style,
  leaderOpacity,
}: HeroCalloutCardProps) {
  return (
    <div className={`relative ${leaderOpacity > 0.1 ? 'pointer-events-auto' : 'pointer-events-none'}`} style={style}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-0 h-1.5 w-1.5 -translate-x-[300%] -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, var(--color-brand-to) 0%, var(--color-brand-to) 40%, transparent 75%)',
          opacity: leaderOpacity,
          boxShadow: '0 0 8px rgba(92, 247, 139, 0.9)',
        }}
      />

      <TiltCard
        tiltLimit={12}
        scale={1.03}
        perspective={1400}
        effect="evade"
        spotlight={false}
        className="rounded-lg"
      >
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
      </TiltCard>
    </div>
  )
}
