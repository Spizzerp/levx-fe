import { useEffect, useState } from 'react'

const MOBILE_MAX_WIDTH = 768

/**
 * Reactive viewport-width breakpoint check. Returns `true` while the
 * viewport is at or below `MOBILE_MAX_WIDTH` (matches `customVariants.css`'s
 * `sm` breakpoint). SSR-safe: returns `false` on the first render before
 * hydration so server output stays predictable, then updates on mount.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isMobile
}
