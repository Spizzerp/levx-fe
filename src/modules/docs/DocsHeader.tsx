import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowUpRight, Menu, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Kbd } from './primitives'

function DocsSearch({
  query,
  onChange,
}: {
  query: string
  onChange: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={cn(
        'group flex w-full max-w-[420px] items-center gap-2',
        'border-line focus-within:border-line-strong',
        'h-9 border px-3',
        'duration-short ease-levx transition-colors',
      )}
    >
      <Search size={13} className="text-ink-dim shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search docs"
        className={cn(
          'flex-1',
          'text-ink placeholder:text-ink-dim text-ui font-sans',
        )}
      />
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </div>
  )
}

export function DocsHeader({
  query,
  onQueryChange,
  onMobileToggle,
  mobileOpen,
}: {
  query: string
  onQueryChange: (v: string) => void
  onMobileToggle: () => void
  mobileOpen: boolean
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-nav',
        'border-line bg-surface/90 border-b backdrop-blur',
      )}
    >
      <div className="flex h-14 w-full items-center gap-4 px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo_wordmark.png" alt="LevX" className="h-4 w-auto" />
        </Link>

        <span className="text-success text-label font-mono tracking-wider uppercase">
          Docs
        </span>

        <button
          type="button"
          onClick={onMobileToggle}
          className={cn(
            'border-line text-ink hover:text-ink-strong hover:border-line-strong',
            'duration-short ease-levx flex size-9 items-center justify-center',
            'border transition-colors',
            'md:flex hidden',
          )}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        >
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <div className="flex flex-1 items-center justify-center px-4">
          <DocsSearch query={query} onChange={onQueryChange} />
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/levx-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'text-ink-dim hover:text-ink-strong',
              'duration-short ease-levx text-nano flex items-center gap-1.5',
              'font-mono tracking-wider uppercase transition-colors',
            )}
          >
            GitHub
            <ArrowUpRight size={11} />
          </a>
          <Link
            to="/"
            className={cn(
              'border-line text-ink hover:text-ink-strong hover:border-line-strong',
              'duration-short ease-levx flex items-center gap-2',
              'border px-3 py-1.5 transition-colors',
              'text-nano font-mono tracking-wider uppercase',
            )}
          >
            <ArrowLeft size={11} />
            Back to LevX
          </Link>
        </div>
      </div>
    </header>
  )
}
