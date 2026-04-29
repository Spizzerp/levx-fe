import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/cn'
import {
  SLIPPAGE_MAX,
  SLIPPAGE_PRESETS,
  useSlippageStore,
  type SlippagePreset,
} from '@/stores/slippageStore'

interface SlippageSelectorProps {
  /** Optional override for the trigger label. Defaults to "Slippage". */
  label?: string
  className?: string
}

function formatPct(decimal: number): string {
  if (decimal <= 0) return 'OFF'
  const pct = decimal * 100
  return pct >= 1 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`
}

/**
 * Inline-expanding slippage tolerance selector. Backed by the
 * persisted `slippageStore`, used by `usePlaceWager`,
 * `usePlaceBatchWager`, and `useExitPosition` to derive the
 * `min_*_out` floor passed to the program.
 *
 * Design choice: collapsible inline (not a floating popover) so it
 * sits naturally inside trade panels without overlay positioning
 * concerns or focus-trap edge cases. Closes on outside click and
 * on Escape.
 */
export function SlippageSelector({ label = 'Slippage', className }: SlippageSelectorProps) {
  const { tolerance, preset, setPreset, setCustom } = useSlippageStore()
  const [open, setOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onCustomCommit = () => {
    const parsed = parseFloat(customDraft)
    if (!isFinite(parsed)) return
    setCustom(parsed / 100)
    setCustomDraft('')
  }

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="slippage-selector-body"
        className={cn(
          'flex w-full items-center justify-between',
          'border-line border-y px-1 py-3',
          'text-caption font-mono tracking-wide uppercase',
          'text-ink-muted hover:text-ink-strong',
          'duration-short ease-levx transition-colors',
        )}
      >
        <span>{label}</span>
        <span className="text-ink-strong flex items-center gap-2">
          <span>{formatPct(tolerance)}</span>
          {open ? (
            <ChevronUp size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
          )}
        </span>
      </button>

      {open && (
        <div
          id="slippage-selector-body"
          className={cn(
            'flex flex-col gap-3',
            'border-line border-b px-1 py-3',
          )}
        >
          <div className="flex flex-wrap gap-2">
            {SLIPPAGE_PRESETS.map((p) => (
              <PresetChip key={p} value={p} active={preset === p} onClick={() => setPreset(p)} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="slippage-custom"
              className="text-ink-dim text-caption font-mono tracking-wide uppercase"
            >
              Custom
            </label>
            <input
              id="slippage-custom"
              type="number"
              inputMode="decimal"
              min={0}
              max={SLIPPAGE_MAX * 100}
              step={0.01}
              placeholder={preset === null ? formatPct(tolerance).replace('%', '') : ''}
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onBlur={onCustomCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onCustomCommit()
                }
              }}
              className={cn(
                'w-20 px-2 py-1',
                'border-line bg-surface border',
                'text-ink-strong text-caption font-mono',
                'focus:border-ink focus:outline-none',
              )}
            />
            <span className="text-ink-dim text-caption font-mono">%</span>
          </div>
          {tolerance <= 0 && (
            <p className="text-ink-dim text-caption font-mono">
              Slippage protection disabled — trades execute at any price.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface PresetChipProps {
  value: SlippagePreset
  active: boolean
  onClick: () => void
}

function PresetChip({ value, active, onClick }: PresetChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3 py-1',
        'border',
        'text-caption font-mono tracking-wide',
        'duration-short ease-levx transition-colors',
        active
          ? 'border-ink bg-ink text-surface'
          : 'border-line text-ink-muted hover:border-ink hover:text-ink-strong',
      )}
    >
      {formatPct(value)}
    </button>
  )
}
