import { useEffect, useRef, useState } from 'react'

import { LogoVariantRootSystem } from '@/ui/BezierLogo/variants'

interface SpreadLogoRevealProps {
  onComplete: () => void
  onHidden?: () => void
}

// Matches LogoVariantRootSystem internal timing (BUILD + SETTLE + RESOLVE).
// When the resolve completes the silhouette is fully opaque, so this is
// the earliest moment the hero can take over without visible competition.
// Keep these three constants in sync with BUILD_MS / SETTLE_MS / RESOLVE_MS
// inside LogoVariantRootSystem.
const SPREAD_RESOLVE_MS = 2000 + 1500 + 1500
const HOLD_MS = 400
const FADE_MS = 1500

export function SpreadLogoReveal({ onComplete, onHidden }: SpreadLogoRevealProps) {
  const [handingOff, setHandingOff] = useState(false)
  const [mounted, setMounted] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!mounted) return

    const lockedY = window.scrollY
    const preventDefault = (event: Event) => {
      event.preventDefault()
    }
    const keepTop = () => {
      if (window.scrollY !== lockedY) window.scrollTo(0, lockedY)
    }
    const preventKeys = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowDown'
        || event.key === 'ArrowUp'
        || event.key === 'PageDown'
        || event.key === 'PageUp'
        || event.key === 'Home'
        || event.key === 'End'
        || event.key === ' '
      ) {
        event.preventDefault()
      }
    }

    window.scrollTo(0, lockedY)
    window.addEventListener('wheel', preventDefault, { passive: false })
    window.addEventListener('touchmove', preventDefault, { passive: false })
    window.addEventListener('keydown', preventKeys)
    window.addEventListener('scroll', keepTop, { passive: true })

    return () => {
      window.removeEventListener('wheel', preventDefault)
      window.removeEventListener('touchmove', preventDefault)
      window.removeEventListener('keydown', preventKeys)
      window.removeEventListener('scroll', keepTop)
      window.scrollTo(0, lockedY)
    }
  }, [mounted])

  useEffect(() => {
    const prefersReduced = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setMounted(false)
      onComplete()
      onHidden?.()
      return
    }

    const handoffTimer = window.setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onComplete()
      setHandingOff(true)
      window.setTimeout(() => {
        onHidden?.()
        setMounted(false)
      }, FADE_MS)
    }, SPREAD_RESOLVE_MS + HOLD_MS)

    return () => {
      window.clearTimeout(handoffTimer)
    }
  }, [onComplete, onHidden])

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
