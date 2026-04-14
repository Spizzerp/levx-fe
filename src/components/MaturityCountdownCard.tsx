import { useEffect, useState } from 'react'

import { formatCountdown } from '@/lib/format'
import type { Market } from '@/types/market'

interface MaturityCountdownCardProps {
  market: Market
}

/**
 * Right-rail card rendered during Maturing state (in the wager-slot position).
 * Counts down to `market.endTime`; updates every second; cleans up on unmount.
 */
export function MaturityCountdownCard({ market }: MaturityCountdownCardProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remaining = Math.max(0, market.endTime - now)

  return (
    <div className="border-line flex flex-col gap-3 border p-6">
      <p className="text-ink-strong font-mono text-label tracking-wide uppercase">
        Maturity review
      </p>
      <p className="text-ink-muted font-mono text-sm leading-relaxed">
        Market is in the maturity review window.
      </p>
      <p className="text-ink-strong text-body-sm font-mono font-bold">
        Claims open in {formatCountdown(remaining)}
      </p>
    </div>
  )
}
