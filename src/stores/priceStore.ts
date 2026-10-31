import { create } from 'zustand'
import type { FeedState, PriceTick } from '@/lib/price/types'

interface PriceStoreState {
  ticks: Record<string, PriceTick | undefined>
  feeds: Record<string, FeedState | undefined>
  levels: Record<string, number | undefined>
  setTick: (feedId: string, tick: PriceTick) => void
  setFeedState: (feedId: string, s: FeedState) => void
  setLevel: (feedId: string, k: number) => void
  getLatestTick: (feedId: string) => PriceTick | null
}

export const usePriceStore = create<PriceStoreState>((set, get) => ({
  ticks: {},
  feeds: {},
  levels: {},
  setTick: (feedId, tick) => {
    const prev = get().ticks[feedId]
    // Drop an equal or earlier publishTime (dedup and out-of-order guard)
    if (prev && tick.publishTime <= prev.publishTime) return
    set((s) => ({ ticks: { ...s.ticks, [feedId]: tick } }))
  },
  setFeedState: (feedId, s) => {
    const prev = get().feeds[feedId]
    // Keep the previous object when nothing changed, so once-a-second writers don't re-render readers
    if (
      prev &&
      prev.status === s.status &&
      prev.leveled === s.leveled &&
      prev.levelAgeSec === s.levelAgeSec
    ) {
      return
    }
    set((state) => ({ feeds: { ...state.feeds, [feedId]: s } }))
  },
  setLevel: (feedId, k) => set((s) => ({ levels: { ...s.levels, [feedId]: k } })),
  getLatestTick: (feedId) => get().ticks[feedId] ?? null,
}))
