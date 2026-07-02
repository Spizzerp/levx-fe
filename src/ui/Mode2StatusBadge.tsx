import { cn } from '@/lib/cn'
import { formatStatusLabel } from '@/lib/format'
import { toneForPairRiskStatus, type Mode2StatusTone } from '@/lib/mode2Status'
import type { PairRiskStatus } from '@/types/market'

export function Mode2StatusBadge({ tone, children }: { tone: Mode2StatusTone; children: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1',
        'font-mono text-[10px] font-bold tracking-wide uppercase',
        tone === 'safe' && 'border-success/40 bg-success/10 text-success',
        tone === 'warning' && 'border-warning/40 bg-warning/10 text-warning',
        tone === 'neutral' && 'border-line-strong bg-surface text-ink-muted',
        tone === 'muted' && 'border-line bg-surface/60 text-ink-dim',
      )}
    >
      {children}
    </span>
  )
}

export function PairRiskStatusBadge({ status }: { status: PairRiskStatus }) {
  return (
    <Mode2StatusBadge tone={toneForPairRiskStatus(status)}>
      {formatStatusLabel(status)}
    </Mode2StatusBadge>
  )
}
