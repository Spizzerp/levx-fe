import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Trophy } from 'lucide-react'

import {
  EmptyPanel,
  MetricPanel,
  ProviderGatewayError,
  ProviderGatewayLoading,
  StatusPill,
  WindowControls,
} from '@/features/providerGateway/ProviderGatewayPanels'
import {
  formatDateTime,
  formatPercent,
  formatScore,
  providerLabel,
  shortId,
} from '@/features/providerGateway/format'
import { useProviderGatewayProviders, useProviderLeaderboard } from '@/features/providerGateway/api'
import type { ProviderRecord } from '@/features/providerGateway/types'
import { PageLayout } from '@/layouts/PageLayout'
import { ChartFrame } from '@/features/chart/ChartFrame'

export function ProviderGatewayLeaderboardPage() {
  const navigate = useNavigate()
  const [windowDays, setWindowDays] = useState(30)
  const [selectedOnly, setSelectedOnly] = useState(false)
  const providersQuery = useProviderGatewayProviders()
  const leaderboardQuery = useProviderLeaderboard({ windowDays, selectedOnly })

  const providerById = useMemo(() => {
    return new Map(
      (providersQuery.data?.providers ?? []).map((provider) => [provider.provider_id, provider]),
    )
  }, [providersQuery.data?.providers])

  const entries = leaderboardQuery.data?.leaderboard ?? []
  const topProvider = entries[0]
  const totalSelected = entries.reduce((sum, entry) => sum + entry.paths_selected, 0)
  const avgScore =
    entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.avg_composite_score, 0) / entries.length
      : null

  const isLoading = providersQuery.isLoading || leaderboardQuery.isLoading
  const isError = providersQuery.isError || leaderboardQuery.isError

  return (
    <PageLayout
      title="Providers"
      subtitle="External model reputation"
      headerActions={
        <WindowControls
          windowDays={windowDays}
          selectedOnly={selectedOnly}
          onWindowDaysChange={setWindowDays}
          onSelectedOnlyChange={setSelectedOnly}
        />
      }
      summaryBar={
        <div className="grid gap-3 md:grid-cols-4">
          <MetricPanel label="Providers" value={entries.length} />
          <MetricPanel label="Selected paths" value={totalSelected} />
          <MetricPanel label="Avg score" value={formatScore(avgScore)} />
          <MetricPanel
            label="Leader"
            value={topProvider ? providerLabel(topProvider.provider_id, providerById) : '-'}
          />
        </div>
      }
    >
      {isLoading ? (
        <ProviderGatewayLoading />
      ) : isError ? (
        <ProviderGatewayError
          onRetry={() => {
            void providersQuery.refetch()
            void leaderboardQuery.refetch()
          }}
        />
      ) : entries.length === 0 ? (
        <EmptyPanel
          icon={<Trophy size={20} strokeWidth={1.75} aria-hidden />}
          title="No scored providers"
          body="Provider reputation appears after an Orthogonal Precision run records score snapshots."
        />
      ) : (
        <ProviderReputationTable
          entries={entries}
          providerById={providerById}
          onOpenProvider={(providerId) =>
            void navigate({ to: '/providers/$providerId', params: { providerId } })
          }
        />
      )}
    </PageLayout>
  )
}

function ProviderReputationTable({
  entries,
  providerById,
  onOpenProvider,
}: {
  entries: Array<{
    provider_id: string
    paths_valid: number
    paths_selected: number
    avg_composite_score: number
    selection_rate: number
    orthogonal_contribution: number
    updated_at: string
  }>
  providerById: Map<string, ProviderRecord>
  onOpenProvider: (providerId: string) => void
}) {
  return (
    <ChartFrame>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="border-line-strong bg-surface-1 border-b">
            <tr className="text-label text-ink-dim font-mono uppercase">
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Rank
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                Provider
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Valid
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Selected
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Score
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                OP lift
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={entry.provider_id} className="border-line border-b last:border-b-0">
                <td className="px-4 py-4">
                  <StatusPill tone={index < 3 ? 'success' : 'default'}>#{index + 1}</StatusPill>
                </td>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onOpenProvider(entry.provider_id)}
                    className="text-ink-strong duration-short ease-levx hover:text-ink focus-visible:ring-ink-strong text-left font-mono text-sm font-bold tracking-normal transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {providerLabel(entry.provider_id, providerById)}
                  </button>
                  <p className="text-label text-ink-dim mt-1 font-mono uppercase">
                    {shortId(entry.provider_id)}
                  </p>
                </td>
                <td className="text-ink px-4 py-4 text-right font-mono text-sm">
                  {entry.paths_valid}
                </td>
                <td className="text-ink px-4 py-4 text-right font-mono text-sm">
                  {entry.paths_selected} / {formatPercent(entry.selection_rate)}
                </td>
                <td className="text-ink px-4 py-4 text-right font-mono text-sm">
                  {formatScore(entry.avg_composite_score)}
                </td>
                <td className="text-ink px-4 py-4 text-right font-mono text-sm">
                  {formatScore(entry.orthogonal_contribution)}
                </td>
                <td className="text-label text-ink-dim px-4 py-4 text-right font-mono uppercase">
                  {formatDateTime(entry.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  )
}
