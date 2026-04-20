import { ChartFrame } from '@/features/chart/ChartFrame'
import { DataTable, NUM_CELL, type DataTableColumn } from '@/ui/DataTable'
import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'
import { SIGILS, sigilFill, sigilStroke, type SigilTone } from '@/ui/Sigils'

interface LeaderboardEntry {
  rank: number
  user: string
  score: number
  accuracy: number
  markets: number
  avatarIdx: number
}

const LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, user: '7K4D···9XQ2', score: 142_580, accuracy: 89.2, markets: 34, avatarIdx: 4 },
  { rank: 2, user: '3mRf···pLw1', score: 128_340, accuracy: 84.7, markets: 28, avatarIdx: 6 },
  { rank: 3, user: 'Bx9T···kZn4', score: 115_920, accuracy: 81.3, markets: 31, avatarIdx: 1 },
  { rank: 4, user: 'Qw2P···vHm8', score: 98_450, accuracy: 77.1, markets: 25, avatarIdx: 0 },
  { rank: 5, user: 'Nt5L···jRs6', score: 87_200, accuracy: 74.5, markets: 22, avatarIdx: 2 },
  { rank: 6, user: 'Yh8K···cFd3', score: 76_890, accuracy: 71.9, markets: 20, avatarIdx: 3 },
  { rank: 7, user: 'Wm1X···bGv7', score: 65_430, accuracy: 68.2, markets: 18, avatarIdx: 5 },
  { rank: 8, user: 'Zv4C···xTn2', score: 54_120, accuracy: 65.8, markets: 15, avatarIdx: 7 },
  { rank: 9, user: 'Dp6S···aUq9', score: 48_750, accuracy: 63.1, markets: 14, avatarIdx: 8 },
  { rank: 10, user: 'Fj3R···eYh5', score: 42_300, accuracy: 60.4, markets: 12, avatarIdx: 0 },
]

const TOP_3 = LEADERBOARD_DATA.slice(0, 3)
const REST = LEADERBOARD_DATA.slice(3)

// Center the winner: render 2nd — 1st — 3rd
const PODIUM_ORDER = [1, 0, 2]
// Indexed by entry.rank - 1 (so [0] is the winner)
const PODIUM_HEIGHTS = [224, 168, 128]
const PODIUM_AVATAR_SIZES = [76, 60, 52]
const PODIUM_DIGIT_CELL = [14, 11, 9]
const PODIUM_TICK_COUNT = [11, 8, 6]

const COLUMNS: DataTableColumn<LeaderboardEntry>[] = [
  {
    key: 'rank',
    header: 'RANK',
    cellClassName: 'text-ink-dim font-mono text-sm tracking-snug',
    render: (entry) => `#${entry.rank}`,
  },
  {
    key: 'user',
    header: 'USER',
    cellClassName: 'text-ink-strong font-mono text-sm font-bold tracking-normal',
    render: (entry) => entry.user,
  },
  {
    key: 'score',
    header: 'SCORE',
    headerClassName: 'text-right',
    cellClassName: NUM_CELL,
    render: (entry) => formatUSD(entry.score),
  },
  {
    key: 'accuracy',
    header: 'ACCURACY',
    headerClassName: 'text-right',
    cellClassName: NUM_CELL,
    render: (entry) => `${entry.accuracy.toFixed(1)}%`,
  },
  {
    key: 'markets',
    header: 'MARKETS',
    headerClassName: 'text-right',
    cellClassName: NUM_CELL,
    render: (entry) => entry.markets,
  },
]

export function LeaderboardPage() {
  return (
    <PageLayout
      title="Leaderboard"
      subtitle="Season 1 rankings"
      summaryBar={
        <div className="border-line flex items-center gap-12 border-0 border-b pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Total Participants
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {LEADERBOARD_DATA.length.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Top Score
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {formatUSD(LEADERBOARD_DATA[0].score)}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Avg Accuracy
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {(
                LEADERBOARD_DATA.reduce((s, e) => s + e.accuracy, 0) /
                LEADERBOARD_DATA.length
              ).toFixed(1)}
              %
            </div>
          </div>
        </div>
      }
    >
      {/* Podium: Top 3 */}
      <Podium />

      {/* Rest of the list */}
      {REST.length > 0 && (
        <ChartFrame glow>
          <DataTable
            columns={COLUMNS}
            data={REST}
            gridCols="grid-cols-[48px_140px_120px_100px_1fr]"
            rowHeight="h-[56px]"
            keyExtractor={(entry) => entry.rank}
          />
        </ChartFrame>
      )}
    </PageLayout>
  )
}

/* ════════════════════════════════════════════════════════
   PODIUM — top 3 display
   Project-native: sigil avatars, dot-matrix rank digits,
   tick-rule on the plinth flank, winner framed by a
   brand-gradient crown line.
   ════════════════════════════════════════════════════════ */

function Podium() {
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
          const entry = TOP_3[i]
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
