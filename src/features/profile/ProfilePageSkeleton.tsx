import { ChartFrame } from '@/features/chart/ChartFrame'
import { cn } from '@/lib/cn'
import { Skeleton } from '@/ui/Skeleton'

export function ProfilePageSkeleton() {
  return (
    <ChartFrame glow className="isolate overflow-visible!">
      <div className="grid grid-cols-1 [@media(min-width:960px)]:grid-cols-[360px_1fr]">
        <div className="border-line relative px-8 py-8 [@media(min-width:960px)]:border-r">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(circle at 50% 28%, color-mix(in srgb, var(--color-brand-to) 10%, transparent), transparent 55%)',
            }}
          />

          <div className="relative mt-2 mb-6 flex flex-col items-center">
            <Skeleton
              className={cn(
                'border-line-strong h-[120px] w-[120px] rounded-full border',
                'bg-surface-1',
              )}
            />

            <div className="mt-6 flex items-center gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-label text-ink-dim font-mono tracking-[0.28em] uppercase">
                01
              </span>
              <span className="text-label text-ink-muted font-mono tracking-wide uppercase">
                Profile Image
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="border-line aspect-square rounded-md border" />
            ))}
          </div>
        </div>

        <div className="px-8 py-8">
          <div className="space-y-7">
            <ProfileFieldSkeleton
              index="02"
              label="Username"
              hint="3-20 - lowercase"
              inputClassName="h-8 w-full max-w-[360px]"
            />
            <ProfileFieldSkeleton
              index="03"
              label="Display Name"
              hint="How you appear on leaderboards"
              inputClassName="h-8 w-full max-w-[320px]"
            />
            <ProfileFieldSkeleton
              index="04"
              label="Bio"
              hint="0 / 160"
              inputClassName="h-4 w-full"
              secondaryInputClassName="mt-3 h-4 w-11/12"
            />
            <ProfileFieldSkeleton
              index="05"
              label="X / Twitter"
              hint="Optional"
              inputClassName="h-6 w-full max-w-[260px]"
            />
          </div>
        </div>
      </div>

      <footer className="border-line flex items-center justify-between gap-6 border-t px-8 py-5">
        <Skeleton className="h-3 w-full max-w-[420px]" />
        <Skeleton className="h-11 w-[200px] rounded-full" />
      </footer>
    </ChartFrame>
  )
}

interface ProfileFieldSkeletonProps {
  index: string
  label: string
  hint: string
  inputClassName: string
  secondaryInputClassName?: string
}

function ProfileFieldSkeleton({
  index,
  label,
  hint,
  inputClassName,
  secondaryInputClassName,
}: ProfileFieldSkeletonProps) {
  return (
    <section className="border-line border-b pb-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-label text-ink-dim font-mono tracking-[0.28em] uppercase">
            {index}
          </span>
          <span className="text-label text-ink-muted font-mono tracking-wide uppercase">
            {label}
          </span>
        </div>
        <span className="text-micro text-ink-dim font-mono tracking-wider uppercase">{hint}</span>
      </div>

      <Skeleton className={inputClassName} />
      {secondaryInputClassName ? <Skeleton className={secondaryInputClassName} /> : null}
    </section>
  )
}
