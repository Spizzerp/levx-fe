import { useState } from 'react'
import { motion } from 'motion/react'

import { cn } from '@/lib/cn'
import { getTokenImage } from '@/lib/tokenImages'

interface TokenPairIconProps {
  base: string
  quote: string
  size?: number
  className?: string
}

/**
 * Two overlapping circular token logos that separate on hover.
 * Falls back to a letter circle if no image is found.
 */
export function TokenPairIcon({ base, quote, size = 28, className }: TokenPairIconProps) {
  const [hovered, setHovered] = useState(false)
  const baseImg = getTokenImage(base)
  const quoteImg = getTokenImage(quote)
  const overlap = size * 0.35

  return (
    <div
      className={cn('inline-flex items-center', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ height: size }}
    >
      <motion.div
        className="relative z-[2] rounded-full border border-line-strong bg-surface-1 overflow-hidden shrink-0"
        style={{ width: size, height: size }}
        animate={{ x: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {baseImg ? (
          <img src={baseImg} alt={base} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-label text-ink-muted uppercase">
            {base.slice(0, 2)}
          </span>
        )}
      </motion.div>

      <motion.div
        className="relative z-[1] rounded-full border border-line-strong bg-surface-1 overflow-hidden shrink-0"
        style={{ width: size, height: size }}
        animate={{ x: hovered ? 4 : -overlap }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {quoteImg ? (
          <img src={quoteImg} alt={quote} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-label text-ink-muted uppercase">
            {quote.slice(0, 2)}
          </span>
        )}
      </motion.div>
    </div>
  )
}
