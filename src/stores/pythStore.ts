import { create } from 'zustand'
import type { PythStatus, PythTick } from '@/lib/pyth/types'

interface PythStoreState {
  ticks: Record<string, PythTick | undefined>
  status: PythStatus
  setPythTick: (feedId: string, tick: PythTick) => void
  setStatus: (status: PythStatus) => void
  getLatestTick: (feedId: string) => PythTick | null
}

export const usePythStore = create<PythStoreState>((set, get) => ({
  ticks: {},
  status: 'idle',
  setPythTick: (feedId, tick) => {
    const prev = get().ticks[feedId]
    // Drop equal or earlier publishTime (dedup + out-of-order guard per CHART-03)
    if (prev && tick.publishTime <= prev.publishTime) return
    set((s) => ({ ticks: { ...s.ticks, [feedId]: tick } }))
  },
  setStatus: (status) => set({ status }),
  getLatestTick: (feedId) => get().ticks[feedId] ?? null,
}))
