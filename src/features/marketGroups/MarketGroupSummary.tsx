import type { ReactNode } from 'react'
import { Activity, Clock3, Layers, ShieldCheck, Users, Wallet } from 'lucide-react'

import { ChartFrame } from '@/features/chart/ChartFrame'
import type { MarketGroupSummary as MarketGroupSummaryModel } from '@/features/marketGroups/groupPresentation'
import { cn } from '@/lib/cn'
import { formatCountdown, formatUSD } from '@/lib/format'

type MarketGroupSummaryProps = {
  summary: MarketGroupSummaryModel
  now: number
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className={cn('flex min-h-20 items-center gap-3 border p-4', 'border-line bg-surface/40')}>
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

function statusLabel(status: MarketGroupSummaryModel['status']): string {
  if (status === 'active') return 'Active'
  if (status === 'paused') return 'Paused'
  if (status === 'retired') return 'Retired'
  return 'Indexed'
}

export function MarketGroupSummary({ summary, now }: MarketGroupSummaryProps) {
  const endsIn =
    summary.endTime == null
      ? 'Open-ended'
      : summary.endTime > now
        ? formatCountdown(summary.endTime - now)
        : 'Ended'

  return (
    <ChartFrame glow className="p-5">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-label text-ink-dim font-mono uppercase">Market group</p>
          <h2 className="text-ink-strong font-display text-3xl leading-tight font-bold">
            {summary.label}
          </h2>
          <p className="text-ink-muted mt-1 font-mono text-xs uppercase">{summary.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-label inline-flex h-8 items-center gap-2 rounded-full border px-3',
              'border-line-strong text-ink-muted font-mono uppercase',
            )}
          >
            <ShieldCheck size={13} strokeWidth={1.5} aria-hidden />
            {statusLabel(summary.status)}
          </span>
          <span
            className={cn(
              'text-label inline-flex h-8 items-center rounded-full border px-3',
              'border-line-strong text-ink-dim font-mono uppercase',
            )}
          >
            {summary.shortHash}
          </span>
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
          label="Pool"
          value={`${formatUSD(summary.totalPool)} USDC`}
          icon={<Wallet size={18} strokeWidth={1.5} />}
        />
        <Metric
          label="Traders"
          value={summary.totalTraders.toLocaleString()}
          icon={<Users size={18} strokeWidth={1.5} />}
        />
        <Metric label="Window" value={endsIn} icon={<Clock3 size={18} strokeWidth={1.5} />} />
      </div>

      <div className="border-line mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4">
        {summary.primaryPair && (
          <span className="text-label text-ink-dim font-mono uppercase">
            Pair <span className="text-ink-muted">{summary.primaryPair}</span>
          </span>
        )}
        {summary.productSeason && (
          <span className="text-label text-ink-dim font-mono uppercase">
            Season <span className="text-ink-muted">{summary.productSeason}</span>
          </span>
        )}
        {summary.horizonLabel && (
          <span className="text-label text-ink-dim font-mono uppercase">
            Horizon <span className="text-ink-muted">{summary.horizonLabel}</span>
          </span>
        )}
        {!summary.horizonLabel && summary.timeframeLabel && (
          <span className="text-label text-ink-dim font-mono uppercase">
            Timeframe <span className="text-ink-muted">{summary.timeframeLabel}</span>
          </span>
        )}
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
