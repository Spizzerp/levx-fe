import { useCallback, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { cn } from '@/lib/cn'

export interface ExpandPillOption<T extends string = string> {
  id: T
  label: string
}

interface ExpandPillProps<T extends string = string> {
  options: ExpandPillOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Icon rendered in collapsed state before the label */
  icon?: ReactNode
  className?: string
}

const EASE = [0.25, 0.1, 0.25, 1] as const

/**
 * Animated pill that expands to show options on click, collapses on select.
 * Expand: pill width grows, items stagger-fade in left→right.
 * Collapse: content fades out, pill shrinks smoothly.
 * Selected option appears first when expanded.
 */
export function ExpandPill<T extends string = string>({
  options,
  value,
  onChange,
  icon,
  className,
}: ExpandPillProps<T>) {
  const [open, setOpen] = useState(false)

  const handleSelect = useCallback(
    (id: T) => {
      onChange(id)
      setOpen(false)
    },
    [onChange],
  )

  const selectedLabel = options.find((o) => o.id === value)?.label ?? value

  const ordered = [
    options.find((o) => o.id === value)!,
    ...options.filter((o) => o.id !== value),
  ]

  return (
    <div className={cn('inline-flex', className)}>
      <div
        className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface"
        style={{ overflow: 'clip' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!open ? (
            <motion.button
              key="collapsed"
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-ink-muted hover:text-ink-strong"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              {icon && <span className="shrink-0">{icon}</span>}
              <span className="font-mono text-label uppercase whitespace-nowrap">
                {selectedLabel.toUpperCase()}
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="expanded"
              className="flex items-center px-2"
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{
                width: { duration: 0.3, ease: EASE },
                opacity: { duration: 0.15 },
              }}
            >
              {ordered.map((o, i) => (
                <motion.button
                  key={o.id}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 + i * 0.03 }}
                  onClick={() => handleSelect(o.id)}
                  className={cn(
                    'whitespace-nowrap px-3 py-1 font-mono text-label uppercase tracking-wider',
                    o.id === value
                      ? 'text-ink-strong'
                      : 'text-ink-dim hover:text-ink-muted',
                  )}
                >
                  {o.label.toUpperCase()}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
