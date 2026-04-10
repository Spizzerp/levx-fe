import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type LabelVariant = 'default' | 'dim'

interface LabelProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: LabelVariant
}

const VARIANT_CLASSES: Record<LabelVariant, string> = {
  default: 'text-ink-muted',
  dim: 'text-ink-dim',
}

/**
 * ALL CAPS Space Mono label — used for instrument-panel-style labels
 * throughout the app. The Nothing-idiomatic way to title a section,
 * mark a value, or denote metadata.
 */
export function Label({ variant = 'default', className, children, ...rest }: LabelProps) {
  return (
    <span
      className={cn(
        'text-label font-mono tracking-[0.1em] uppercase',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
