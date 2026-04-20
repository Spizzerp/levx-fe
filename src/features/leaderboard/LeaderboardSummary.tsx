import { formatUSD } from '@/lib/format'

import type { LeaderboardEntry } from './data'

export function LeaderboardSummary({ data }: { data: LeaderboardEntry[] }) {
  const avgAccuracy =
    data.length === 0
      ? 0
      : data.reduce((s, e) => s + e.accuracy, 0) / data.length

  return (
    <div className="border-line flex items-center gap-12 border-0 border-b pb-8">
      <SummaryStat label="Total Participants" value={data.length.toLocaleString()} />
      <SummaryStat label="Top Score" value={formatUSD(data[0]?.score ?? 0)} />
      <SummaryStat label="Avg Accuracy" value={`${avgAccuracy.toFixed(1)}%`} />
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-label text-ink-muted mb-2 font-mono uppercase">{label}</div>
      <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
        {value}
      </div>
    </div>
  )
}
