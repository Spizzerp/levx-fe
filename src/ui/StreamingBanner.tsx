import { useState } from 'react'

import { cn } from '@/lib/cn'
import { WaitlistModal } from '@/ui/WaitlistModal'

/** One set = texts + logo at the end. Repeated to fill wide viewports. */
const SET = [
  { type: 'text' as const, content: 'Waitlist Open' },
  { type: 'text' as const, content: 'Devnet ONLY' },
  { type: 'text' as const, content: 'v1' },
  { type: 'logo' as const },
] as const

/** Repeat enough sets so the strip always exceeds viewport width. */
const ITEMS = [...SET, ...SET, ...SET, ...SET, ...SET]

/**
 * A continuously scrolling ticker banner. The content is duplicated so
 * that when the first copy scrolls out of view, the second copy seamlessly
 * takes its place — creating an infinite loop effect.
 *
 * Clicking anywhere on the banner opens the Waitlist signup modal.
 */
export function StreamingBanner() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  const strip = (
    <div className="flex shrink-0 items-center gap-8" aria-hidden="true">
      {ITEMS.map((item, i) =>
        item.type === 'logo' ? (
          <img key={`logo-${i}`} src="/logo_color.png" alt="" className="h-6 w-auto brightness-0" />
        ) : (
          <span
            key={`text-${i}`}
            className="text-caption font-mono whitespace-nowrap text-black uppercase"
          >
            {item.content}
          </span>
        ),
      )}
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setWaitlistOpen(true)}
        className={cn(
          'w-full cursor-pointer overflow-hidden',
          'from-brand-from to-brand-to bg-gradient-to-r',
          'py-1.5',
          'duration-short ease-levx transition-opacity hover:opacity-80',
        )}
      >
        <div className="streaming-banner-track flex w-max gap-8">
          {strip}
          {strip}
        </div>
      </button>

      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </>
  )
}
