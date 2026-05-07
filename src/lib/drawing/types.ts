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
 * Minimal scale interface satisfied by both Visx ScaleTime and ScaleLinear.
 * Avoids d3-scale type gymnastics — domain() can return Date[] or number[],
 * so we widen to (number | Date)[] and let callers `Number(x)` as needed.
 */
export interface MinimalScale {
  (v: number | Date): number
  invert(pixel: number): number | Date
  domain(): readonly (number | Date)[]
  range(): readonly number[]
}

/**
 * Pixel distance below which a pointer drag is treated as a stationary click.
 * Used by BezierTool (corner anchor vs handle drag) and SelectTool (marquee
 * vs empty-space click). Same value, same intent.
 */
export const DRAG_THRESHOLD_PX = 4

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

/**
 * One entry on the unified undo/redo stack.
 *
 * Two kinds are interleaved chronologically:
 * - `values` — pre-stroke snapshot pushed by `beginStroke()`.
 * - `selection` — pre-mutation selection pushed by `setSelectedIndices` /
 *   `clearSelectedIndices` whenever the new selection differs from the
 *   current one.
 *
 * `undo()` pops the most recent entry regardless of kind so Cmd+Z feels
 * like one merged history. `redo()` is symmetric.
 */
export type HistoryEntry =
  | { kind: 'values'; values: (number | null)[] }
  | { kind: 'selection'; selection: ReadonlySet<number> }

/** Shape of the full Zustand drawing store slice (actions + state). */
export interface DrawingStore {
  state: DrawingPhase
  totalCheckpoints: number
  activeTool: ToolId
  /**
   * Indices of checkpoints currently selected via the SelectTool. Persists
   * across tool switches but is cleared on enterDrawMode / reset / exit /
   * onTxSuccess. Defensively pruned in `undo`/`redo` to drop indices whose
   * value is null in the restored snapshot.
   */
  selectedIndices: ReadonlySet<number>
  /**
   * Unified chronological history. Each entry is either a values snapshot
   * (pushed by `beginStroke`) or a selection snapshot (pushed by
   * `setSelectedIndices` / `clearSelectedIndices`). Most recent at the end.
   * `undo()` pops the top entry regardless of kind. Bounded depth.
   */
  undoStack: HistoryEntry[]
  /**
   * Counterpart to undoStack — populated by `undo()` (pushes the current
   * state of the entry's kind before restoring) and consumed by `redo()`.
   * Cleared whenever a fresh action branches the history.
   */
  redoStack: HistoryEntry[]
  enterDrawMode: (totalCheckpoints: number, initialValues?: readonly (number | null)[]) => void
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
