import { cn } from '@/lib/cn'

export function MarketCardSkeleton() {
  return (
    <div
      className={cn(
        'relative flex w-full flex-col',
        'overflow-hidden',
        'h-[290px]',
        'border-line from-surface-1 to-surface-2 rounded-[24px] border bg-gradient-to-b',
        'animate-pulse',
      )}
      role="status"
      aria-label="Loading market card"
    />
  )
}
