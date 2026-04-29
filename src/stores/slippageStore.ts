import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/** Decimal slippage values (e.g. 0.005 = 0.5%). Order matters — UI renders in array order. */
export const SLIPPAGE_PRESETS = [0.001, 0.005, 0.01, 0.05] as const
export type SlippagePreset = (typeof SLIPPAGE_PRESETS)[number]

/**
 * Hard upper bound. Above 50% the on-chain `min_shares_out` becomes
 * meaningless — the user is effectively waiving slippage protection,
 * which we already expose via the 0% setting / "off" toggle.
 */
export const SLIPPAGE_MAX = 0.5
export const SLIPPAGE_DEFAULT: SlippagePreset = 0.005

interface SlippageState {
  /** Decimal in [0, SLIPPAGE_MAX]. 0 means no slippage protection. */
  tolerance: number
  /** Last preset chosen, or null if a custom value is in use. */
  preset: SlippagePreset | null
  setPreset: (p: SlippagePreset) => void
  setCustom: (value: number) => void
}

function clampTolerance(value: number): number {
  if (!isFinite(value) || value < 0) return 0
  if (value > SLIPPAGE_MAX) return SLIPPAGE_MAX
  return value
}

export const useSlippageStore = create<SlippageState>()(
  persist(
    (set) => ({
      tolerance: SLIPPAGE_DEFAULT,
      preset: SLIPPAGE_DEFAULT,
      setPreset: (p) => set({ tolerance: p, preset: p }),
      setCustom: (value) => set({ tolerance: clampTolerance(value), preset: null }),
    }),
    {
      name: 'levx:slippage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)

/** Read-only selector for non-React contexts (e.g. transaction hooks). */
export function getSlippageTolerance(): number {
  return useSlippageStore.getState().tolerance
}
