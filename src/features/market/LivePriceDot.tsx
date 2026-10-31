import { cn } from '@/lib/cn'
import { LEVEL_STALE_SEC } from '@/lib/price/leveling'
import { priceSource } from '@/lib/price/source'
import type { FeedState } from '@/lib/price/types'
import { usePriceStore } from '@/stores/priceStore'

/** The hover copy for a feed's state; while the level is old it changes once a minute. */
function hoverCopy(state: FeedState): string {
  if (state.status === 'delayed') return "Price delayed: the live price stream isn't updating."
  if (priceSource() === 'pyth') return 'Live price from Pyth.'
  if (!state.leveled) {
    return "Live price from Coinbase trades. Pyth's level isn't available for this pair."
  }
  if (state.levelAgeSec !== null && state.levelAgeSec > LEVEL_STALE_SEC) {
    const minutes = Math.floor(state.levelAgeSec / 60)
    return `Live price from Coinbase trades. Pyth's level last updated ${minutes} min ago. Markets settle on Pyth.`
  }
  return "Live price from Coinbase trades, kept on Pyth's level. Markets settle on Pyth."
}

/** A small Live / Delayed dot for the feed's live price; the source is explained on hover. */
export function LivePriceDot({ feedId }: { feedId: string | null }) {
  // Primitives only: the feed rewrites levelAgeSec every second, the copy changes at most per minute
  const status = usePriceStore((s) => (feedId ? s.feeds[feedId]?.status : undefined))
  const title = usePriceStore((s) => {
    const state = feedId ? s.feeds[feedId] : undefined
    return state ? hoverCopy(state) : null
  })
  if (!status || !title) return null

  const live = status === 'live'
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono uppercase',
        live ? 'text-success' : 'text-warning',
      )}
    >
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-success' : 'bg-warning')}
      />
      {live ? 'Live' : 'Delayed'}
    </span>
  )
}
