import type { ReactElement } from 'react'

export type SigilTone = 'strong' | 'accent'
export type SigilProps = { size: number; tone: SigilTone }
export type Sigil = (props: SigilProps) => ReactElement

export function sigilStroke(tone: SigilTone, opacity: number): string {
  const color = tone === 'accent' ? 'var(--color-brand-to)' : 'var(--color-ink-strong)'
  return opacity >= 1 ? color : `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)`
}

export function sigilFill(tone: SigilTone): string {
  return tone === 'accent' ? 'var(--color-brand-to)' : 'var(--color-ink-strong)'
}

export const SIGILS: Sigil[] = [
  ({ size, tone }) => (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <circle cx="32" cy="32" r="28" fill="none" stroke={sigilStroke(tone, 0.25)} />
      <circle cx="32" cy="32" r="20" fill="none" stroke={sigilStroke(tone, 0.5)} />
      <circle cx="32" cy="32" r="12" fill="none" stroke={sigilStroke(tone, 1)} strokeWidth="1.5" />
      <circle cx="32" cy="4" r="1.8" fill={sigilFill(tone)} />
      <circle cx="32" cy="60" r="1.8" fill={sigilFill(tone)} />
    </svg>
  ),
  ({ size, tone }) => (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      {[0, 10, 20, 30, 40, 50, 60].map((y) => (
        <line key={y} x1="-10" y1={y} x2="74" y2={y - 30} stroke={sigilStroke(tone, 0.9)} strokeWidth="1.25" />
      ))}
      <rect x="2" y="2" width="60" height="60" fill="none" stroke={sigilStroke(tone, 0.3)} />
    </svg>
  ),
  ({ size, tone }) => (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      {[0, 14, 28, 42].map((y, i) => (
        <polyline
          key={y}
          points={`8,${y + 24} 32,${y + 10} 56,${y + 24}`}
          fill="none"
          stroke={sigilStroke(tone, 1 - i * 0.18)}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  ),
  ({ size, tone }) => (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      {Array.from({ length: 6 }).flatMap((_, r) =>
        Array.from({ length: 6 }).map((_, c) => {
          const cx = 8 + c * 10
          const cy = 8 + r * 10
          const isCenter = r === 2 && c === 2
          const isRing = (r - 2.5) ** 2 + (c - 2.5) ** 2 > 5
          return (
            <circle
              key={`${r}-${c}`}
              cx={cx}
              cy={cy}
              r={isCenter ? 3 : isRing ? 1 : 1.6}
              fill={isCenter ? sigilFill(tone) : sigilStroke(tone, isRing ? 0.3 : 0.6)}
            />
          )
        }),
      )}
    </svg>
  ),
  ({ size, tone }) => (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <g stroke={sigilStroke(tone, 0.9)} strokeWidth="1.25" fill="none">
        <polygon points="32,6 58,32 32,58 6,32" />
        <polygon points="32,18 46,32 32,46 18,32" />
        <polygon points="32,28 36,32 32,36 28,32" fill={sigilFill(tone)} />
      </g>
    </svg>
  ),
  ({ size, tone }) => (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <rect x="4" y="4" width="56" height="56" fill="none" stroke={sigilStroke(tone, 0.3)} />
      <rect x="14" y="24" width="16" height="16" fill={sigilFill(tone)} />
      <line x1="34" y1="32" x2="52" y2="32" stroke={sigilStroke(tone, 1)} strokeWidth="1.5" />
      <line x1="48" y1="28" x2="52" y2="32" stroke={sigilStroke(tone, 1)} strokeWidth="1.5" />
      <line x1="48" y1="36" x2="52" y2="32" stroke={sigilStroke(tone, 1)} strokeWidth="1.5" />
    </svg>
  ),
  ({ size, tone }) => (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6
        const x1 = 32 + Math.cos(a) * 10
        const y1 = 32 + Math.sin(a) * 10
        const x2 = 32 + Math.cos(a) * 26
        const y2 = 32 + Math.sin(a) * 26
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={sigilStroke(tone, 0.9)} strokeWidth="1.25" />
      })}
      <circle cx="32" cy="32" r="6" fill={sigilFill(tone)} />
    </svg>
  ),
  ({ size, tone }) => (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <path d="M 4 32 A 28 28 0 0 1 60 32 L 4 32 Z" fill={sigilFill(tone)} opacity="0.85" />
      <path d="M 4 32 A 28 28 0 0 0 60 32" fill="none" stroke={sigilStroke(tone, 1)} strokeWidth="1.25" />
      <circle cx="32" cy="32" r="24" fill="none" stroke={sigilStroke(tone, 0.2)} strokeDasharray="2 3" />
      <circle cx="52" cy="32" r="2.5" fill={sigilFill(tone)} />
      <circle cx="12" cy="32" r="1.5" fill={sigilStroke(tone, 0.6)} />
    </svg>
  ),
]
