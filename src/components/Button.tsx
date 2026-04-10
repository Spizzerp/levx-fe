import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dashed' | 'destructive'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  fullWidth?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: cn(
    'border-0 bg-ink-strong text-surface',
    'hover:opacity-[0.88]',
    'disabled:cursor-not-allowed disabled:border disabled:border-line-strong disabled:bg-transparent disabled:text-ink-dim',
  ),
  secondary: cn(
    'border border-line-strong bg-transparent text-ink',
    'hover:border-ink hover:text-ink-strong',
  ),
  ghost: cn(
    'border-0 rounded-none bg-transparent px-0 py-2 text-ink-muted',
    'hover:text-ink-strong',
  ),
  dashed: cn(
    'border border-dashed border-line-strong bg-transparent tracking-[0.12em] text-ink-muted',
    'hover:border-ink hover:text-ink-strong',
  ),
  destructive: cn('border border-accent bg-transparent text-accent', 'hover:bg-accent-subtle'),
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-[14px]',
        'font-mono text-[13px] font-bold tracking-[0.1em] uppercase',
        'duration-short ease-levx transition-[opacity,background,border-color,color]',
        fullWidth && 'flex w-full',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
