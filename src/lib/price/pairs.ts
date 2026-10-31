import { PYTH_FEED_IDS } from '@/lib/pyth/feedIds'
import type { SupportedPair } from '@/lib/pyth/feedIds'

/** Coinbase Exchange product per pair. Coinbase quotes against USD, as Pyth's feeds do. */
export const COINBASE_PRODUCTS: Record<SupportedPair, string> = {
  'SOL/USDC': 'SOL-USD',
  'BTC/USDC': 'BTC-USD',
  'ETH/USDC': 'ETH-USD',
}

const PAIRS = Object.keys(PYTH_FEED_IDS) as SupportedPair[]

const normalize = (feedId: string) => feedId.toLowerCase().replace(/^0x/, '')

/** The pair whose Pyth feed id this is; case-insensitive, with or without 0x. */
export function pairForFeedId(feedId: string): SupportedPair | null {
  const id = normalize(feedId)
  return PAIRS.find((pair) => normalize(PYTH_FEED_IDS[pair]) === id) ?? null
}
