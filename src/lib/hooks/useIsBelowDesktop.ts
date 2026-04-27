import { useEffect, useState } from 'react'

const DESKTOP_MIN_WIDTH = 1180

/**
 * Reactive viewport-width breakpoint check. Returns `true` while the
 * viewport is below `DESKTOP_MIN_WIDTH`, i.e. on phones, tablets, and
 * narrow laptops. The threshold matches `MarketPreview.tsx`'s
 * `[@media(min-width:1181px)]` grid breakpoint — below that point the
 * card's right rail stacks below the chart, so the desktop landing's
 * 5-stop tour has no rail-anchored DOM to target and the choreography
 * collapses. Above 1180 the desktop scroll story reads as designed.
 *
 * SSR-safe: returns `false` on the first render before hydration so
 * server output stays predictable, then updates on mount.
 */
export function useIsBelowDesktop(): boolean {
  const [isBelowDesktop, setIsBelowDesktop] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(`(max-width: ${DESKTOP_MIN_WIDTH - 1}px)`)
    const update = () => setIsBelowDesktop(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isBelowDesktop
}
