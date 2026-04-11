import { create } from 'zustand'
import type { CheckpointCrossing, DrawingPhase, DrawingStore } from '@/lib/drawing/types'

const idleState: DrawingPhase = { phase: 'idle' }

export const useDrawingStore = create<DrawingStore>((set, get) => ({
  state: idleState,
  totalCheckpoints: 0,

  enterDrawMode: (totalCheckpoints) => {
    set({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) as null[] },
      totalCheckpoints,
    })
  },

  beginStroke: () => {
    const { state } = get()
    if (state.phase === 'drawMode') {
      set({ state: { phase: 'sweeping', values: state.values, pointerDown: true } })
    } else if (state.phase === 'ready') {
      // Multi-stroke re-entry: ready guarantees number[], widen to (number | null)[]
      const values: (number | null)[] = [...state.values]
      set({ state: { phase: 'sweeping', values, pointerDown: true } })
    }
    // idle / sweeping / confirming / submitted / error → noop
  },

  setCheckpointValues: (crossings: CheckpointCrossing[]) => {
    const { state } = get()
    if (state.phase !== 'sweeping') return
    const values = [...state.values]
    for (const c of crossings) {
      if (c.index >= 0 && c.index < values.length) {
        values[c.index] = c.y
      }
    }
    set({ state: { phase: 'sweeping', values, pointerDown: true } })
  },

  endStroke: () => {
    const { state } = get()
    if (state.phase !== 'sweeping') return
    const allFilled = state.values.every((v): v is number => v !== null)
    if (allFilled) {
      set({ state: { phase: 'ready', values: state.values as number[] } })
    } else {
      set({ state: { phase: 'drawMode', values: state.values } })
    }
  },

  reset: () => {
    const { totalCheckpoints } = get()
    if (totalCheckpoints === 0) return
    set({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) as null[] },
    })
  },

  exitDrawMode: () => {
    set({ state: idleState, totalCheckpoints: 0 })
  },

  confirm: () => {
    const { state } = get()
    if (state.phase !== 'ready') return
    set({ state: { phase: 'confirming', values: state.values } })
  },

  onTxSuccess: (txSig) => {
    set({ state: { phase: 'submitted', txSig } })
  },

  onTxError: (message) => {
    const { state } = get()
    let values: number[]
    if (state.phase === 'confirming' || state.phase === 'ready') {
      values = state.values
    } else if (state.phase === 'sweeping' || state.phase === 'drawMode') {
      values = state.values.filter((v): v is number => v !== null)
    } else {
      values = []
    }
    set({ state: { phase: 'error', message, values } })
  },
}))
