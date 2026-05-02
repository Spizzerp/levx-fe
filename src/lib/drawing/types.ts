/**
 * Drawing domain types — no React, no DOM.
 *
 * The drawing editor is a discriminated-union state machine:
 *   idle → drawMode → sweeping → ready → confirming → submitted | error
 *
 * `sweeping` is the active-pointer state. It can be re-entered from
 * both `drawMode` (partial fill) and `ready` (multi-stroke overwrite).
 */

/** One checkpoint column crossed during a pointermove sweep. */
export interface CheckpointCrossing {
  /** Index into checkpointXs / drawingStore.values */
  index: number
  /** Domain price at the crossing (linearly interpolated) */
  y: number
}

/**
 * Authoring tool selected in the floating drawing toolbar.
 * Each tool produces checkpoint y-values via the same store actions, but
 * differs in how the user inputs them (sweep, click anchors, drag handles…).
 */
export type ToolId = 'freehand' | 'line' | 'bezier' | 'select'

/** Discriminated union of every drawing editor state. */
export type DrawingPhase =
  | { phase: 'idle' }
  | { phase: 'drawMode'; values: (number | null)[] }
  | { phase: 'sweeping'; values: (number | null)[]; pointerDown: true }
  | { phase: 'ready'; values: number[] } // all non-null, guaranteed
  | { phase: 'confirming'; values: number[] }
  | { phase: 'submitted'; txSig: string }
  | { phase: 'error'; message: string; values: number[] }

/** Shape of the full Zustand drawing store slice (actions + state). */
export interface DrawingStore {
  state: DrawingPhase
  totalCheckpoints: number
  activeTool: ToolId
  /**
   * Indices of checkpoints currently selected via the SelectTool. Persists
   * across tool switches but is cleared on enterDrawMode / reset / exit /
   * onTxSuccess. Stale indices (pointing to null values after undo) are
   * silently filtered at render — the store does not try to keep this in
   * sync with values changes.
   */
  selectedIndices: ReadonlySet<number>
  /**
   * Stack of `values` snapshots captured at each `beginStroke`. Most recent
   * snapshot is at the end. `undo()` pops and restores. Bounded depth.
   */
  undoStack: (number | null)[][]
  /**
   * Counterpart to undoStack — populated by `undo()` (it pushes the current
   * values before restoring) and consumed by `redo()`. Cleared whenever a
   * fresh stroke begins (the future has been overwritten).
   */
  redoStack: (number | null)[][]
  enterDrawMode: (totalCheckpoints: number) => void
  beginStroke: () => void
  setCheckpointValues: (crossings: CheckpointCrossing[]) => void
  endStroke: () => void
  reset: () => void
  exitDrawMode: () => void
  confirm: () => void
  onTxSuccess: (sig: string) => void
  onTxError: (msg: string) => void
  setActiveTool: (tool: ToolId) => void
  setSelectedIndices: (indices: ReadonlySet<number>) => void
  clearSelectedIndices: () => void
  /**
   * Revert the most recent stroke. Noop when the stack is empty or when the
   * phase is anything other than `drawMode` or `ready` (e.g. mid-sweep,
   * post-submit).
   */
  undo: () => void
  /**
   * Reapply the most recently undone stroke. Same phase guards as `undo`.
   */
  redo: () => void
}
