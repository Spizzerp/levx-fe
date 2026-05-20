import type { ReactNode } from 'react'
import { Activity, BarChart3, CheckCircle2, Clock, Database, ServerCrash } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { ChartFrame } from '@/features/chart/ChartFrame'
import { Label } from '@/ui/Label'
import { QueryErrorState } from '@/ui/QueryErrorState'
import { Skeleton } from '@/ui/Skeleton'

import { formatDateTime, formatPercent, formatScore, providerLabel, shortId } from './format'
import type {
  OpenProviderMarketsResponse,
  PipelineStatus,
  ProviderAttribution,
  ProviderRecord,
  ProviderResultsResponse,
  ReputationSnapshot,
} from './types'

export function MetricPanel({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <div className="border-line bg-surface-1 rounded-lg border px-4 py-3">
      <p className="text-label text-ink-dim font-mono uppercase">{label}</p>
      <p
        className={cn(
          'mt-2 font-mono text-2xl font-bold tracking-normal',
          tone === 'success'
            ? 'text-success'
            : tone === 'warning'
              ? 'text-warning'
              : 'text-ink-strong',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function StatusPill({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-full border px-2.5',
        'text-label font-mono tracking-wide uppercase',
        tone === 'success' && 'border-success/30 text-success',
        tone === 'warning' && 'border-warning/40 text-warning',
        tone === 'danger' && 'border-accent/40 text-accent',
        tone === 'default' && 'border-line-strong text-ink-muted',
      )}
    >
      {children}
    </span>
  )
}

function providerStatusTone(status: string): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'curated') return 'success'
  if (status === 'sandbox') return 'warning'
  if (status === 'suspended') return 'danger'
  return 'default'
}

export function ProviderGatewayLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-lg" />
      ))}
    </div>
  )
}

export function ProviderGatewayError({
  onRetry,
  message = 'Provider Gateway data is unavailable.',
}: {
  onRetry: () => void
  message?: string
}) {
  return (
    <QueryErrorState title="Could not load Provider Gateway" message={message} onRetry={onRetry} />
  )
}

export function GatewayHealthPanel({ status }: { status: PipelineStatus | undefined }) {
  const gateway = status?.provider_gateway
  const ready = Boolean(gateway?.external_provider_ready)

  return (
    <ChartFrame className="p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
        <MetricPanel
          label="Gateway"
          value={ready ? 'Ready' : gateway?.enabled ? 'Limited' : 'Off'}
          tone={ready ? 'success' : 'warning'}
        />
        <MetricPanel label="Backend" value={gateway?.storage_backend ?? '-'} />
        <MetricPanel
          label="Rate limit"
          value={`${gateway?.forecast_rate_limit_per_minute ?? '-'} / min`}
        />
        <div className="border-line bg-surface-1 rounded-lg border px-4 py-3">
          <div className="flex items-center gap-2">
            {ready ? (
              <CheckCircle2 size={16} strokeWidth={1.75} className="text-success" aria-hidden />
            ) : (
              <ServerCrash size={16} strokeWidth={1.75} className="text-warning" aria-hidden />
            )}
            <p className="text-label text-ink-dim font-mono uppercase">Runtime</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill tone={status?.scheduler_running ? 'success' : 'warning'}>
              Scheduler {status?.scheduler_running ? 'on' : 'off'}
            </StatusPill>
            <StatusPill tone={status?.dry_run_submission ? 'warning' : 'success'}>
              {status?.dry_run_submission ? 'Dry run' : 'Live submit'}
            </StatusPill>
            {gateway?.artifact_bucket && <StatusPill>Bucket {gateway.artifact_bucket}</StatusPill>}
          </div>
        </div>
      </div>
    </ChartFrame>
  )
}

