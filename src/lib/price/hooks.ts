import { useLeveledFeed } from '@/lib/price/freeFeed'
import { usePythHermesFeed } from '@/lib/price/pythFeed'
import { priceSource } from '@/lib/price/source'
import type { FeedState, PriceTick } from '@/lib/price/types'
import { usePriceStore } from '@/stores/priceStore'

/**
 * Keeps the feed's live price in the price store while mounted. The provider is chosen once, at
 * load: Pyth's Hermes stream when APP_PRICE_SOURCE is pyth, else the leveled Coinbase feed.
 */
export const usePriceFeed: (feedId: string | null) => void =
  priceSource() === 'pyth' ? usePythHermesFeed : useLeveledFeed

/** The feed's latest tick, or null; re-renders only when that tick changes. */
export function useLatestPrice(feedId: string | null): PriceTick | null {
  return usePriceStore((s) => (feedId ? (s.ticks[feedId] ?? null) : null))
}

const NO_TRAIL: readonly PriceTick[] = []

/**
 * The feed's accepted ticks, oldest first (the once-a-second line since the feed started, up to
 * three hours); the same array until the feed's own next tick.
 */
export function usePriceTrail(feedId: string | null): readonly PriceTick[] {
  return usePriceStore((s) => (feedId ? (s.trails[feedId] ?? NO_TRAIL) : NO_TRAIL))
}

/** How the feed's live price is being produced, or null before the feed has reported. */
export function useFeedState(feedId: string | null): FeedState | null {
  return usePriceStore((s) => (feedId ? (s.feeds[feedId] ?? null) : null))
}

/** The feed's level factor (Pyth / Coinbase), or null while it is unleveled. */
export function useLevel(feedId: string | null): number | null {
  return usePriceStore((s) => (feedId ? (s.levels[feedId] ?? null) : null))
}
