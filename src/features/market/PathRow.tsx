import { cn } from '@/lib/cn'
import { formatPathAccuracyScore, formatUSD } from '@/lib/format'

interface PathRowProps {
  index: number
  name: string
  multiplier: string
  /** Total USDC wagered on this path by all users */
  wagered?: number
  /** On-chain composite score, rendered as a user-facing 0-100 accuracy score. */
  compositeScore?: number
  active?: boolean
  pending?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function PathRow({
  index,
  name,
  multiplier,
  wagered,
  compositeScore,
  active = false,
  pending = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: PathRowProps) {
  const idx = String(index).padStart(2, '0')
  const hasWagered = wagered != null && wagered > 0
  const hasAccuracyScore = compositeScore != null && compositeScore > 0

  return (
    <button
      type="button"
      onClick={pending ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'border-line grid h-14 w-full grid-cols-[48px_1fr_auto] items-center gap-4 border-0 border-b border-l-2 border-l-transparent bg-transparent pr-5 pl-4 text-left',
        'duration-short ease-levx transition-[background,border-color]',
        'hover:border-l-ink-muted hover:bg-white/2',
        active && 'border-l-ink-strong bg-surface-2',
        pending && 'pointer-events-none opacity-50',
      )}
    >
      <span className="text-label text-ink-dim tracking-snug font-mono">[ {idx} ]</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            'truncate font-mono text-xs tracking-wide',
            active ? 'text-ink-strong' : 'text-ink',
          )}
        >
          {pending ? `${name} — confirming…` : name}
        </span>
        {(hasWagered || hasAccuracyScore) && (
          <span className="text-ink-dim text-label truncate font-mono tracking-wide">
            {hasAccuracyScore && `${formatPathAccuracyScore(compositeScore)}/100 accuracy`}
            {hasAccuracyScore && hasWagered && ' · '}
            {hasWagered && `${formatUSD(wagered)} wagered`}
          </span>
        )}
      </div>
      <span className="text-ink-strong text-caption font-mono">{multiplier}</span>
    </button>
  )
}
