import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { SIGILS, sigilFill, sigilStroke, type SigilTone } from '@/ui/Sigils'

import type { LeaderboardEntry } from './data'

/* ════════════════════════════════════════════════════════
   PODIUM — top 3 display
   Project-native: sigil avatars, dot-matrix rank digits,
   tick-rule on the plinth flank, winner framed by a
   brand-gradient crown line.
   ════════════════════════════════════════════════════════ */

// Center the winner: render 2nd — 1st — 3rd
const PODIUM_ORDER = [1, 0, 2]
// Indexed by entry.rank - 1 (so [0] is the winner)
const PODIUM_HEIGHTS = [224, 168, 128]
const PODIUM_AVATAR_SIZES = [76, 60, 52]
const PODIUM_DIGIT_CELL = [14, 11, 9]
const PODIUM_TICK_COUNT = [11, 8, 6]

export function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <section className="relative mb-14 pt-6">
      {/* Section label */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <span className="bg-line-strong h-px w-16" />
        <span className="text-ink-dim font-mono text-label tracking-wider uppercase">
          Season · 01 · Honors
        </span>
        <span className="bg-line-strong h-px w-16" />
      </div>

      <div className="flex items-end justify-center gap-8">
        {PODIUM_ORDER.map((i) => {
          const entry = entries[i]
          if (!entry) return null
          return <PodiumColumn key={entry.rank} entry={entry} />
        })}
      </div>

      {/* Base ground line extending under all three plinths */}
      <div className="bg-line-strong mx-auto mt-0 h-px w-[760px] max-w-full" />
      <div className="mx-auto mt-2 flex w-[760px] max-w-full justify-between px-4">
        {Array.from({ length: 32 }).map((_, k) => (
          <span key={k} className="bg-line h-1 w-px" />
        ))}
      </div>
    </section>
  )
}

function PodiumColumn({ entry }: { entry: LeaderboardEntry }) {
  const idx = entry.rank - 1 // 0,1,2
  const isWinner = entry.rank === 1
  const tone: SigilTone = isWinner ? 'accent' : 'strong'
  const Sigil = SIGILS[entry.avatarIdx] ?? SIGILS[0]
  const height = PODIUM_HEIGHTS[idx]
  const avatarSize = PODIUM_AVATAR_SIZES[idx]

  return (
    <div className="flex w-[208px] flex-col items-center">
      {/* Sigil avatar */}
      <div
        className={cn(
          'relative mb-5 flex items-center justify-center rounded-full border',
          isWinner ? 'border-ink-strong' : 'border-line-strong',
          'bg-surface-1',
        )}
        style={{
          width: avatarSize + 24,
          height: avatarSize + 24,
          boxShadow: isWinner
            ? '0 0 0 5px var(--color-surface), 0 0 0 6px color-mix(in srgb, var(--color-brand-to) 70%, transparent), 0 0 32px color-mix(in srgb, var(--color-brand-to) 30%, transparent)'
            : '0 0 0 4px var(--color-surface), 0 0 0 5px var(--color-line-strong)',
        }}
      >
        <Sigil size={avatarSize} tone={tone} />
        {isWinner && (
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 font-mono text-nano tracking-wider uppercase"
            style={{
              color: 'var(--color-brand-to)',
              background: 'var(--color-surface)',
            }}
          >
            Champion
          </span>
        )}
      </div>

      {/* User handle */}
      <div className="text-ink-strong mb-1 font-mono text-sm font-bold tracking-snug">
        {entry.user}
      </div>

      {/* Score */}
      <div className="mb-5 flex items-baseline gap-2">
        <span className="text-ink-dim font-mono text-nano tracking-wider uppercase">
          Score
        </span>
        <span
          className={cn(
            'font-mono text-sm tracking-snug',
            isWinner ? 'text-ink-strong font-bold' : 'text-ink-muted',
          )}
        >
          {formatUSD(entry.score)}
        </span>
      </div>

      {/* Plinth */}
      <div
        className={cn(
          'relative w-full overflow-hidden',
          'border-line-strong border-t border-r border-l',
          'bg-surface-1/40',
        )}
        style={{ height }}
      >
        {/* Brand-gradient crown (winner only) */}
        {isWinner && (
          <span
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, var(--color-brand-from) 20%, var(--color-brand-to) 80%, transparent 100%)',
            }}
          />
        )}

        {/* Tick rule on the left flank */}
        <TickRule count={PODIUM_TICK_COUNT[idx]} />

        {/* Big dot-matrix rank digit */}
        <div className="absolute inset-0 flex items-center justify-center pb-5 pl-4">
          <DotDigit digit={entry.rank} cell={PODIUM_DIGIT_CELL[idx]} tone={tone} />
        </div>

        {/* Readout strip — bottom edge */}
        <div
          className={cn(
            'border-line absolute right-0 bottom-0 left-0 flex items-center justify-between border-t px-2.5 py-1.5',
            'font-mono text-nano tracking-wider uppercase',
          )}
        >
          <span className="text-ink-dim">{entry.markets} MKT</span>
          <span className={cn(isWinner ? 'text-(--color-brand-to)' : 'text-ink-dim')}>
            {entry.accuracy.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

/** Dot-matrix digit (3 columns × 5 rows) — Nothing-OS style numerals. */
function DotDigit({
  digit,
  cell,
  tone,
}: {
  digit: number
  cell: number
  tone: SigilTone
}) {
  const patterns: Record<number, number[][]> = {
    1: [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 1],
    ],
    2: [
      [1, 1, 1],
      [0, 0, 1],
      [1, 1, 1],
      [1, 0, 0],
      [1, 1, 1],
    ],
    3: [
      [1, 1, 1],
      [0, 0, 1],
      [0, 1, 1],
      [0, 0, 1],
      [1, 1, 1],
    ],
  }
  const pattern = patterns[digit] ?? patterns[1]
  const cols = 3
  const rows = 5
  const gap = cell * 0.4
  const width = cols * cell + (cols - 1) * gap
  const height = rows * cell + (rows - 1) * gap
  const r = cell / 2

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {pattern.map((row, ri) =>
        row.map((on, ci) => {
          const cx = ci * (cell + gap) + r
          const cy = ri * (cell + gap) + r
          return (
            <circle
              key={`${ri}-${ci}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={on ? sigilFill(tone) : sigilStroke(tone, 0.12)}
            />
          )
        }),
      )}
    </svg>
  )
}

/** Vertical measurement rule along the plinth's left edge. */
function TickRule({ count }: { count: number }) {
  return (
    <div className="absolute top-5 bottom-5 left-2 flex flex-col justify-between">
      {Array.from({ length: count }).map((_, i) => {
        const major = i === 0 || i === count - 1 || i === Math.floor(count / 2)
        return (
          <span
            key={i}
            className={cn(
              'bg-line-strong block h-px',
              major ? 'w-3' : 'w-1.5 opacity-60',
            )}
          />
        )
      })}
    </div>
  )
}
