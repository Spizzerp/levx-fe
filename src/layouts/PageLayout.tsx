import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface PageLayoutProps {
  children: ReactNode
  /** Page title displayed in display font */
  title: string
  /** Optional subtitle below the title */
  subtitle?: string
  /** Optional summary bar content rendered below the header */
  summaryBar?: ReactNode
  /** Extra header actions (e.g., filters, buttons) */
  headerActions?: ReactNode
  className?: string
}

export function PageLayout({
  title,
  subtitle,
  summaryBar,
  headerActions,
  children,
  className,
}: PageLayoutProps) {
  return (
    <main className={cn('mx-auto max-w-[1680px] px-10 pt-14 pb-12', className)}>
      <header className="mb-12">
        <h1 className="font-display text-ink-strong text-display-lg mb-4 leading-none font-medium tracking-tighter [font-variation-settings:'ROND'_100]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-ink-muted font-mono text-xs tracking-normal uppercase">
            {subtitle}
          </p>
        )}
        {headerActions && <div className="mt-6">{headerActions}</div>}
      </header>

      {summaryBar && <div className="mb-8">{summaryBar}</div>}

      {children}
    </main>
  )
}
