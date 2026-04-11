import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Y-axis freeze hook for the freehand drawing interaction.
 *
 * On pointerdown: call freeze() to capture the current price domain and hold
 * it fixed while the user draws. Pyth ticks continue flowing into the store
 * during the freeze but do not affect the visible scale.
 *
 * On pointerup: call thaw() to schedule resumption of the live price domain
 * after 300ms. Rapid successive thaw() calls restart the timer (later fire wins).
 *
 * Returns:
 *   effectiveDomain — the frozen domain while active, else currentPriceDomain.
 *   freeze()        — captures currentPriceDomain.
 *   thaw()          — schedules 300ms resume; restartable.
 */
export function useYAxisFreeze(currentPriceDomain: [number, number]): {
  effectiveDomain: [number, number]
  freeze: () => void
  thaw: () => void
} {
  const [frozenDomain, setFrozenDomain] = useState<[number, number] | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep a ref to the latest currentPriceDomain so freeze() always captures
  // the current value even if called from a stale closure.
  const currentRef = useRef(currentPriceDomain)
  useEffect(() => {
    currentRef.current = currentPriceDomain
  })

  const freeze = useCallback(() => {
    // Cancel any pending thaw before freezing again (e.g., rapid re-draw)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setFrozenDomain(currentRef.current)
  }, [])

  const thaw = useCallback(() => {
    // Restart the timer on every thaw() call
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setFrozenDomain(null)
      timerRef.current = null
    }, 300)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return {
    effectiveDomain: frozenDomain ?? currentPriceDomain,
    freeze,
    thaw,
  }
}
