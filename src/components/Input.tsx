import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  unit?: string
}

export function Input({ label, unit, className, ...rest }: InputProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {label && (
        <span className="text-label text-ink-muted font-mono tracking-[0.1em] uppercase">
          {label}
        </span>
      )}
      <div
        className={cn(
          'border-line-strong mt-3 flex items-baseline gap-[10px] border-b py-[10px]',
          'duration-short ease-levx transition-[border-color]',
          'focus-within:border-ink-strong',
        )}
      >
        <input {...rest} className="text-ink-strong w-0 min-w-0 flex-1 font-mono text-2xl" />
        {unit && (
          <span className="text-label text-ink-muted font-mono tracking-[0.12em]">{unit}</span>
        )}
      </div>
    </div>
  )
}
