import { useState } from 'react'

import { cn } from '@/lib/cn'
import { WaitlistModal } from '@/ui/WaitlistModal'

/** One set = texts + logo at the end. Repeated to fill wide viewports. */
const SET = [
  { type: 'text' as const, content: 'Waitlist Open' },
  { type: 'dot' as const },
  { type: 'text' as const, content: 'Devnet v1' },
  { type: 'logo' as const },
] as const

/**
 * Repeat enough sets so a SINGLE strip (one half of the track) is wider
 * than any realistic viewport. This is the load-bearing invariant for
 * the marquee:
 *
 *   total_track = 2 × strip_width  (the track holds two strip copies)
 *   translateX(-50%) = -strip_width
 *   visible_at(t)    = track[t × strip_width  →  t × strip_width + viewport_width]
 *
 * For the visible window to always sit on real content (no blank stretch
 * on the right edge during animation), we need:
 *
 *   strip_width ≥ viewport_width
 *
 * Each SET is ~250px rendered (Waitlist Open + dot + Devnet v1 + logo
 * with mr-4 on each). 30 SETs ≈ 7500px — comfortably exceeds ultra-wide
 * 4K (3840px) and beyond. Excess content stays off-screen via the
 * parent button's `overflow: hidden`; the only cost is DOM nodes.
 */
const ITEMS = Array.from({ length: 30 }, () => SET).flat()

/**
 * A continuously scrolling ticker banner. The content is duplicated so
 * that when the first copy scrolls out of view, the second copy seamlessly
 * takes its place — creating an infinite loop effect.
 *
 * Clicking anywhere on the banner opens the Waitlist signup modal.
 */
export function StreamingBanner() {
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  // Marquee math: flex `gap` creates N-1 spacers between N items, so
  // `translateX(-50%)` lands halfway through the gap between the two
  // copies (visible blank stretch + snap). Switching to uniform
  // `mr-4` (margin-right) on every item gives N margins for N items,
  // so the total width is `sum(items) + N × 16px` and -50% is exactly
  // `halfSum + halfN × 16px` — i.e., precisely the start of the
  // second copy. Last item's trailing margin acts as the gap before
  // the second copy begins.
  const renderItem = (item: (typeof ITEMS)[number], i: number, prefix: string) => {
    if (item.type === 'logo') {
      return (
        <img
          key={`${prefix}-logo-${i}`}
          src="/logo_color.png"
          alt=""
          className="mr-4 h-5 w-auto shrink-0 brightness-0"
        />
      )
    }
    if (item.type === 'dot') {
      return (
        <span
          key={`${prefix}-dot-${i}`}
          className="text-caption mr-4 shrink-0 font-mono font-medium text-black"
          aria-hidden="true"
        >
          •
        </span>
      )
    }
    return (
      <span
        key={`${prefix}-text-${i}`}
        className="text-caption mr-4 shrink-0 font-mono font-medium whitespace-nowrap text-black uppercase"
      >
        {item.content}
      </span>
    )
  }

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
        <div className="streaming-banner-track flex w-max items-center" aria-hidden="true">
          {ITEMS.map((item, i) => renderItem(item, i, 'a'))}
          {ITEMS.map((item, i) => renderItem(item, i, 'b'))}
        </div>
      </button>

      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </>
  )
}
