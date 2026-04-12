import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'

interface LeaderboardEntry {
  rank: number
  user: string
  score: number
  accuracy: number
  markets: number
}

const LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, user: '7K4D···9XQ2', score: 142_580, accuracy: 89.2, markets: 34 },
  { rank: 2, user: '3mRf···pLw1', score: 128_340, accuracy: 84.7, markets: 28 },
  { rank: 3, user: 'Bx9T···kZn4', score: 115_920, accuracy: 81.3, markets: 31 },
  { rank: 4, user: 'Qw2P···vHm8', score: 98_450, accuracy: 77.1, markets: 25 },
  { rank: 5, user: 'Nt5L···jRs6', score: 87_200, accuracy: 74.5, markets: 22 },
  { rank: 6, user: 'Yh8K···cFd3', score: 76_890, accuracy: 71.9, markets: 20 },
  { rank: 7, user: 'Wm1X···bGv7', score: 65_430, accuracy: 68.2, markets: 18 },
  { rank: 8, user: 'Zv4C···xTn2', score: 54_120, accuracy: 65.8, markets: 15 },
  { rank: 9, user: 'Dp6S···aUq9', score: 48_750, accuracy: 63.1, markets: 14 },
  { rank: 10, user: 'Fj3R···eYh5', score: 42_300, accuracy: 60.4, markets: 12 },
]

const TOP_3 = LEADERBOARD_DATA.slice(0, 3)
const REST = LEADERBOARD_DATA.slice(3)

const ROW_GRID = cn(
  'grid items-center gap-4 px-4',
  'grid-cols-[48px_140px_120px_100px_1fr]',
)

const NUM_CELL =
  'text-right whitespace-nowrap font-mono text-xs uppercase tracking-[0.08em] text-ink'

const PODIUM_HEIGHTS = ['h-[140px]', 'h-[100px]', 'h-[72px]']
const PODIUM_ORDER = [1, 0, 2]

export function LeaderboardPage() {
  return (
    <PageLayout
      title="Leaderboard"
      subtitle="Season 1 rankings"
      summaryBar={
        <div className="border-line flex items-center gap-12 border-0 border-b pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
              Total Participants
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {LEADERBOARD_DATA.length.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
              Top Score
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {formatUSD(LEADERBOARD_DATA[0].score)}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono tracking-[0.1em] uppercase">
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
      <div className="mb-12 flex items-end justify-center gap-6">
        {PODIUM_ORDER.map((i) => {
          const entry = TOP_3[i]
          const rankLabel = entry.rank === 1 ? '1st' : entry.rank === 2 ? '2nd' : '3rd'
          return (
            <div
              key={entry.rank}
              className="flex w-[180px] flex-col items-center"
            >
              <div className="text-ink-muted mb-3 font-mono text-[10px] tracking-[0.1em] uppercase">
                {rankLabel}
              </div>
              <div className="text-ink-strong mb-2 font-mono text-sm font-bold tracking-[0.08em]">
                {entry.user}
              </div>
              <div className="text-ink-muted mb-6 font-mono text-xs tracking-[0.05em]">
                {formatUSD(entry.score)}
              </div>
              <div
                className={cn(
                  'w-full rounded-t-sm bg-ink-strong/5',
                  PODIUM_HEIGHTS[i],
                  'flex items-end justify-center pb-4',
                )}
              >
                <span className="text-ink-dim font-mono text-lg font-bold tracking-[0.05em]">
                  {entry.rank}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Rest of the list */}
      {REST.length > 0 && (
        <div className="flex flex-col">
          {/* Header Row */}
          <div
            className={cn(
              ROW_GRID,
              'border-line-strong h-10 border-0 border-b',
              'text-ink-dim font-mono text-[10px] tracking-[0.12em] uppercase',
            )}
          >
            <span>RANK</span>
            <span>USER</span>
            <span className="text-right">SCORE</span>
            <span className="text-right">ACCURACY</span>
            <span className="text-right">MARKETS</span>
          </div>

          {/* Rows */}
          {REST.map((entry) => (
            <div
              key={entry.rank}
              className={cn(
                ROW_GRID,
                'group border-line h-[56px] border-0 border-b border-l-2 border-l-transparent',
                'duration-short ease-levx transition-[background,border-left-color]',
                'hover:border-l-ink-strong hover:bg-white/[0.02]',
              )}
            >
              <span className="text-ink-dim font-mono text-sm tracking-[0.05em]">
                #{entry.rank}
              </span>
              <span className="text-ink-strong font-mono text-sm font-bold tracking-[0.08em]">
                {entry.user}
              </span>
              <span className={NUM_CELL}>{formatUSD(entry.score)}</span>
              <span className={NUM_CELL}>{entry.accuracy.toFixed(1)}%</span>
              <span className={NUM_CELL}>{entry.markets}</span>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
