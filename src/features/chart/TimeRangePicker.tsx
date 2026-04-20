import { useState } from 'react'
import { cn } from '@/lib/cn'

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '1d'

const INTERVALS: readonly CandleInterval[] = ['1m', '5m', '15m', '1h', '1d']
const INTERVAL_LABELS: Record<CandleInterval, string> = {
  '1m': '1M',
  '5m': '5M',
  '15m': '15M',
  '1h': '1H',
  '1d': '1D',
}

export interface TimeRangePickerProps {
  /** Controlled value. If omitted, the component manages its own state. */
  value?: CandleInterval
  /** Initial selection when uncontrolled. */
  defaultInterval?: CandleInterval
  onChange?: (interval: CandleInterval) => void
  className?: string
}

export function TimeRangePicker({
  value,
  defaultInterval = '1h',
  onChange,
  className,
}: TimeRangePickerProps) {
  const [internal, setInternal] = useState<CandleInterval>(defaultInterval)
  const active = value ?? internal

  const handleClick = (interval: CandleInterval) => {
    if (value === undefined) setInternal(interval)
    onChange?.(interval)
  }

  return (
    <div
      role="tablist"
      aria-label="Chart candle interval"
      className={cn('inline-flex gap-1 font-mono text-tag uppercase', className)}
    >
      {INTERVALS.map((r) => {
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
            {INTERVAL_LABELS[r]}
          </button>
        )
      })}
    </div>
  )
}
