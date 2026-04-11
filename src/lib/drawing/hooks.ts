/**
 * Drawing domain hooks barrel.
 *
 * Exports all hooks that downstream components (DrawingLayer, LevXChart)
 * import from a single stable entry point.
 */

export { useYAxisFreeze } from './yFreeze'
export { useDrawingStore } from '@/stores/drawingStore'

import { useDrawingStore } from '@/stores/drawingStore'
import type { DrawingPhase } from './types'

/**
 * Selector hook — returns the current drawing phase name only.
 * Avoids re-renders on unrelated state changes (e.g., values updates).
 */
export function useDrawingPhase(): DrawingPhase['phase'] {
  return useDrawingStore((s) => s.state.phase)
}

/**
 * Selector hook — returns the current checkpoint values array.
 * Returns (number | null)[] for partial states, number[] for ready/confirming,
 * and [] for idle/submitted.
 */
export function useCheckpointValues(): (number | null)[] {
  return useDrawingStore((s) => {
    const st = s.state
    if (
      st.phase === 'drawMode' ||
      st.phase === 'sweeping' ||
      st.phase === 'ready' ||
      st.phase === 'confirming' ||
      st.phase === 'error'
    ) {
      return st.values
    }
    return []
  })
}
