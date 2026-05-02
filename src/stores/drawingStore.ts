import { create } from 'zustand'
import type {
  CheckpointCrossing,
  DrawingPhase,
  DrawingStore,
  HistoryEntry,
  ToolId,
} from '@/lib/drawing/types'

const idleState: DrawingPhase = { phase: 'idle' }

const UNDO_STACK_LIMIT = 50

const EMPTY_SELECTION: ReadonlySet<number> = new Set<number>()

const EMPTY_VALUES: readonly (number | null)[] = []

/** True iff two ReadonlySet<number> have identical contents. */
function selectionsEqual(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

/** Append `entry` to `stack`, trimming the front when over `UNDO_STACK_LIMIT`. */
function pushBounded(stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const trimmed = stack.length >= UNDO_STACK_LIMIT ? stack.slice(1) : stack
  return [...trimmed, entry]
}

/**
 * Drop indices from a selection whose corresponding value is null. Returns
 * the original reference if nothing changed (avoids Zustand selector churn).
 *
 * Defensive guard inside undo/redo: with selection mutations now in the
 * unified queue, the chronological flow rarely produces stale selections,
 * but a direct setState (tests, future code paths) can still leave them.
 */
function pruneSelectionToFilled(
  selection: ReadonlySet<number>,
  values: readonly (number | null)[],
): ReadonlySet<number> {
  if (selection.size === 0) return selection
  let changed = false
  const next = new Set<number>()
  for (const i of selection) {
    if (i >= 0 && i < values.length && values[i] !== null) {
      next.add(i)
    } else {
      changed = true
    }
  }
  return changed ? next : selection
}

/**
 * Read the values array from a drawing-store state, regardless of phase.
 * Returns a stable empty reference for phases that don't carry values
 * (idle / submitted), so callers using this in a selector don't trigger
 * Zustand re-render loops.
 */
export function selectValues(state: DrawingPhase): readonly (number | null)[] {
  if (
    state.phase === 'drawMode' ||
    state.phase === 'sweeping' ||
    state.phase === 'ready' ||
    state.phase === 'confirming' ||
    state.phase === 'error'
  ) {
    return state.values as (number | null)[]
  }
  return EMPTY_VALUES
}

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
      set({
        state: { phase: 'sweeping', values: state.values, pointerDown: true },
        undoStack: pushBounded(undoStack, { kind: 'values', values: snapshot }),
        // Branching from a (possibly partial) undo: the redo future is no
        // longer reachable.
        redoStack: [],
      })
    } else if (state.phase === 'ready') {
      // Multi-stroke re-entry: ready guarantees number[], widen to (number | null)[]
      const values: (number | null)[] = [...state.values]
      const snapshot = [...state.values] as (number | null)[]
      set({
        state: { phase: 'sweeping', values, pointerDown: true },
        undoStack: pushBounded(undoStack, { kind: 'values', values: snapshot }),
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
    const { selectedIndices, undoStack } = get()
    if (selectionsEqual(selectedIndices, indices)) return
    set({
      selectedIndices: indices,
      undoStack: pushBounded(undoStack, { kind: 'selection', selection: selectedIndices }),
      // Branching: a fresh action invalidates the redo future.
      redoStack: [],
    })
  },

  clearSelectedIndices: () => {
    const { selectedIndices, undoStack } = get()
    if (selectedIndices.size === 0) return
    set({
      selectedIndices: EMPTY_SELECTION,
      undoStack: pushBounded(undoStack, { kind: 'selection', selection: selectedIndices }),
      redoStack: [],
    })
  },

  undo: () => {
    const { state, undoStack, redoStack, selectedIndices } = get()
    // Only safe to undo from quiescent phases — sweeping has live pointer
    // capture, post-submit phases shouldn't be rewound.
    if (state.phase !== 'drawMode' && state.phase !== 'ready') return
    if (undoStack.length === 0) return

    const entry = undoStack[undoStack.length - 1]
    const newUndo = undoStack.slice(0, -1)

    if (entry.kind === 'selection') {
      // Push the current selection onto redo, restore the snapshot.
      set({
        selectedIndices: entry.selection,
        undoStack: newUndo,
        redoStack: pushBounded(redoStack, { kind: 'selection', selection: selectedIndices }),
      })
      return
    }

    // values entry — restore the snapshot, recompute phase from filled state.
    const prev = entry.values
    const current: (number | null)[] = [...state.values]
    const allFilled = prev.every((v): v is number => v !== null)
    const prunedSelection = pruneSelectionToFilled(selectedIndices, prev)
    const newRedo = pushBounded(redoStack, { kind: 'values', values: current })

    if (allFilled) {
      set({
        state: { phase: 'ready', values: prev as number[] },
        undoStack: newUndo,
        redoStack: newRedo,
        selectedIndices: prunedSelection,
      })
    } else {
      set({
        state: { phase: 'drawMode', values: prev },
        undoStack: newUndo,
        redoStack: newRedo,
        selectedIndices: prunedSelection,
      })
    }
  },

  redo: () => {
    const { state, undoStack, redoStack, selectedIndices } = get()
    if (state.phase !== 'drawMode' && state.phase !== 'ready') return
    if (redoStack.length === 0) return

    const entry = redoStack[redoStack.length - 1]
    const newRedo = redoStack.slice(0, -1)

    if (entry.kind === 'selection') {
      set({
        selectedIndices: entry.selection,
        undoStack: pushBounded(undoStack, { kind: 'selection', selection: selectedIndices }),
        redoStack: newRedo,
      })
      return
    }

    const next = entry.values
    const current: (number | null)[] = [...state.values]
    const allFilled = next.every((v): v is number => v !== null)
    const prunedSelection = pruneSelectionToFilled(selectedIndices, next)
    const newUndo = pushBounded(undoStack, { kind: 'values', values: current })

    if (allFilled) {
      set({
        state: { phase: 'ready', values: next as number[] },
        undoStack: newUndo,
        redoStack: newRedo,
        selectedIndices: prunedSelection,
      })
    } else {
      set({
        state: { phase: 'drawMode', values: next },
        undoStack: newUndo,
        redoStack: newRedo,
        selectedIndices: prunedSelection,
      })
    }
  },
}))