export function ProviderTable({
  providers,
  snapshots,
  providerById,
  selectedProviderId,
  onSelectProvider,
}: {
  providers: ProviderRecord[]
  snapshots: ReputationSnapshot[]
  providerById: Map<string, ProviderRecord>
  selectedProviderId?: string
  onSelectProvider?: (providerId: string) => void
}) {
  const snapshotByProvider = new Map(snapshots.map((snapshot) => [snapshot.provider_id, snapshot]))

  if (providers.length === 0) {
    return (
      <EmptyPanel
        icon={<Database size={20} strokeWidth={1.75} aria-hidden />}
        title="No providers"
        body="Registered providers will appear here after the first gateway onboarding."
      />
    )
  }

  return (
    <div className="border-line overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="border-line-strong bg-surface-1 border-b">
          <tr className="text-label text-ink-dim font-mono uppercase">
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Provider
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Valid
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Selected
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Avg score
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => {
            const snapshot = snapshotByProvider.get(provider.provider_id)
            const selected = selectedProviderId === provider.provider_id
            return (
              <tr
                key={provider.provider_id}
                className={cn(
                  'border-line border-b last:border-b-0',
                  selected && 'bg-white/[0.03]',
                )}
              >
                <td className="px-4 py-4">
                  {onSelectProvider ? (
                    <button
                      type="button"
                      onClick={() => onSelectProvider(provider.provider_id)}
                      className={cn(
                        'text-ink-strong text-left font-mono text-sm font-bold tracking-normal',
                        'duration-short ease-levx hover:text-ink transition-colors',
                        'focus-visible:ring-ink-strong focus-visible:ring-2 focus-visible:outline-none',
                      )}
                    >
                      {providerLabel(provider.provider_id, providerById)}
                    </button>
                  ) : (
                    <span className="text-ink-strong font-mono text-sm font-bold tracking-normal">
                      {providerLabel(provider.provider_id, providerById)}
                    </span>
                  )}
                  <p className="text-label text-ink-dim mt-1 font-mono uppercase">
                    {shortId(provider.provider_id)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <StatusPill tone={providerStatusTone(provider.status)}>
                    {provider.status}
                  </StatusPill>
                </td>
                <td className="text-ink px-4 py-4 text-right font-mono text-sm">
                  {snapshot?.paths_valid ?? 0}
                </td>
                <td className="text-ink px-4 py-4 text-right font-mono text-sm">
                  {snapshot?.paths_selected ?? 0}
                </td>
                <td className="text-ink px-4 py-4 text-right font-mono text-sm">
                  {formatScore(snapshot?.avg_composite_score)}
                </td>
                <td className="text-label text-ink-dim px-4 py-4 text-right font-mono uppercase">
                  {formatDateTime(snapshot?.updated_at ?? provider.updated_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ProviderResultsPanel({
  provider,
  results,
}: {
  provider: ProviderRecord | undefined
  results: ProviderResultsResponse | undefined
}) {
  if (!provider || !results) {
    return (
      <EmptyPanel
        icon={<Activity size={20} strokeWidth={1.75} aria-hidden />}
        title="Select a provider"
        body="Choose a provider to inspect attribution and scoring history."
      />
    )
  }

  const latest = results.reputation_snapshots.at(-1)
  const recentScores = results.results
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6)
  const recentSelections = results.selected_paths
    .toSorted((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, 6)

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <ChartFrame className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label>Provider</Label>
            <h2 className="text-ink-strong mt-2 font-mono text-2xl font-bold tracking-normal">
              {provider.display_name}
            </h2>
            <p className="text-label text-ink-dim mt-1 font-mono uppercase">
              {provider.provider_type} / {shortId(provider.provider_id)}
            </p>
          </div>
          <StatusPill tone={providerStatusTone(provider.status)}>{provider.status}</StatusPill>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <MetricPanel label="Valid paths" value={latest?.paths_valid ?? 0} />
          <MetricPanel
            label="Selected"
            value={latest?.paths_selected ?? results.selected_paths.length}
          />
          <MetricPanel label="Avg score" value={formatScore(latest?.avg_composite_score)} />
          <MetricPanel label="Selection" value={formatPercent(latest?.selection_rate)} />
        </div>
      </ChartFrame>

      <ChartFrame className="p-5">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} strokeWidth={1.75} className="text-ink-muted" aria-hidden />
          <Label>Recent OP scores</Label>
        </div>
        {recentScores.length === 0 ? (
          <p className="text-label text-ink-dim mt-6 font-mono uppercase">No score runs yet</p>
        ) : (
          <div className="mt-4 space-y-3">
            {recentScores.map((score) => (
              <CompactScoreRow key={score.score_id} score={score} />
            ))}
          </div>
        )}
      </ChartFrame>

      <ChartFrame className="p-5 xl:col-span-2">
        <div className="flex items-center gap-2">
          <Clock size={16} strokeWidth={1.75} className="text-ink-muted" aria-hidden />
          <Label>Selected path attribution</Label>
        </div>
        {recentSelections.length === 0 ? (
          <p className="text-label text-ink-dim mt-6 font-mono uppercase">
            No selected provider paths yet
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recentSelections.map((path) => (
              <AttributionCard
                key={`${path.selection_run_id}-${path.provider_path_hash}`}
                path={path}
              />
            ))}
          </div>
        )}
      </ChartFrame>
    </div>
  )
}

export function OpenProviderMarketsPanel({
  data,
}: {
  data: OpenProviderMarketsResponse | undefined
}) {
  const markets = data?.markets ?? []

  return (
    <ChartFrame className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>Open provider markets</Label>
          <p className="text-label text-ink-dim mt-2 font-mono uppercase">
            {markets.length} intake windows
          </p>
        </div>
      </div>
      {markets.length === 0 ? (
        <p className="text-label text-ink-dim mt-6 font-mono uppercase">
          No open provider intake windows
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {markets.slice(0, 5).map((market) => (
            <div
              key={market.market_id}
              className="border-line grid grid-cols-[1fr_auto] gap-4 rounded-lg border px-4 py-3"
            >
              <div>
                <p className="text-ink-strong font-mono text-sm font-bold">
                  {market.pair} / Market {market.market_id}
                </p>
                <p className="text-label text-ink-dim mt-1 font-mono uppercase">
                  {market.season?.horizon ?? market.season_key}
                </p>
              </div>
              <p className="text-label text-ink-muted text-right font-mono uppercase">
                Deadline
                <br />
                {formatDateTime(market.submission_deadline)}
              </p>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  )
}

export function EmptyPanel({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="border-line flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
      <div className="border-line-strong text-ink-muted flex size-10 items-center justify-center rounded-full border">
        {icon}
      </div>
      <p className="text-ink-strong font-mono text-sm font-bold uppercase">{title}</p>
      <p className="text-label text-ink-dim max-w-md font-mono uppercase">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function WindowControls({
  windowDays,
  selectedOnly,
  onWindowDaysChange,
  onSelectedOnlyChange,
}: {
  windowDays: number
  selectedOnly: boolean
  onWindowDaysChange: (value: number) => void
  onSelectedOnlyChange: (value: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="border-line-strong flex rounded-full border p-1">
        {[30, 90, 365].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onWindowDaysChange(days)}
            className={cn(
              'text-label min-h-9 rounded-full px-4 font-mono tracking-wide uppercase',
              'duration-short ease-levx transition-colors',
              'focus-visible:ring-ink-strong focus-visible:ring-2 focus-visible:outline-none',
              windowDays === days
                ? 'bg-ink-strong text-surface'
                : 'text-ink-muted hover:text-ink-strong',
            )}
          >
            {days}d
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant={selectedOnly ? 'primary' : 'secondary'}
        className="min-h-10 px-4 py-2"
        onClick={() => onSelectedOnlyChange(!selectedOnly)}
      >
        Selected only
      </Button>
    </div>
  )
}

function CompactScoreRow({
  score,
}: {
  score: {
    score_id: string
    market_id: number
    selected: boolean
    composite_score: number
    orthogonal_contribution: number
    created_at: string
  }
}) {
  return (
    <div className="border-line grid grid-cols-[1fr_auto] gap-4 rounded-lg border px-4 py-3">
      <div>
        <p className="text-ink-strong font-mono text-sm">Market {score.market_id}</p>
        <p className="text-label text-ink-dim mt-1 font-mono uppercase">
          {formatDateTime(score.created_at)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-ink-strong font-mono text-sm">{formatScore(score.composite_score)}</p>
        <p className="text-label text-ink-dim mt-1 font-mono uppercase">
          OP {formatScore(score.orthogonal_contribution)}
        </p>
      </div>
      {score.selected && <StatusPill tone="success">Selected</StatusPill>}
    </div>
  )
}

function AttributionCard({ path }: { path: ProviderAttribution }) {
  return (
    <div className="border-line rounded-lg border px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-ink-strong font-mono text-sm font-bold">Market {path.market_id}</p>
          <p className="text-label text-ink-dim mt-1 font-mono uppercase">
            {shortId(path.selection_run_id)}
          </p>
        </div>
        <StatusPill tone={path.submission_status === 'submitted' ? 'success' : 'warning'}>
          {path.submission_status}
        </StatusPill>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricPanel label="Menu index" value={path.menu_path_index} />
        <MetricPanel label="On-chain" value={path.onchain_path_index} />
      </div>
      {path.tx_signature && (
        <p className="text-label text-ink-dim mt-3 font-mono break-all uppercase">
          {shortId(path.tx_signature, 12, 10)}
        </p>
      )}
    </div>
  )
}
