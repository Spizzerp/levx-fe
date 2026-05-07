import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { DOT_GRADIENT } from '@/lib/constants'

type Status = 'active' | 'pending' | 'sampling' | 'settling' | 'maturing' | 'settled' | 'void'

interface StatusDotProps {
  status: Status
  children: ReactNode
  className?: string
  size?: 'default' | 'compact'
}

const statusDots: Record<Status, { bg: string; glow: string }> = {
  active: { bg: DOT_GRADIENT.positive, glow: 'rgba(92, 247, 139, 0.25)' },
  pending: { bg: 'var(--color-ink-muted)', glow: 'rgba(153, 153, 153, 0.15)' },
  sampling: { bg: DOT_GRADIENT.positive, glow: 'rgba(92, 247, 139, 0.25)' },
  settling: { bg: 'var(--color-warning)', glow: 'rgba(212, 168, 67, 0.25)' },
  maturing: { bg: 'var(--color-warning)', glow: 'rgba(212, 168, 67, 0.25)' },
  settled: { bg: 'var(--color-ink-dim)', glow: 'rgba(102, 102, 102, 0.15)' },
  void: { bg: DOT_GRADIENT.negative, glow: 'rgba(255, 69, 58, 0.25)' },
}

const statusDotSizes = {
  default: {
    root: 'text-label gap-2',
    ring: 'h-3.5 w-3.5',
    core: 'h-1.5 w-1.5',
  },
  compact: {
    root: 'gap-1.5 text-[10px] leading-none',
    ring: 'h-2.5 w-2.5',
    core: 'h-1 w-1',
  },
} as const

export function StatusDot({ status, children, className, size = 'default' }: StatusDotProps) {
  const { bg, glow } = statusDots[status]
  const sizing = statusDotSizes[size]
  const ringStyle: CSSProperties = {
    background: `radial-gradient(circle, ${glow} 0%, ${glow} 45%, transparent 78%)`,
  }
  const coreStyle: CSSProperties = {
    background: bg,
  }

  return (
    <span
      className={cn(
        'text-ink-muted inline-flex items-center font-mono uppercase',
        sizing.root,
        className,
      )}
    >
      {children}
      <span
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center rounded-full',
          sizing.ring,
        )}
        aria-hidden
      >
        <span className="status-dot-ring absolute inset-0 rounded-full" style={ringStyle} />
        <span className={cn('relative rounded-full', sizing.core)} style={coreStyle} />
      </span>
    </span>
  )
}
