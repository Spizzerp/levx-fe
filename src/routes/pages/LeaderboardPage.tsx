import { LEADERBOARD_DATA } from '@/features/leaderboard/data'
import { LeaderboardSummary } from '@/features/leaderboard/LeaderboardSummary'
import { LeaderboardTable } from '@/features/leaderboard/LeaderboardTable'
import { Podium } from '@/features/leaderboard/Podium'
import { PageLayout } from '@/layouts/PageLayout'

export function LeaderboardPage() {
  const top3 = LEADERBOARD_DATA.slice(0, 3)
  const rest = LEADERBOARD_DATA.slice(3)

  return (
    <PageLayout
      title="Leaderboard"
      subtitle="Season 1 rankings"
      summaryBar={<LeaderboardSummary data={LEADERBOARD_DATA} />}
    >
      <Podium entries={top3} />
      <LeaderboardTable entries={rest} />
    </PageLayout>
  )
}
