/**
 * Drawing palette — single source of truth for the colors used by the
 * drawing toolbar and per-tool overlays.
 *
 * Picked to avoid collision with the chart palette:
 *   white (#FFFFFF history/live), green (#5CF78B bull), gold (#F6CE48 neutral),
 *   red-orange (#FF483B bear/accent), light blue (#5B9BF6 custom prediction).
 *
 * Violet → magenta sits in a hue range nothing else on the chart occupies, and
 * the cool→warm shift between unselected and selected states is a strong cue.
 *
 * `IN_FLIGHT` reuses the existing custom-prediction blue so a path being
 * authored visually matches the prediction layer it will eventually become.
 */
export const DRAW_UNSELECTED = '#8B5CF6'
export const DRAW_SELECTED = '#EC4899'
export const DRAW_IN_FLIGHT = '#5B9BF6'

/** Commit-button accent — green on near-black ink, matches bull color. */
export const DRAW_COMMIT_FILL = '#5CF78B'
export const DRAW_COMMIT_INK = '#1a1a1a'
