import { useEffect, useRef, useState } from 'react'

import { LogoVariantRootSystem } from '@/ui/BezierLogo/variants'

interface SpreadLogoRevealProps {
  onComplete: () => void
}

// Matches LogoVariantRootSystem internal timing (BUILD + SETTLE + RESOLVE).
// When the resolve completes the silhouette is fully opaque, so this is
// the earliest moment the hero can take over without visible competition.
const SPREAD_RESOLVE_MS = 4200 + 700 + 1500
const HOLD_MS = 1200
const FADE_MS = 1500

export function SpreadLogoReveal({ onComplete }: SpreadLogoRevealProps) {
  const [handingOff, setHandingOff] = useState(false)
  const [mounted, setMounted] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setMounted(false)
      onComplete()
      return
    }

    const handoffTimer = window.setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onComplete()
      setHandingOff(true)
      window.setTimeout(() => setMounted(false), FADE_MS)
    }, SPREAD_RESOLVE_MS + HOLD_MS)

    return () => {
      window.clearTimeout(handoffTimer)
    }
  }, [onComplete])

  if (!mounted) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[1000] bg-black transition-opacity duration-[1500ms] ease-out ${
        handingOff ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <LogoVariantRootSystem ariaLabel="LevX" />
    </div>
  )
}
