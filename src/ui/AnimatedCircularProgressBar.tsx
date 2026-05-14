import { useId } from 'react'

import { cn } from '@/lib/cn'

interface AnimatedCircularProgressBarProps {
  max?: number
  min?: number
  value: number
  gaugePrimaryColor?: string
  gaugePrimaryGradient?: {
    from: string
    to: string
  }
  gaugeSecondaryColor: string
  className?: string
  label?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function AnimatedCircularProgressBar({
  max = 100,
  min = 0,
  value = 0,
  gaugePrimaryColor = 'var(--color-brand-to)',
  gaugePrimaryGradient,
  gaugeSecondaryColor,
  className,
  label = 'Progress',
}: AnimatedCircularProgressBarProps) {
  const id = useId().replace(/:/g, '')
  const gradientId = `progress-gradient-${id}`
  const glowId = `progress-glow-${id}`
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const boundedValue = clamp(value, min, max)
  const currentPercent =
    max > min ? Math.round(((boundedValue - min) / (max - min)) * 100) : 0
  const strokeLength = (currentPercent / 100) * circumference
  const primaryStroke = gaugePrimaryGradient ? `url(#${gradientId})` : gaugePrimaryColor

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={currentPercent}
      aria-valuetext={`${currentPercent}% elapsed`}
      className={cn(
        'relative flex size-24 items-center justify-center',
        'font-mono text-sm leading-none font-bold',
        className,
      )}
    >
      <svg fill="none" className="size-full overflow-visible" viewBox="0 0 100 100" aria-hidden>
        <defs>
          {gaugePrimaryGradient && (
            <linearGradient
              id={gradientId}
              x1="18"
              y1="18"
              x2="82"
              y2="82"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={gaugePrimaryGradient.from} />
              <stop offset="100%" stopColor={gaugePrimaryGradient.to} />
            </linearGradient>
          )}
          <filter
            id={glowId}
            x="-35"
            y="-35"
            width="170"
            height="170"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={gaugeSecondaryColor}
          strokeWidth="8"
          strokeLinecap="round"
          className="opacity-30"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={primaryStroke}
          strokeWidth="10"
          strokeDasharray={`${strokeLength} ${circumference}`}
          strokeLinecap="round"
          className="opacity-45 transition-[stroke-dasharray] duration-1000 ease-out"
          transform="rotate(-90 50 50)"
          filter={`url(#${glowId})`}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={primaryStroke}
          strokeWidth="8"
          strokeDasharray={`${strokeLength} ${circumference}`}
          strokeLinecap="round"
          className="transition-[stroke-dasharray,stroke] duration-1000 ease-out"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="text-ink-strong absolute inset-0 m-auto grid h-fit w-fit">
        {currentPercent}
      </span>
    </div>
  )
}
