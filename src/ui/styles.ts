import { cn } from '@/lib/cn'

/** Pill-shaped chip button (pair selectors, duration, intervals). */
export const CHIP = cn(
  'border-line-strong rounded-full border px-3 py-1.5',
  'font-mono text-[10px] uppercase tracking-wide',
  'duration-short ease-levx transition-[border-color,color]',
  'cursor-pointer',
)
export const CHIP_ACTIVE = 'border-ink-strong text-ink-strong'
export const CHIP_INACTIVE = 'text-ink-muted hover:border-ink hover:text-ink'

/** Dropdown menu item row. */
export const MENU_ITEM = cn(
  'block w-full px-4 py-2.5 text-left font-mono text-xs uppercase tracking-wide text-ink',
  'duration-short ease-levx transition-[background-color,color]',
  'hover:bg-surface-2 hover:text-ink-strong',
)
