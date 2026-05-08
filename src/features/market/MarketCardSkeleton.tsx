import { cn } from '@/lib/cn'

export function MarketCardSkeleton() {
  return (
    <div
      className={cn(
        'relative flex w-full flex-col',
        'overflow-hidden',
        'h-[290px]',
        'border-line from-surface-1 to-surface-2 rounded-[24px] border bg-gradient-to-b',
      )}
      role="status"
      aria-label="Loading market card"
    >
      {/* Background Noise Texture */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full w-full flex-col">
        {/* Top Section: Title skeleton */}
        <div className="flex flex-col gap-2 p-6 pb-0">
          <div className="h-6 w-3/4 rounded-sm bg-white/[0.06] animate-pulse" />
          <div className="flex gap-3">
            <div className="h-3 w-32 rounded-sm bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-24 rounded-sm bg-white/[0.06] animate-pulse" />
          </div>
        </div>

        {/* Middle Section: Chart skeleton */}
        <div className="relative min-h-0 flex-1 px-4 py-4">
          <div className="h-full w-full rounded-sm bg-white/[0.04] animate-pulse" />
        </div>

        {/* Bottom Section: Metrics skeleton */}
        <div className="relative mt-auto flex items-center justify-between px-6 py-4 bg-surface/40">
          {/* Dashed Top Border */}
          <div className="absolute inset-x-0 top-0 h-px bg-[radial-gradient(circle_at_center,_var(--color-line-strong)_1px,_transparent_1px)] bg-[length:4px_1px] opacity-30" />

          {/* Token pair skeleton */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/[0.06] animate-pulse shrink-0" />
            <div className="flex flex-col gap-1">
              <div className="h-3 w-16 rounded-sm bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-12 rounded-sm bg-white/[0.06] animate-pulse" />
            </div>
          </div>

          {/* % change skeleton */}
          <div className="h-6 w-20 rounded-sm bg-white/[0.06] animate-pulse" />
        </div>
      </div>
    </div>
  )
}
