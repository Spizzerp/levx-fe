import { create } from 'zustand'
import type { CheckpointCrossing, DrawingPhase, DrawingStore, ToolId } from '@/lib/drawing/types'

const idleState: DrawingPhase = { phase: 'idle' }

const UNDO_STACK_LIMIT = 50

const EMPTY_SELECTION: ReadonlySet<number> = new Set<number>()

export const useDrawingStore = create<DrawingStore>((set, get) => ({
  state: idleState,
  totalCheckpoints: 0,
  activeTool: 'freehand' as ToolId,
  selectedIndices: EMPTY_SELECTION,
  undoStack: [],
  redoStack: [],

  enterDrawMode: (totalCheckpoints) => {
    set({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) as null[] },
      totalCheckpoints,
      selectedIndices: EMPTY_SELECTION,
      undoStack: [],
      redoStack: [],
    })
  },

  beginStroke: () => {
    const { state, undoStack } = get()
    if (state.phase === 'drawMode') {
      const snapshot = [...state.values]
      const trimmed = undoStack.length >= UNDO_STACK_LIMIT ? undoStack.slice(1) : undoStack
      set({
        state: { phase: 'sweeping', values: state.values, pointerDown: true },
        undoStack: [...trimmed, snapshot],
        // Branching from a (possibly partial) undo: the redo future is no
        // longer reachable.
        redoStack: [],
      })
    } else if (state.phase === 'ready') {
      // Multi-stroke re-entry: ready guarantees number[], widen to (number | null)[]
      const values: (number | null)[] = [...state.values]
      const snapshot = [...state.values] as (number | null)[]
      const trimmed = undoStack.length >= UNDO_STACK_LIMIT ? undoStack.slice(1) : undoStack
      set({
        state: { phase: 'sweeping', values, pointerDown: true },
        undoStack: [...trimmed, snapshot],
        redoStack: [],
      })
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
      selectedIndices: EMPTY_SELECTION,
      undoStack: [],
      redoStack: [],
    })
  },

  exitDrawMode: () => {
    set({
      state: idleState,
      totalCheckpoints: 0,
      selectedIndices: EMPTY_SELECTION,
      undoStack: [],
      redoStack: [],
    })
  },

  confirm: () => {
    const { state } = get()
    if (state.phase !== 'ready') return
    set({ state: { phase: 'confirming', values: state.values } })
  },

  onTxSuccess: (txSig) => {
    set({ state: { phase: 'submitted', txSig }, selectedIndices: EMPTY_SELECTION })
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

  setActiveTool: (tool) => {
    set({ activeTool: tool })
  },

  setSelectedIndices: (indices) => {
    set({ selectedIndices: indices })
  },

  clearSelectedIndices: () => {
    set({ selectedIndices: EMPTY_SELECTION })
  },

  undo: () => {
    const { state, undoStack, redoStack } = get()
    // Only safe to undo from quiescent phases — sweeping has live pointer
    // capture, post-submit phases shouldn't be rewound.
    if (state.phase !== 'drawMode' && state.phase !== 'ready') return
    if (undoStack.length === 0) return

    const prev = undoStack[undoStack.length - 1]
    const newUndo = undoStack.slice(0, -1)
    const current: (number | null)[] = [...state.values]
    const trimmedRedo = redoStack.length >= UNDO_STACK_LIMIT ? redoStack.slice(1) : redoStack
    const newRedo = [...trimmedRedo, current]
    const allFilled = prev.every((v): v is number => v !== null)

    if (allFilled) {
      set({
        state: { phase: 'ready', values: prev as number[] },
        undoStack: newUndo,
        redoStack: newRedo,
      })
    } else {
      set({
        state: { phase: 'drawMode', values: prev },
        undoStack: newUndo,
        redoStack: newRedo,
      })
    }
  },

  redo: () => {
    const { state, undoStack, redoStack } = get()
    if (state.phase !== 'drawMode' && state.phase !== 'ready') return
    if (redoStack.length === 0) return

    const next = redoStack[redoStack.length - 1]
    const newRedo = redoStack.slice(0, -1)
    const current: (number | null)[] = [...state.values]
    const trimmedUndo = undoStack.length >= UNDO_STACK_LIMIT ? undoStack.slice(1) : undoStack
    const newUndo = [...trimmedUndo, current]
    const allFilled = next.every((v): v is number => v !== null)

    if (allFilled) {
      set({
        state: { phase: 'ready', values: next as number[] },
        undoStack: newUndo,
        redoStack: newRedo,
      })
    } else {
      set({
        state: { phase: 'drawMode', values: next },
        undoStack: newUndo,
        redoStack: newRedo,
      })
    }
  },
}))
