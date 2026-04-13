import type { CSSProperties, ReactNode } from 'react'

type Status = 'active' | 'pending' | 'sampling' | 'settling' | 'maturing' | 'settled' | 'void'

interface StatusDotProps {
  status: Status
  children: ReactNode
}

const statusColors: Record<Status, string> = {
  active: 'var(--color-success)',
  pending: 'var(--color-ink-muted)',
  sampling: 'var(--color-success)',
  settling: 'var(--color-warning)',
  maturing: 'var(--color-warning)',
  settled: 'var(--color-ink-dim)',
  void: 'var(--color-accent)',
}

export function StatusDot({ status, children }: StatusDotProps) {
  const color = statusColors[status]
  const dotStyle: CSSProperties = {
    backgroundColor: color,
    boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 15%, transparent)`,
  }

  return (
    <span className="text-label text-ink-muted inline-flex items-center gap-2 font-mono uppercase">
      <span className="h-1.5 w-1.5 rounded-full" style={dotStyle} aria-hidden />
      {children}
    </span>
  )
}
