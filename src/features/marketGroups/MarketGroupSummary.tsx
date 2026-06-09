import type { ReactNode } from 'react'
import { Activity, Clock3, Layers, Users } from 'lucide-react'

import { ChartFrame } from '@/features/chart/ChartFrame'
import type { MarketGroupSummary as MarketGroupSummaryModel } from '@/features/marketGroups/groupPresentation'
import { formatCountdown, formatUSD } from '@/lib/format'

type MarketGroupSummaryProps = {
  summary: MarketGroupSummaryModel
  now: number
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="border-line bg-surface/40 flex min-h-20 items-center gap-3 border p-4">
      <span className="text-ink-dim" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-label text-ink-dim font-mono uppercase">{label}</div>
        <div className="text-ink-strong truncate font-mono text-xl font-bold">{value}</div>
      </div>
    </div>
  )
}

export function MarketGroupSummary({ summary, now }: MarketGroupSummaryProps) {
  const endsIn =
    summary.endTime && summary.endTime > now ? formatCountdown(summary.endTime - now) : 'Open-ended'

  return (
    <ChartFrame glow className="p-5">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-label text-ink-dim font-mono uppercase">Market group</p>
          <h2 className="text-ink-strong font-display text-3xl leading-tight font-bold">
            {summary.label}
          </h2>
          <p className="text-ink-muted mt-1 font-mono text-xs uppercase">
            {summary.totalMarkets} child {summary.totalMarkets === 1 ? 'market' : 'markets'}
          </p>
        </div>
        <div className="text-ink-muted font-mono text-xs uppercase">
          {summary.groupKeyHash.slice(0, 8)}...{summary.groupKeyHash.slice(-6)}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Child markets"
          value={summary.totalMarkets}
          icon={<Layers size={18} strokeWidth={1.5} />}
        />
        <Metric
          label="Active"
          value={summary.activeMarkets}
          icon={<Activity size={18} strokeWidth={1.5} />}
        />
        <Metric
          label="Traders"
          value={summary.totalTraders.toLocaleString()}
          icon={<Users size={18} strokeWidth={1.5} />}
        />
        <Metric label="Window" value={endsIn} icon={<Clock3 size={18} strokeWidth={1.5} />} />
      </div>

      <div className="border-line mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4">
        <span className="text-label text-ink-dim font-mono uppercase">
          Pool <span className="text-ink-muted">{formatUSD(summary.totalPool)}</span>
        </span>
        <span className="text-label text-ink-dim font-mono uppercase">
          Pending <span className="text-ink-muted">{summary.pendingMarkets}</span>
        </span>
        <span className="text-label text-ink-dim font-mono uppercase">
          Settled <span className="text-ink-muted">{summary.settledMarkets}</span>
        </span>
      </div>
    </ChartFrame>
  )
}
