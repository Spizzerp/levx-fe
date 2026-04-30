import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { useUsdcBalance } from '@/lib/api/useUsdcBalance'

interface UsdcBalanceProps {
  /** Optional label override. Defaults to "USDC balance". */
  label?: string
  className?: string
}

/**
 * Compact balance display. Renders nothing when no wallet is connected
 * (the wager flows are gated behind `<ConnectGate>`, so the hosting
 * surface already prompts a connect there).
 */
export function UsdcBalance({ label = 'USDC balance', className }: UsdcBalanceProps) {
  const { data, isLoading } = useUsdcBalance()
  if (!data) return null

  return (
    <div className={cn('flex items-baseline justify-between gap-2', className)}>
      <span className="text-ink-dim text-caption font-mono tracking-wide uppercase">{label}</span>
      <span className="text-ink-strong text-caption font-mono">
        {isLoading ? '—' : `${formatUSD(data.balance)} USDC`}
      </span>
    </div>
  )
}
