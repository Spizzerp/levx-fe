import { useCallback, useEffect, type CSSProperties, type PointerEvent, type ReactNode, type Ref } from 'react'
import { motion, useMotionTemplate, useMotionValue } from 'motion/react'

import { cn } from '@/lib/cn'

interface MagicCardProps {
  ref?: Ref<HTMLDivElement>
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** Diameter (px) of the spotlight that follows the cursor. */
  gradientSize?: number
  /** Color of the inner spotlight glow (the soft fill above the surface). */
  gradientColor?: string
  /** Border-spotlight start color — closest to the cursor. */
  gradientFrom?: string
  /** Border-spotlight end color — further from the cursor. */
  gradientTo?: string
}

/**
 * A card whose 1px border follows the cursor with a brand-gradient
 * spotlight, plus a softer inner glow that fades in on hover.
 *
 * Adapted from magicui's MagicCard (MIT). Differences:
 *   - Drops the `next-themes` dependency — theme isn't needed since we
 *     use token-driven colors for the surface and the border ring.
 *   - Defaults `gradientFrom` / `gradientTo` to the brand yellow-lime →
 *     green pair (tokens.css: --color-brand-from / --color-brand-to).
 *   - Leans on `useMotionTemplate` to rebuild the radial-gradient CSS
 *     each frame — the mouse coordinates flow through as MotionValues
 *     so there's no per-move React re-render.
 *
 * Structure (z-index stack inside the card):
 *   outer motion.div (border-box gradient ring + padding-box surface)
 *     └ z-20 fill (bg-surface, hides the outer's padding-box — ensures
 *              only a 1px border ring shows the spotlight)
 *     └ z-30 spotlight (radial soft glow, opacity 0 → 80 on hover)
 *     └ z-40 content
 */
export function MagicCard({
  ref,
  children,
  className,
  style,
  gradientSize = 260,
  gradientColor = '#1a1a1a',
  gradientFrom = '#f4fa4d',
  gradientTo = '#5cf78b',
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize)
  const mouseY = useMotionValue(-gradientSize)

  const reset = useCallback(() => {
    mouseX.set(-gradientSize)
    mouseY.set(-gradientSize)
  }, [mouseX, mouseY, gradientSize])

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      const rect = el.getBoundingClientRect()
      // CSS `zoom` on the card (the landing page scales the market card
      // dynamically) shrinks the element's rendered box but the radial
      // gradient below still addresses positions in the element's
      // pre-zoom local coordinate space. Without this division the
      // spotlight would lag toward the card's logical center: e.g. a
      // cursor at the bottom-right rendered corner sits at x=550 in
      // client coords, but the 1000px-wide logical card would paint
      // the spotlight at x=550 — dead center.
      const zoom = parseFloat(getComputedStyle(el).zoom) || 1
      mouseX.set((e.clientX - rect.left) / zoom)
      mouseY.set((e.clientY - rect.top) / zoom)
    },
    [mouseX, mouseY],
  )

  // Initialize the mouse off-screen so the spotlight isn't visible on
  // first paint, and reset when gradientSize changes (so the "off-screen"
  // sentinel stays well outside the new gradient's radius).
  useEffect(() => reset(), [reset])

  // Two-layer border background (painted top-to-bottom in the list):
  //   1. padding-box surface fill — hides the interior so only a 1px
  //      border ring shows the spotlight below.
  //   2. border-box spotlight radial — bright brand gradient at the
  //      cursor, fading to --color-line at the outer edge. The whole
  //      card's border is painted with this gradient, but because the
  //      gradient is centered on the cursor, only the section near the
  //      mouse reads as "glow"; far from the mouse it's just the
  //      neutral line color. That's the spotlight effect.
  const borderBackground = useMotionTemplate`
    linear-gradient(var(--color-surface) 0 0) padding-box,
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientFrom},
      ${gradientTo},
      var(--color-line) 100%
    ) border-box
  `

  const spotlightBackground = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientColor},
      transparent 100%
    )
  `

  return (
    <motion.div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      className={cn(
        'group relative isolate overflow-hidden rounded-[inherit] border border-transparent',
        className,
      )}
      style={{
        ...style,
        background: borderBackground,
      }}
    >
      <div className="bg-surface absolute inset-px z-20 rounded-[inherit]" />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-px z-30 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-80"
        style={{ background: spotlightBackground }}
      />
      <div className="relative z-40">{children}</div>
    </motion.div>
  )
}
