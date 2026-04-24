import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * Generic modal shell for LevX. Wraps @radix-ui/react-dialog with the
 * project's Nothing-style chrome: instrument label, ESC close button,
 * and motion fade/scale transitions.
 *
 * Usage:
 *
 *   <Modal open={open} onOpenChange={setOpen} label="[ EARLY ACCESS ]">
 *     <Modal.Title>Join the Waitlist</Modal.Title>
 *     ...
 *   </Modal>
 */

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** Small instrument label shown in the header, e.g. "[ EARLY ACCESS ]" */
  label?: string
  /** Show a pulsing dot before the label. Defaults to true when label exists. */
  indicator?: boolean
  /** Controls max-width of the card. Defaults to md (480px). */
  size?: ModalSize
  /** Hide the default header entirely (render fully custom chrome in children). */
  hideHeader?: boolean
  /** Extra classes merged onto the card container. */
  className?: string
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-[400px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[560px]',
  xl: 'max-w-[720px]',
}

const EASE = [0.25, 0.1, 0.25, 1] as const

export function Modal({
  open,
  onOpenChange,
  children,
  label,
  indicator = true,
  size = 'md',
  hideHeader = false,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="bg-surface/70 z-modal fixed inset-0 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                className="z-modal fixed inset-0 flex items-center justify-center p-6"
                initial={{ opacity: 0, scale: 0.985, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.985, y: 8 }}
                transition={{ duration: 0.24, ease: EASE }}
              >
                <div
                  className={cn(
                    'border-line-strong bg-surface relative w-full overflow-hidden rounded-2xl border',
                    SIZE_CLASS[size],
                    className,
                  )}
                >
                  {!hideHeader && <ModalHeader label={label} indicator={indicator} />}

                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

function ModalHeader({ label, indicator }: { label?: string; indicator: boolean }) {
  return (
    <header className="border-line flex items-center justify-between gap-4 border-b px-6 py-4">
      <div className="flex items-baseline gap-3">
        {label && indicator && (
          <span className="bg-success h-1.5 w-1.5 animate-pulse rounded-full" />
        )}
        {label && (
          <span className="text-ink-dim text-nano font-mono tracking-widest uppercase">{label}</span>
        )}
      </div>
      <Dialog.Close asChild>
        <button
          type="button"
          aria-label="Close"
          className={cn(
            'group flex items-center gap-1.5',
            'border-line-strong rounded-md border px-2 py-1',
            'text-ink-muted text-nano font-mono tracking-wider uppercase',
            'hover:border-ink hover:text-ink-strong transition-colors',
          )}
        >
          <span>ESC</span>
          <X
            size={11}
            strokeWidth={1.75}
            className="text-ink-muted group-hover:text-ink-strong"
          />
        </button>
      </Dialog.Close>
    </header>
  )
}

// Re-exports so callers don't need to import Radix directly.
// Use Modal.Title for the accessible title (wires up aria-labelledby),
// Modal.Close to close from custom buttons (e.g. a Cancel footer button).
Modal.Title = Dialog.Title
Modal.Description = Dialog.Description
Modal.Close = Dialog.Close
