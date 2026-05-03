import { useId, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  unit?: string
  /** Drop the bottom-border underline. Defaults to `false` (underline visible). */
  borderless?: boolean
}

export function Input({ label, unit, className, id: idProp, borderless = false, ...rest }: InputProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  return (
    <div className={cn('flex flex-col', className)}>
      {label && (
        <label htmlFor={id} className="text-label text-ink-muted font-mono uppercase">
          {label}
        </label>
      )}
      <div
        className={cn(
          'mt-3 flex items-baseline gap-2.5 py-2.5',
          !borderless && [
            'border-line-strong border-b',
            'duration-short ease-levx transition-[border-color]',
            'focus-within:border-ink-strong',
          ],
        )}
      >
        <input id={id} {...rest} className="text-ink-strong w-0 min-w-0 flex-1 font-mono text-2xl" />
        {unit && (
          <span className="text-tag text-ink-muted font-mono">{unit}</span>
        )}
      </div>
    </div>
  )
}
