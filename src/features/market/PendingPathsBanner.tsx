import { cn } from '@/lib/cn'
import type { Market } from '@/types/market'
import { DotmCircular8 } from '@/ui/dotmatrix/dotm-circular-8'

interface PendingPathsBannerProps {
  market: Market
  className?: string
}

const TARGET_PATHS = 3

/**
 * Slim inline status indicator for `Pending` markets that have not yet
 * reached the minimum path count required for activation. The pipeline
 * submits AI paths via `add_path` over a short window before
 * `start_time`; until then the user sees an "AI is generating paths…"
 * line that updates live as PR2's `PathAdded` events invalidate
 * `useMarket`.
 *
 * Designed to embed at the top of the wager rail rather than fill a
 * standalone aside — the wager form stays visible underneath even
 * when paths aren't ready yet, with its controls disabled. Users see
 * the bet they could place rather than a blank waiting room.
 */
export function PendingPathsBanner({ market, className }: PendingPathsBannerProps) {
  const have = Math.min(market.numPaths, TARGET_PATHS)
  return (
    <div
      className={cn('flex items-center gap-3', className)}
      role="status"
      aria-live="polite"
    >
      <DotmCircular8 className="text-ink-dim shrink-0" />
      <div className="flex flex-col">
        <p className="text-ink-strong text-caption font-mono uppercase tracking-wide">
          AI is generating paths…
        </p>
        <p className="text-ink-muted text-caption font-mono">
          {have} / {TARGET_PATHS} paths arrived
        </p>
      </div>
    </div>
  )
}
