import { useMemo } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SIDEBAR_SECTIONS } from './data'
import type { DocId } from './types'

export function DocsSidebar({
  activeDoc,
  onSelect,
  query,
  onClose,
}: {
  activeDoc: DocId
  onSelect: (id: DocId) => void
  query: string
  onClose?: () => void
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SIDEBAR_SECTIONS
    return SIDEBAR_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (it) => it.label.toLowerCase().includes(q) || it.id.includes(q),
      ),
    })).filter((s) => s.items.length > 0)
  }, [query])

  return (
    <nav
      aria-label="Documentation"
      className={cn(
        'h-full overflow-y-auto',
        'border-line border-r',
        'pt-8 pr-4 pb-12 pl-6',
      )}
    >
      <div className="mb-8 flex items-baseline justify-between">
        <span className="text-ink-dim text-nano font-mono tracking-wider uppercase">
          Reference Manual
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-ink-dim hover:text-ink-strong md:block hidden"
            aria-label="Close navigation"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-ink-dim text-caption font-mono">
          No matches for <span className="text-ink">{query}</span>.
        </p>
      )}

      <div className="space-y-8">
        {filtered.map((section) => (
          <div key={section.id}>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-ink-dim text-nano font-mono tracking-wider uppercase">
                {section.num}
              </span>
              <span className="text-ink-strong text-nano font-mono tracking-wider uppercase">
                {section.label}
              </span>
            </div>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = item.id === activeDoc
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        'group flex w-full items-center gap-2.5',
                        'border-line border-l py-1.5 pr-2 pl-3',
                        'text-left text-[13px] font-sans tracking-tight',
                        'duration-short ease-levx transition-colors',
                        active
                          ? 'border-success text-ink-strong'
                          : 'text-ink-muted hover:border-line-strong hover:text-ink-strong',
                      )}
                    >
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
