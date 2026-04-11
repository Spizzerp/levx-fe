import { useState } from 'react'
import { cn } from '@/lib/cn'

export type TimeRange = '1h' | '1d' | '1w' | '1m'

const RANGES: readonly TimeRange[] = ['1h', '1d', '1w', '1m']
const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1H',
  '1d': '1D',
  '1w': '1W',
  '1m': '1M',
}

export interface TimeRangePickerProps {
  /** Controlled value. If omitted, the component manages its own state. */
  value?: TimeRange
  /** Initial selection when uncontrolled. */
  defaultRange?: TimeRange
  onChange?: (range: TimeRange) => void
  className?: string
}

export function TimeRangePicker({
  value,
  defaultRange = '1d',
  onChange,
  className,
}: TimeRangePickerProps) {
  const [internal, setInternal] = useState<TimeRange>(defaultRange)
  const active = value ?? internal

  const handleClick = (range: TimeRange) => {
    if (value === undefined) setInternal(range)
    onChange?.(range)
  }

  return (
    <div
      role="tablist"
      aria-label="Chart time range"
      className={cn('inline-flex gap-1 font-mono text-[11px] tracking-[0.12em] uppercase', className)}
    >
      {RANGES.map((r) => {
        const isActive = r === active
        return (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => handleClick(r)}
            className={cn(
              'border px-3 py-1 transition-opacity',
              isActive
                ? 'border-line-strong text-ink-strong'
                : 'border-line text-ink-muted hover:text-ink-strong',
            )}
          >
            {RANGE_LABELS[r]}
          </button>
        )
      })}
    </div>
  )
}
