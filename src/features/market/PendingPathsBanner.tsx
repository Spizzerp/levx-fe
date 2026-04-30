import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/cn'
import type { Market } from '@/types/market'

interface PendingPathsBannerProps {
  market: Market
  className?: string
}

const TARGET_PATHS = 3

/**
 * Renders for `Pending` markets that have not yet reached the minimum
 * path count required for activation. The pipeline submits AI paths
 * via `add_path` over a short window before `start_time`; until then
 * the user sees an "AI is generating paths…" indicator that updates
 * live as PR2's `PathAdded` events invalidate `useMarket`.
 *
 * Only mounted when `market.state === 'pending'` AND `numPaths < 3`.
 * Other states (Active onward) render the regular path list.
 */
export function PendingPathsBanner({ market, className }: PendingPathsBannerProps) {
  const have = Math.min(market.numPaths, TARGET_PATHS)
  return (
    <div
      className={cn(
        'border-line flex flex-col items-center gap-3 border border-dashed p-6',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2
        size={20}
        strokeWidth={1.75}
        className="text-ink-dim animate-spin"
        aria-hidden
      />
      <p className="text-ink-strong text-caption font-mono uppercase tracking-wide">
        AI is generating paths…
      </p>
      <p className="text-ink-muted text-caption font-mono">
        {have} / {TARGET_PATHS} paths arrived
      </p>
    </div>
  )
}
