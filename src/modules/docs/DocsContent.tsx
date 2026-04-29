import { ChevronRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/cn'
import { HyperText } from '@/ui/HyperText'
import { DOC_META, DOC_ORDER } from './data'
import { DOC_RENDERERS } from './content'
import type { DocId } from './types'

function DocsBreadcrumb({ doc }: { doc: DocId }) {
  const meta = DOC_META[doc]
  return (
    <div
      className={cn(
        'mb-8 flex flex-wrap items-center gap-x-2 gap-y-1',
        'text-nano font-mono tracking-wider uppercase',
        'sm:mb-6',
      )}
    >
      <Link
        to="/docs"
        className="text-ink-dim hover:text-ink-strong duration-short ease-levx transition-colors"
      >
        Docs
      </Link>
      <ChevronRight size={11} className="text-ink-dim" />
      <span className="text-ink-dim">{meta.category}</span>
      <ChevronRight size={11} className="text-ink-dim" />
      <span className="text-ink-strong">{meta.title}</span>
    </div>
  )
}

function DocsMetaStrip({ doc }: { doc: DocId }) {
  const meta = DOC_META[doc]
  const visibleMeta = meta.meta.filter((item) => item.label !== 'STATUS')

  if (visibleMeta.length === 0) return null

  return (
    <dl className={cn('mb-12 flex flex-wrap gap-2', 'sm:mb-10')}>
      {visibleMeta.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className={cn(
            'border-line bg-surface-1 flex max-w-full min-w-0 items-center gap-2',
            'rounded-full border px-3 py-1.5',
          )}
        >
          <dt className="text-ink-dim text-nano shrink-0 font-mono tracking-wider uppercase">
            {item.label}
          </dt>
          <dd className="text-ink text-caption truncate font-sans">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PrevNextLink({ direction, to }: { direction: 'prev' | 'next'; to: DocId }) {
  const meta = DOC_META[to]
  const isNext = direction === 'next'
  return (
    <Link
      to="/docs/$id"
      params={{ id: to }}
      className={cn(
        'group flex flex-col gap-2 py-4',
        'duration-short ease-levx transition-colors',
        'hover:bg-surface-1',
        isNext ? 'items-end pr-4 text-right' : 'items-start pl-4 text-left',
      )}
    >
      <span
        className={cn(
          'text-ink-dim text-nano flex items-center gap-1.5',
          'font-mono tracking-wider uppercase',
        )}
      >
        {isNext ? (
          <>
            Next
            <ChevronRight size={11} />
          </>
        ) : (
          <>
            <ChevronRight size={11} className="rotate-180" />
            Previous
          </>
        )}
      </span>
      <span className="text-ink-strong group-hover:text-ink-strong text-body-sm font-sans">
        {meta.title}
      </span>
    </Link>
  )
}

export function DocsContent({ doc }: { doc: DocId }) {
  const meta = DOC_META[doc]
  const Renderer = DOC_RENDERERS[doc]

  const orderedIndex = DOC_ORDER.indexOf(doc)
  const prev = orderedIndex > 0 ? DOC_ORDER[orderedIndex - 1] : null
  const next =
    orderedIndex >= 0 && orderedIndex < DOC_ORDER.length - 1 ? DOC_ORDER[orderedIndex + 1] : null

  return (
    <>
      <DocsBreadcrumb doc={doc} />

      <h1
        className={cn(
          'text-ink-strong mb-6 max-w-full break-words',
          'font-display text-[44px] leading-none font-medium tracking-tighter',
          'sm:text-[32px] sm:leading-tight',
          "[font-variation-settings:'ROND'_100]",
        )}
      >
        <HyperText>{meta.title}</HyperText>
      </h1>

      <p
        className={cn(
          'text-ink-muted font-editorial mb-10 max-w-[58ch]',
          'text-[20px] leading-snug tracking-tight',
          'sm:text-[17px]',
        )}
      >
        {meta.tagline}
      </p>

      <DocsMetaStrip doc={doc} />

      <div className="mt-12 sm:mt-10">
        <Renderer />
      </div>

      <div className="border-line mt-20 grid grid-cols-2 gap-px border-t pt-8">
        {prev ? <PrevNextLink direction="prev" to={prev} /> : <span />}
        {next ? <PrevNextLink direction="next" to={next} /> : <span />}
      </div>
    </>
  )
}
