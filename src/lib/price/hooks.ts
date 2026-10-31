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

/** How the feed's live price is being produced, or null before the feed has reported. */
export function useFeedState(feedId: string | null): FeedState | null {
  return usePriceStore((s) => (feedId ? (s.feeds[feedId] ?? null) : null))
}

/** The feed's level factor (Pyth / Coinbase), or null while it is unleveled. */
export function useLevel(feedId: string | null): number | null {
  return usePriceStore((s) => (feedId ? (s.levels[feedId] ?? null) : null))
}
