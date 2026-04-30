import { useEffect, type ReactNode } from 'react'
import { X as ClearIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DocsSidebar } from './DocsSidebar'
import type { DocId } from './types'

export function DocsMobileMenu({
  isOpen,
  onClose,
  activeDoc,
  headerActions,
  iconActionClassName,
}: {
  isOpen: boolean
  onClose: () => void
  activeDoc?: DocId
  headerActions: ReactNode
  iconActionClassName: string
}) {
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'bg-surface pointer-events-auto fixed inset-0 z-[300] flex flex-col overflow-hidden',
      )}
    >
      {/* Full-screen menu top bar */}
      <div className="flex h-[60px] shrink-0 items-center justify-between px-5 pt-2">
        <div className="flex items-center gap-2">
          <img src="/logo_color.png" alt="LevX" className="-my-1 h-10 w-auto" />
          <span className="text-ink-strong text-label min-w-0 font-mono tracking-wider uppercase">
            Docs
          </span>
        </div>
        <button
          onClick={onClose}
          className={iconActionClassName}
          aria-label="Close menu"
        >
          <ClearIcon size={18} />
        </button>
      </div>

      {activeDoc && (
        <div className="border-line min-h-0 flex-1 overflow-y-auto border-t">
          <DocsSidebar
            activeDoc={activeDoc}
            query=""
            onClose={onClose}
            hideCloseButton
            className="!border-r-0 !pt-6 !pr-5 !pb-8 !pl-5"
          />
        </div>
      )}

      <div className="bg-surface-1/50 border-line flex shrink-0 items-center justify-center border-t p-4 px-5">
        <div className="flex items-center gap-1">{headerActions}</div>
      </div>
    </div>
  )
}
