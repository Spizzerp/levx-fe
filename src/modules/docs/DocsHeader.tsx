import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ThemeToggle } from '@/ui/ThemeToggle'

const FOCUS_RING = cn(
  'focus-visible:ring-ink-strong focus-visible:ring-offset-surface',
  'focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:outline-none',
)

const FOCUS_WITHIN_RING = cn(
  'focus-within:ring-ink-strong focus-within:ring-offset-surface',
  'focus-within:ring-1 focus-within:ring-offset-2',
)

const ICON_ACTION = cn(
  'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full',
  'text-ink-muted transition-colors duration-short ease-levx',
  'hover:text-ink-strong',
  FOCUS_RING,
)

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.65.5.5 5.77.5 12.28c0 5.21 3.29 9.62 7.86 11.18.57.11.78-.25.78-.57 0-.28-.01-1.02-.02-2-3.2.71-3.87-1.58-3.87-1.58-.52-1.36-1.28-1.72-1.28-1.72-1.05-.73.08-.72.08-.72 1.15.08 1.76 1.22 1.76 1.22 1.03 1.8 2.7 1.28 3.35.98.1-.76.4-1.28.73-1.58-2.55-.3-5.23-1.31-5.23-5.82 0-1.29.45-2.34 1.18-3.16-.12-.3-.51-1.5.11-3.12 0 0 .97-.32 3.17 1.2A10.72 10.72 0 0 1 12 5.7c.98 0 1.97.14 2.89.4 2.2-1.52 3.16-1.2 3.16-1.2.63 1.62.23 2.82.12 3.12.74.82 1.18 1.87 1.18 3.16 0 4.52-2.68 5.52-5.24 5.81.41.37.78 1.09.78 2.19 0 1.58-.01 2.86-.01 3.25 0 .32.2.68.79.57 4.55-1.56 7.83-5.97 7.83-11.18C23.5 5.77 18.35.5 12 .5Z"
      />
    </svg>
  )
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function DocsSearch({ query, onChange }: { query: string; onChange: (v: string) => void }) {
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
        'group relative z-10 flex h-10 w-full max-w-[420px] items-center gap-2',
        'border-line bg-surface-1 rounded-full border px-3',
        'duration-short ease-levx transition-colors',
        'focus-within:border-line-strong',
        FOCUS_WITHIN_RING,
        'sm:max-w-none',
      )}
    >
      <Search size={13} className="text-ink-dim shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search documentation"
        placeholder="Search docs"
        className={cn(
          'min-w-0 flex-1',
          'text-ink placeholder:text-ink-dim text-ui font-sans',
          'focus:outline-none',
        )}
      />
      <span
        aria-hidden="true"
        className="text-ink-dim text-ui flex shrink-0 items-center gap-1 font-mono sm:hidden"
      >
        <span>⌘</span>
        <span>+</span>
        <span>K</span>
      </span>
    </div>
  )
}

export function DocsHeader({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (v: string) => void
}) {
  return (
    <header
      className={cn(
        'z-nav pointer-events-none fixed top-0 left-0 w-full',
        'px-6 pt-3 pb-3',
        'sm:px-2 sm:pt-2 sm:pb-2',
      )}
    >
      <nav
        aria-label="Documentation top navigation"
        className={cn(
          'pill-glow relative mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4',
          'border-line-strong bg-surface rounded-full border',
          'pointer-events-auto',
          'px-6 py-3',
          'sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-2 sm:gap-y-2 sm:rounded-[28px] sm:px-3 sm:py-2',
        )}
      >
        <div
          className={cn(
            'relative z-10 flex shrink-0 items-center gap-3',
            'min-h-10',
            'sm:col-start-1 sm:row-start-1 sm:min-w-0 sm:shrink sm:gap-2',
          )}
        >
          <Link
            to="/"
            className={cn(
              'flex shrink-0 items-center rounded-full',
              'duration-short ease-levx transition-opacity',
              'hover:opacity-80',
              FOCUS_RING,
            )}
          >
            <img src="/logo_color.png" alt="LevX" className="-my-1 h-12 w-auto sm:h-10" />
          </Link>
          <span className="text-ink-strong text-label min-w-0 font-mono tracking-wider uppercase">
            Docs
          </span>
        </div>

        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-10 flex items-center justify-center',
            'px-72',
            'lg:px-64',
            'md:static md:flex-1 md:justify-start md:px-0',
            'sm:hidden',
          )}
        >
          <div
            className={cn(
              'pointer-events-auto flex w-full max-w-[420px] items-center',
              'sm:max-w-none',
            )}
          >
            <DocsSearch query={query} onChange={onQueryChange} />
          </div>
        </div>

        <div
          className={cn(
            'relative z-10 flex shrink-0 items-center gap-2',
            'sm:col-start-2 sm:row-start-1 sm:gap-1 sm:justify-self-end',
          )}
        >
          <a
            href="https://github.com/levx-protocol"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LevX GitHub"
            className={ICON_ACTION}
          >
            <GitHubIcon size={16} />
          </a>
          <a
            href="https://x.com/LevXtrade"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LevX on X"
            className={ICON_ACTION}
          >
            <XIcon size={15} />
          </a>
          <ThemeToggle aria-label="Toggle theme" className={ICON_ACTION} />
        </div>

        <div className="relative z-10 hidden min-w-0 sm:col-span-2 sm:row-start-2 sm:block">
          <DocsSearch query={query} onChange={onQueryChange} />
        </div>
      </nav>
    </header>
  )
}
