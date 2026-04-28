import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { DOC_META } from '@/modules/docs/data'
import { DocsContent } from '@/modules/docs/DocsContent'
import { DocsHeader } from '@/modules/docs/DocsHeader'
import { DocsSidebar } from '@/modules/docs/DocsSidebar'
import { DocsTOC } from '@/modules/docs/DocsTOC'
import type { DocId } from '@/modules/docs/types'

export function DocsPage() {
  const [activeDoc, setActiveDocState] = useState<DocId>('introduction')
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeAnchor, setActiveAnchor] = useState<string | null>(
    () => DOC_META.introduction.sections[0]?.id ?? null,
  )

  const contentRef = useRef<HTMLDivElement>(null)

  const selectDoc = useCallback((id: DocId) => {
    setActiveDocState(id)
    setMobileOpen(false)
    setActiveAnchor(DOC_META[id].sections[0]?.id ?? null)
    requestAnimationFrame(() => {
      contentRef.current?.scrollTo({ top: 0 })
    })
  }, [])

  // Listen for prev/next selection — keeps PrevNextLink decoupled.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: DocId }>).detail
      if (detail?.id) selectDoc(detail.id)
    }
    window.addEventListener('levx-docs-select', handler)
    return () => window.removeEventListener('levx-docs-select', handler)
  }, [selectDoc])

  // Scroll-spy: track which section is in the upper third of the content viewport.
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const sections = DOC_META[activeDoc].sections
      .map((s) => root.querySelector(`#${CSS.escape(s.id)}`))
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveAnchor(visible[0].target.id)
      },
      { root, rootMargin: '-10% 0px -65% 0px', threshold: [0, 1] },
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [activeDoc])

  return (
    <main
      className={cn(
        'flex h-dvh flex-col overflow-hidden',
        'bg-surface text-ink',
      )}
    >
      <DocsHeader
        query={query}
        onQueryChange={setQuery}
        onMobileToggle={() => setMobileOpen((v) => !v)}
        mobileOpen={mobileOpen}
      />

      <div
        className={cn(
          'grid min-h-0 flex-1',
          'grid-cols-[260px_minmax(0,1fr)_240px]',
          'lg:grid-cols-[240px_minmax(0,1fr)_220px]',
          'md:grid-cols-1',
        )}
      >
        <div className="md:hidden">
          <DocsSidebar activeDoc={activeDoc} onSelect={selectDoc} query={query} />
        </div>

        {mobileOpen && (
          <div
            className={cn(
              'fixed inset-0 z-overlay',
              'bg-surface/95 backdrop-blur',
              'md:flex hidden',
            )}
          >
            <div className="bg-surface w-72">
              <DocsSidebar
                activeDoc={activeDoc}
                onSelect={selectDoc}
                query={query}
                onClose={() => setMobileOpen(false)}
              />
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="flex-1"
            />
          </div>
        )}

        <DocsContent doc={activeDoc} contentRef={contentRef} />

        <div className="md:hidden">
          <DocsTOC
            doc={activeDoc}
            activeAnchor={activeAnchor}
            contentRef={contentRef}
          />
        </div>
      </div>
    </main>
  )
}
