import { cn } from '@/lib/cn'

interface MarketsTableSkeletonProps {
  rows?: number
}

/**
 * Inline loading placeholder for the markets DataTable.
 *
 * Mirrors the real table's column grid + row height so there's no layout shift
 * when real data lands. Uses the Nothing-aesthetic monochrome `animate-pulse`
 * already shipped by Tailwind — no custom keyframes.
 *
 * Column grid mirrors MarketsPage `gridCols` / `gridColsWide`:
 *   narrow: [48 140 1fr 160 160 24]
 *   wide:   [56 160 1fr 200 200 160 120 24]
 */
export function MarketsTableSkeleton({ rows = 5 }: MarketsTableSkeletonProps) {
  const rowGridClass = cn(
    'grid items-center gap-4 px-4',
    'grid-cols-[48px_140px_1fr_160px_160px_24px]',
    '[@media(min-width:1201px)]:grid-cols-[56px_160px_1fr_200px_200px_160px_120px_24px]',
  )

  // Hidden below 1200px — matches MarketsPage NARROW_HIDE for the three extra columns.
  const NARROW_HIDE = '[@media(max-width:1200px)]:hidden'
  const bar = 'h-3 rounded-sm bg-white/[0.06]'

  return (
    <div
      role="status"
      aria-label="Loading markets"
      aria-busy="true"
      className="flex flex-col"
    >
      {/* Header row matching DataTable */}
      <div
        className={cn(
          rowGridClass,
          'border-line-strong h-10 border-0 border-b',
          'text-ink-dim font-mono text-tag uppercase',
        )}
      >
        <span className={cn(bar, 'w-6')} />
        <span className={cn(bar, 'w-16')} />
        <span className={cn(bar, 'w-20')} />
        <span className={cn(bar, 'ml-auto w-16')} />
        <span className={cn(bar, 'ml-auto w-16')} />
        <span className={cn(bar, 'ml-auto w-20', NARROW_HIDE)} />
        <span className={cn(bar, 'ml-auto w-16', NARROW_HIDE)} />
        <span className={cn(bar, 'ml-auto w-4', NARROW_HIDE)} />
      </div>

      {/* Placeholder rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            rowGridClass,
            'animate-pulse',
            'border-line h-[68px] border-0 border-b border-l-2 border-l-transparent',
          )}
        >
          <span className={cn(bar, 'w-8')} />
          <span className={cn(bar, 'w-24')} />
          <span className={cn(bar, 'w-40')} />
          <span className={cn(bar, 'ml-auto w-24')} />
          <span className={cn(bar, 'ml-auto w-28')} />
          <span className={cn(bar, 'ml-auto w-16', NARROW_HIDE)} />
          <span className={cn(bar, 'ml-auto w-12', NARROW_HIDE)} />
          <span className={cn(bar, 'ml-auto w-3', NARROW_HIDE)} />
        </div>
      ))}
      <span className="sr-only">Loading markets…</span>
    </div>
  )
}
