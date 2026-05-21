import { useMemo, useState } from 'react'
import { ShieldAlert } from 'lucide-react'

import {
  EmptyPanel,
  GatewayHealthPanel,
  OpenProviderMarketsPanel,
  ProviderGatewayError,
  ProviderGatewayLoading,
  ProviderResultsPanel,
  ProviderTable,
} from '@/features/providerGateway/ProviderGatewayPanels'
import {
  useOpenProviderMarkets,
  useProviderGatewayProviders,
  useProviderGatewayStatus,
  useProviderLeaderboard,
  useProviderResults,
} from '@/features/providerGateway/api'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { PageLayout } from '@/layouts/PageLayout'

export function ProviderGatewayAdminPage() {
  const isAdmin = useIsAdmin()

  if (!isAdmin) {
    return (
      <PageLayout title="Provider Ops" subtitle="Admin access required">
        <EmptyPanel
          icon={<ShieldAlert size={20} strokeWidth={1.75} aria-hidden />}
          title="Admin wallet required"
          body="Connect a configured admin wallet to view Provider Gateway operations."
        />
      </PageLayout>
    )
  }

  return <ProviderGatewayAdminContent />
}

function ProviderGatewayAdminContent() {
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>()
  const statusQuery = useProviderGatewayStatus()
  const providersQuery = useProviderGatewayProviders()
  const leaderboardQuery = useProviderLeaderboard({ windowDays: 30, selectedOnly: false })
  const marketsQuery = useOpenProviderMarkets()

  const providers = useMemo(
    () => providersQuery.data?.providers ?? [],
    [providersQuery.data?.providers],
  )
  const providerById = useMemo(() => {
    return new Map(providers.map((provider) => [provider.provider_id, provider]))
  }, [providers])
  const activeProviderId = selectedProviderId ?? providers[0]?.provider_id
  const selectedProvider = activeProviderId ? providerById.get(activeProviderId) : undefined
  const resultsQuery = useProviderResults(activeProviderId)

  const isLoading =
    statusQuery.isLoading ||
    providersQuery.isLoading ||
    leaderboardQuery.isLoading ||
    marketsQuery.isLoading
  const isError =
    statusQuery.isError ||
    providersQuery.isError ||
    leaderboardQuery.isError ||
    marketsQuery.isError

  return (
    <PageLayout title="Provider Ops" subtitle="Gateway operations">
      {isLoading ? (
        <ProviderGatewayLoading />
      ) : isError ? (
        <ProviderGatewayError
          onRetry={() => {
            void statusQuery.refetch()
            void providersQuery.refetch()
            void leaderboardQuery.refetch()
            void marketsQuery.refetch()
          }}
        />
      ) : (
        <div className="space-y-6">
          <GatewayHealthPanel status={statusQuery.data} />
          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <ProviderTable
              providers={providers}
              snapshots={leaderboardQuery.data?.leaderboard ?? []}
              providerById={providerById}
              selectedProviderId={activeProviderId}
              onSelectProvider={setSelectedProviderId}
            />
            <OpenProviderMarketsPanel data={marketsQuery.data} />
          </div>
          {resultsQuery.isError ? (
            <ProviderGatewayError
              message="Provider details are unavailable."
              onRetry={() => void resultsQuery.refetch()}
            />
          ) : resultsQuery.isLoading ? (
            <ProviderGatewayLoading />
          ) : (
            <ProviderResultsPanel provider={selectedProvider} results={resultsQuery.data} />
          )}
        </div>
      )}
    </PageLayout>
  )
}
