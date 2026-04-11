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
  enterDrawMode: (totalCheckpoints: number) => void
  beginStroke: () => void
  setCheckpointValues: (crossings: CheckpointCrossing[]) => void
  endStroke: () => void
  reset: () => void
  exitDrawMode: () => void
  confirm: () => void
  onTxSuccess: (sig: string) => void
  onTxError: (msg: string) => void
}
