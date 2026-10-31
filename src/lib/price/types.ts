/** One price point for a feed, whatever the source. */
export interface PriceTick {
  /** unix ms */
  time: number
  /** price in quote units */
  value: number
  /** unix seconds, the dedup key */
  publishTime: number
}

/** How a feed's live price is being produced. */
export interface FeedState {
  status: 'live' | 'delayed'
  /** true when the live price is kept on Pyth's level */
  leveled: boolean
  /** seconds since Pyth's level last updated, null when there is none */
  levelAgeSec: number | null
}
