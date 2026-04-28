import { cn } from '@/lib/cn'
import { DOC_META } from './data'
import type { DocId } from './types'

export function DocsTOC({
  doc,
  activeAnchor,
  contentRef,
}: {
  doc: DocId
  activeAnchor: string | null
  contentRef: React.RefObject<HTMLDivElement | null>
}) {
  const meta = DOC_META[doc]
  return (
    <aside
      aria-label="On this page"
      className={cn(
        'h-full min-h-0 overflow-y-auto',
        'border-line border-l',
        'pt-12 pr-6 pb-24 pl-6',
      )}
    >
      <div className="text-ink-dim text-nano mb-4 font-mono tracking-wider uppercase">
        On this page
      </div>
      <ul className="space-y-1">
        {meta.sections.map((s) => {
          const active = s.id === activeAnchor
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  const target = contentRef.current?.querySelector(`#${CSS.escape(s.id)}`)
                  if (target instanceof HTMLElement) {
                    contentRef.current?.scrollTo({
                      top: target.offsetTop - 32,
                      behavior: 'smooth',
                    })
                  }
                }}
                className={cn(
                  'flex items-baseline gap-2',
                  'border-line border-l py-1 pl-3',
                  'font-sans text-[12.5px] tracking-tight',
                  'duration-short ease-levx transition-colors',
                  active
                    ? 'border-success text-ink-strong'
                    : 'text-ink-muted hover:border-line-strong hover:text-ink-strong',
                )}
              >
                <span className="text-ink-dim text-nano font-mono">{s.num}</span>
                <span className="flex-1 truncate">{s.heading}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
