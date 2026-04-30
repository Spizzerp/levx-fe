import { LeaderboardSummary } from '@/features/leaderboard/LeaderboardSummary'
import { LeaderboardTable } from '@/features/leaderboard/LeaderboardTable'
import { Podium } from '@/features/leaderboard/Podium'
import { useLeaderboard } from '@/features/leaderboard/useLeaderboard'
import { PageLayout } from '@/layouts/PageLayout'

export function LeaderboardPage() {
  const { data, isLoading } = useLeaderboard()
  const entries = data ?? []
  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <PageLayout
      title="Leaderboard"
      subtitle="Season 1 rankings"
      summaryBar={<LeaderboardSummary data={entries} />}
    >
      {isLoading && entries.length === 0 ? (
        <div className="border-line text-ink-dim flex items-center justify-center border border-dashed py-24 font-mono text-caption uppercase">
          [ Loading leaderboard… ]
        </div>
      ) : entries.length === 0 ? (
        <div className="border-line text-ink-dim flex items-center justify-center border border-dashed py-24 font-mono text-caption uppercase">
          [ No settled positions yet ]
        </div>
      ) : (
        <>
          <Podium entries={top3} />
          <LeaderboardTable entries={rest} />
        </>
      )}
    </PageLayout>
  )
}
