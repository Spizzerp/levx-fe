import { create } from 'zustand'

import type { BezierAnchor } from '@/lib/drawing/bezierSampling'

/**
 * One reversible step in bezier authoring history.
 *
 * - `edit` — placement, anchor drag, handle drag, backspace, Esc cancel.
 *   Undo restores `before`; redo restores `after`. Local state only.
 * - `commit` — clicking the ✓ (or pressing Enter). Stores the anchors that
 *   existed pre-commit. Undo restores those anchors; redo clears them again.
 *   The drawingStore values change is NOT in this entry — the caller
 *   (DrawingToolbar) coordinates by also calling drawingStore.undo()/redo()
 *   when an action of this kind is the one being walked over.
 */
export type BezierAction =
  | { kind: 'edit'; before: BezierAnchor[]; after: BezierAnchor[] }
  | { kind: 'commit'; before: BezierAnchor[] }

const EMPTY: BezierAnchor[] = []

interface BezierStore {
  /** Live anchors — the source of truth for BezierTool's render. */
  anchors: BezierAnchor[]
  /** Past actions, oldest first. `pop` to undo. */
  past: BezierAction[]
  /** Actions that were undone, oldest first. `pop` to redo. */
  future: BezierAction[]

  /**
   * Set anchors transiently — used during in-flight drags so the visual
   * tracks the cursor. Does NOT touch history.
   */
  setAnchors: (next: BezierAnchor[]) => void

  /** Push a completed edit. Clears redo future (standard branching). */
  pushEdit: (before: BezierAnchor[], after: BezierAnchor[]) => void

  /** Push a commit and clear anchors (the path was finalized). */
  pushCommit: (preCommit: BezierAnchor[]) => void

  /** Wipe all authoring state — used on tool switch / unmount. */
  reset: () => void

  /** Undo the most recent action. Returns it so the caller can react to commits. */
  undo: () => BezierAction | null
  /** Redo the most recently undone action. Returns it for the same reason. */
  redo: () => BezierAction | null
}

export const useBezierStore = create<BezierStore>((set, get) => ({
  anchors: EMPTY,
  past: [],
  future: [],

  setAnchors: (next) => set({ anchors: next }),

  pushEdit: (before, after) => {
    set((s) => ({
      anchors: after,
      past: [...s.past, { kind: 'edit', before, after }],
      future: [],
    }))
  },

  pushCommit: (preCommit) => {
    set((s) => ({
      anchors: EMPTY,
      past: [...s.past, { kind: 'commit', before: preCommit }],
      future: [],
    }))
  },

  reset: () => set({ anchors: EMPTY, past: [], future: [] }),

  undo: () => {
    const s = get()
    if (s.past.length === 0) return null
    const action = s.past[s.past.length - 1]
    const newPast = s.past.slice(0, -1)
    set({
      anchors: action.before,
      past: newPast,
      future: [...s.future, action],
    })
    return action
  },

  redo: () => {
    const s = get()
    if (s.future.length === 0) return null
    const action = s.future[s.future.length - 1]
    const newFuture = s.future.slice(0, -1)
    set({
      anchors: action.kind === 'edit' ? action.after : EMPTY,
      past: [...s.past, action],
      future: newFuture,
    })
    return action
  },
}))
