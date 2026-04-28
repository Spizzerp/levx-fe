import { ChevronRight, ArrowUpRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/cn'
import { HyperText } from '@/ui/HyperText'
import { DOC_META, DOC_ORDER } from './data'
import { DOC_RENDERERS } from './content'
import type { DocId } from './types'

function DocsBreadcrumb({ doc }: { doc: DocId }) {
  const meta = DOC_META[doc]
  return (
    <div className="mb-8 flex items-center gap-2 text-nano font-mono tracking-wider uppercase">
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

function DocMetaStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl
      className={cn(
        'flex flex-wrap items-baseline',
        'border-line border-y',
        'gap-x-6 gap-y-2 px-1 py-3',
      )}
    >
      {items.map((it, idx) => (
        <div key={it.label} className="flex items-baseline gap-2">
          {idx > 0 && (
            <span aria-hidden className="bg-line h-2 w-px translate-y-px" />
          )}
          <dt className="text-ink-dim text-nano font-mono tracking-wider uppercase">
            {it.label}
          </dt>
          <dd className="text-ink-strong font-mono text-[13px]">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PrevNextLink({ direction, to }: { direction: 'prev' | 'next'; to: DocId }) {
  const meta = DOC_META[to]
  const isNext = direction === 'next'
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('levx-docs-select', { detail: { id: to } }),
        )
      }}
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
    </button>
  )
}

export function DocsContent({
  doc,
  contentRef,
}: {
  doc: DocId
  contentRef: React.RefObject<HTMLDivElement | null>
}) {
  const meta = DOC_META[doc]
  const Renderer = DOC_RENDERERS[doc]

  const orderedIndex = DOC_ORDER.indexOf(doc)
  const prev = orderedIndex > 0 ? DOC_ORDER[orderedIndex - 1] : null
  const next =
    orderedIndex >= 0 && orderedIndex < DOC_ORDER.length - 1
      ? DOC_ORDER[orderedIndex + 1]
      : null

  return (
    <article
      ref={contentRef}
      className={cn(
        'h-full overflow-y-auto',
        'pt-12 pr-12 pb-24 pl-12',
      )}
    >
      <div className="mx-auto max-w-[760px]">
        <DocsBreadcrumb doc={doc} />

        <h1
          className={cn(
            'text-ink-strong mb-6',
            'font-display text-[44px] leading-none font-medium tracking-tighter',
            "[font-variation-settings:'ROND'_100]",
          )}
        >
          <HyperText>{meta.title}</HyperText>
        </h1>

        <p className="text-ink-muted font-editorial mb-10 text-[20px] leading-snug tracking-tight">
          {meta.tagline}
        </p>

        <DocMetaStrip items={meta.meta} />

        <div className="mt-12">
          <Renderer />
        </div>

        <div className="border-line mt-20 grid grid-cols-2 gap-px border-t pt-8">
          {prev ? <PrevNextLink direction="prev" to={prev} /> : <span />}
          {next ? <PrevNextLink direction="next" to={next} /> : <span />}
        </div>

        {/* <div className="border-line text-ink-dim text-nano mt-8 flex items-center justify-between border-t pt-6 font-mono tracking-wider uppercase">
          <a
            href={`https://github.com/levx-protocol/docs/edit/main/${doc}.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink-strong duration-short ease-levx flex items-center gap-1.5 transition-colors"
          >
            Edit this page
            <ArrowUpRight size={11} />
          </a>
          <span>levx-protocol / docs / {doc}.md</span>
        </div> */}
      </div>
    </article>
  )
}
