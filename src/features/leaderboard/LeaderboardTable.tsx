import { ChartFrame } from '@/features/chart/ChartFrame'
import { formatUSD } from '@/lib/format'
import { DataTable, NUM_CELL, type DataTableColumn } from '@/ui/DataTable'
import { SIGILS } from '@/ui/Sigils'

import type { LeaderboardEntry } from './data'

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
    render: (entry) => {
      const Sigil = SIGILS[entry.avatarIdx] ?? SIGILS[0]
      return (
        <span className="flex items-center gap-3">
          <span className="border-line-strong bg-surface-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
            <Sigil size={18} tone="strong" />
          </span>
          <span>{entry.user}</span>
        </span>
      )
    },
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

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null
  return (
    <ChartFrame glow>
      <DataTable
        columns={COLUMNS}
        data={entries}
        gridCols="grid-cols-[48px_180px_120px_100px_1fr]"
        rowHeight="h-[56px]"
        keyExtractor={(entry) => entry.rank}
      />
    </ChartFrame>
  )
}
