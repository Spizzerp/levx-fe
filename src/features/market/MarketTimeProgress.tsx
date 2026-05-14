import { AnimatedCircularProgressBar } from '@/ui/AnimatedCircularProgressBar'
import { cn } from '@/lib/cn'

interface MarketTimeProgressProps {
  startTime: number
  endTime: number
  now: number
  className?: string
}

export function marketTimeProgressPercent({
  startTime,
  endTime,
  now,
}: {
  startTime: number
  endTime: number
  now: number
}): number {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || !Number.isFinite(now)) {
    return 0
  }

  if (endTime <= startTime) return now >= endTime ? 100 : 0

  const elapsed = now - startTime
  const duration = endTime - startTime
  return Math.min(100, Math.max(0, (elapsed / duration) * 100))
}

export function MarketTimeProgress({
  startTime,
  endTime,
  now,
  className,
}: MarketTimeProgressProps) {
  const value = marketTimeProgressPercent({ startTime, endTime, now })

  return (
    <div className={cn('flex size-36 shrink-0 items-center justify-center', className)}>
      <AnimatedCircularProgressBar
        value={value}
        gaugePrimaryGradient={{
          from: 'var(--color-brand-from)',
          to: 'var(--color-brand-to)',
        }}
        gaugeSecondaryColor="var(--color-line-strong)"
        label="Market time elapsed"
        className="size-32 text-lg"
      />
    </div>
  )
}
