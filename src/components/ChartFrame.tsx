import type { PropsWithChildren } from 'react'

import { cn } from '@/lib/cn'

import './ChartFrame.css'

interface ChartFrameProps extends PropsWithChildren {
  /** Enable the subtle dithered glow border effect */
  glow?: boolean
  className?: string
}

/**
 * Reusable chart container with flatline-style border treatment.
 * 2px border, large radius, semi-transparent surface, optional dither glow.
 */
export function ChartFrame({ glow = false, className, children }: ChartFrameProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 border-[#2a2a2a] bg-[#101112]/50',
        glow && 'chart-frame-glow',
        className,
      )}
    >
      {children}
    </div>
  )
}
