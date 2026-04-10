import { cn } from '@/lib/cn'

interface PathRowProps {
  index: number
  name: string
  multiplier: string
  active?: boolean
  onClick?: () => void
}

export function PathRow({ index, name, multiplier, active = false, onClick }: PathRowProps) {
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
      <span className="text-label text-ink-dim font-mono tracking-[0.05em]">[ {idx} ]</span>
      <span
        className={cn(
          'font-mono text-xs tracking-[0.1em] uppercase',
          active ? 'text-ink-strong' : 'text-ink',
        )}
      >
        {name}
      </span>
      <span className="text-ink-strong font-mono text-[13px]">{multiplier}</span>
    </button>
  )
}
