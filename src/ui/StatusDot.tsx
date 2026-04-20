import type { CSSProperties, ReactNode } from 'react'

import { DOT_GRADIENT } from '@/lib/constants'

type Status = 'active' | 'pending' | 'sampling' | 'settling' | 'maturing' | 'settled' | 'void'

interface StatusDotProps {
  status: Status
  children: ReactNode
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

export function StatusDot({ status, children }: StatusDotProps) {
  const { bg, glow } = statusDots[status]
  const dotStyle: CSSProperties = {
    background: bg,
    boxShadow: `0 0 0 3px ${glow}`,
  }

  return (
    <span className="text-label text-ink-muted inline-flex items-center gap-2 font-mono uppercase">
      <span className="h-1.5 w-1.5 rounded-full" style={dotStyle} aria-hidden />
      {children}
    </span>
  )
}
