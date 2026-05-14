import { useCallback, useState } from 'react'
import { motion } from 'motion/react'

import { AnimatedCircularProgressBar } from '@/ui/AnimatedCircularProgressBar'
import { DiaTextReveal } from '@/ui/DiaTextReveal'
import { cn } from '@/lib/cn'
import { marketTimeProgressPercent } from '@/features/market/timeProgressMath'

interface MarketTimeProgressProps {
  startTime: number
  endTime: number
  now: number
  className?: string
}

type LabelPhase = 'hidden' | 'visible' | 'exiting'

export function MarketTimeProgress({
  startTime,
  endTime,
  now,
  className,
}: MarketTimeProgressProps) {
  const [labelPhase, setLabelPhase] = useState<LabelPhase>('hidden')
  const value = marketTimeProgressPercent({ startTime, endTime, now })
  const showLabel = labelPhase !== 'hidden'

  const handleSweepComplete = useCallback(() => {
    setLabelPhase((phase) => (phase === 'exiting' ? 'hidden' : phase))
  }, [])

  return (
    <div
      className={cn('relative flex size-32 shrink-0 items-center justify-center', className)}
      onPointerEnter={() => setLabelPhase('visible')}
      onPointerLeave={() => setLabelPhase((phase) => (phase === 'hidden' ? phase : 'exiting'))}
    >
      {showLabel && (
        <motion.div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 right-full -translate-y-1/2',
            'mr-5',
            'text-right font-mono text-caption tracking-widest whitespace-nowrap uppercase',
          )}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        >
          <DiaTextReveal
            text="Market time elapsed"
            colors={['var(--color-brand-from)', 'var(--color-brand-to)']}
            textColor="var(--color-ink-muted)"
            duration={0.85}
            startOnView={false}
            once={false}
            direction={labelPhase === 'exiting' ? 'reverse' : 'forward'}
            onSweepComplete={handleSweepComplete}
          />
        </motion.div>
      )}
      <AnimatedCircularProgressBar
        value={value}
        gaugePrimaryGradient={{
          from: 'var(--color-brand-from)',
          to: 'var(--color-brand-to)',
        }}
        gaugeSecondaryColor="var(--color-line-strong)"
        label="Market time elapsed"
        className="size-28 text-base"
      />
    </div>
  )
}
