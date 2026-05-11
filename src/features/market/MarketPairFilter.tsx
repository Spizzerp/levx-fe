import { Check, Filter } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'
import { TokenPairIcon } from '@/ui/TokenPairIcon'

export interface PairOption {
  pair: string
  base: string
  quote: string
}

interface MarketPairFilterProps {
  pairs: PairOption[]
  selected: Set<string>
  onChange: (pairs: Set<string>) => void
}

export function MarketPairFilter({ pairs, selected, onChange }: MarketPairFilterProps) {
  const [open, setOpen] = useState(false)
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

  const activeCount = selected.size
  const isActive = activeCount > 0

  const togglePair = (pair: string) => {
    const next = new Set(selected)
    if (next.has(pair)) next.delete(pair)
    else next.add(pair)
    onChange(next)
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex items-center gap-1.5',
          'duration-short ease-levx transition-colors',
          isActive ? 'text-ink-strong' : 'text-ink-dim hover:text-ink-muted',
        )}
      >
        <span>MARKET</span>
        <Filter size={12} strokeWidth={1.75} aria-hidden />
        {isActive && (
          <span className="text-ink-strong font-mono text-tag tabular-nums">
            ·{activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
              'absolute left-0 top-full z-30 mt-2',
              'w-56',
              'border-line-strong bg-surface border',
              'rounded-2xl shadow-lg',
              'overflow-hidden',
            )}
          >
            <div className="max-h-[320px] overflow-y-auto py-1">
              {pairs.length === 0 ? (
                <p className="text-ink-dim font-mono text-tag uppercase px-4 py-3 text-center">
                  No pairs
                </p>
              ) : (
                pairs.map((p) => {
                  const isSelected = selected.has(p.pair)
                  return (
                    <button
                      key={p.pair}
                      type="button"
                      onClick={() => togglePair(p.pair)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-4 py-2',
                        'font-mono text-label uppercase tracking-wide',
                        'duration-short ease-levx transition-colors',
                        isSelected ? 'text-ink-strong' : 'text-ink-muted hover:text-ink-strong',
                        'hover:bg-white/[0.02]',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <TokenPairIcon base={p.base} quote={p.quote} size={18} />
                        <span>{p.base}</span>
                      </span>
                      {isSelected && <Check size={14} strokeWidth={2} aria-hidden />}
                    </button>
                  )
                })
              )}
            </div>
            {isActive && (
              <div className="border-line-strong border-t">
                <button
                  type="button"
                  onClick={() => onChange(new Set())}
                  className={cn(
                    'w-full px-4 py-2',
                    'font-mono text-tag uppercase tracking-wider',
                    'text-ink-dim hover:text-ink-strong',
                    'duration-short ease-levx transition-colors',
                  )}
                >
                  Clear all
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
