import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'

interface PathRowProps {
  index: number
  name: string
  multiplier: string
  /** Total USDC wagered on this path by all users */
  wagered?: number
  active?: boolean
  onClick?: () => void
}

export function PathRow({ index, name, multiplier, wagered, active = false, onClick }: PathRowProps) {
  const idx = String(index).padStart(2, '0')
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-line grid h-14 w-full grid-cols-[44px_1fr_auto] items-center gap-4 border-0 border-b border-l-2 border-l-transparent bg-transparent pr-[18px] pl-4 text-left',
        'duration-short ease-levx transition-[background]',
        'hover:bg-white/[0.02]',
        active && 'border-l-ink-strong bg-surface-2',
      )}
    >
      <span className="text-label text-ink-dim font-mono tracking-snug">[ {idx} ]</span>
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            'font-mono text-xs tracking-wide uppercase',
            active ? 'text-ink-strong' : 'text-ink',
          )}
        >
          {name}
        </span>
        {wagered != null && wagered > 0 && (
          <span className="text-ink-dim font-mono text-[9px] tracking-[0.06em]">
            {formatUSD(wagered)} wagered
          </span>
        )}
      </div>
      <span className="text-ink-strong font-mono text-[13px]">{multiplier}</span>
    </button>
  )
}
