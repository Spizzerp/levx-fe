import { useCallback, useState, type ReactNode } from 'react'
import { Check, Copy, Hash } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Code({ children }: { children: ReactNode }) {
  return (
    <code
      className={cn(
        'border-line bg-surface-1 text-ink-strong',
        'rounded-sm border px-1.5 py-px',
        'font-mono text-[0.85em]',
      )}
    >
      {children}
    </code>
  )
}

export function CodeBlock({
  language = 'shell',
  children,
}: {
  language?: string
  children: string
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [children])

  return (
    <div
      className={cn(
        'group relative my-6 overflow-hidden',
        'border-line bg-surface-1 rounded-md border',
      )}
    >
      <div className="border-line flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-ink-dim text-nano font-mono tracking-wider uppercase">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5',
            'text-ink-dim text-nano font-mono tracking-wider uppercase',
            'duration-short ease-levx transition-colors',
            'hover:text-ink-strong',
          )}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-ink-strong overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed sm:text-[12px]">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export function Note({
  kind = 'note',
  children,
}: {
  kind?: 'note' | 'warning' | 'tip'
  children: ReactNode
}) {
  const TONE: Record<typeof kind, { rule: string; label: string; color: string }> = {
    note: { rule: 'border-line-strong', label: 'NOTE', color: 'text-ink-muted' },
    tip: { rule: 'border-success', label: 'TIP', color: 'text-success' },
    warning: { rule: 'border-accent', label: 'WARNING', color: 'text-accent' },
  }
  const tone = TONE[kind]
  return (
    <aside
      className={cn('my-6 flex gap-4', 'border-l-2 py-2 pl-4', 'sm:flex-col sm:gap-2', tone.rule)}
    >
      <span
        className={cn(
          'shrink-0 pt-[2px]',
          'text-nano font-mono tracking-wider uppercase',
          tone.color,
        )}
      >
        {tone.label}
      </span>
      <div className="text-ink text-body-sm font-sans leading-relaxed">{children}</div>
    </aside>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'min-w-5 px-1.5 py-px',
        'border-line border',
        'text-ink-strong text-nano font-mono uppercase',
      )}
    >
      {children}
    </kbd>
  )
}

export function ManOption({
  flag,
  arg,
  required,
  children,
}: {
  flag: string
  arg?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="border-line border-t py-4">
      <dt className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className="text-ink-strong text-body-sm font-mono">{flag}</span>
        {arg && <span className="text-ink-muted font-mono text-[13px]">&lt;{arg}&gt;</span>}
        {required && (
          <span className="text-accent text-nano font-mono tracking-wider uppercase">Required</span>
        )}
      </dt>
      <dd className="text-ink-muted text-body-sm font-sans leading-relaxed">{children}</dd>
    </div>
  )
}

export function Section({
  id,
  num,
  heading,
  children,
}: {
  id: string
  num: string
  heading: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-32 pt-12 first:pt-0 sm:scroll-mt-56 sm:pt-10">
      <header className="mb-6">
        <div className="text-ink-dim text-nano mb-3 font-mono tracking-wider uppercase">
          § {num}
        </div>
        <h2 className="group flex items-baseline gap-3">
          <a
            href={`#${id}`}
            className="text-ink-strong text-heading font-sans font-medium tracking-tight"
          >
            {heading}
          </a>
          <Hash
            size={14}
            strokeWidth={1.5}
            className={cn(
              'text-ink-dim mt-[2px] opacity-0',
              'duration-short ease-levx transition-opacity',
              'group-hover:opacity-100',
            )}
            aria-hidden
          />
        </h2>
      </header>
      <div className="text-ink text-body-sm font-sans leading-relaxed">{children}</div>
    </section>
  )
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="text-ink-muted font-editorial mb-10 text-[20px] leading-snug tracking-tight">
      {children}
    </p>
  )
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 last:mb-0">{children}</p>
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="my-4 space-y-2 pl-0">{children}</ul>
}

export function Li({ children }: { children: ReactNode }) {
  return (
    <li className="border-line text-ink flex gap-3 border-l py-1 pl-4">
      <span aria-hidden className="text-ink-dim shrink-0 font-mono text-[13px]">
        ·
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}
