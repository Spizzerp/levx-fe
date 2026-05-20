import { useMemo } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Activity } from 'lucide-react'

import {
  EmptyPanel,
  ProviderGatewayError,
  ProviderGatewayLoading,
  ProviderResultsPanel,
} from '@/features/providerGateway/ProviderGatewayPanels'
import { useProviderGatewayProviders, useProviderResults } from '@/features/providerGateway/api'
import { PageLayout } from '@/layouts/PageLayout'

export function ProviderGatewayProviderPage() {
  const { providerId } = useParams({ from: '/providers/$providerId' })
  const providersQuery = useProviderGatewayProviders()
  const resultsQuery = useProviderResults(providerId)

  const provider = useMemo(() => {
    return providersQuery.data?.providers.find((item) => item.provider_id === providerId)
  }, [providerId, providersQuery.data?.providers])

  const isLoading = providersQuery.isLoading || resultsQuery.isLoading
  const isError = providersQuery.isError || resultsQuery.isError

  return (
    <PageLayout
      title={provider?.display_name ?? 'Provider'}
      subtitle={providerId}
      headerActions={
        <Link
          to="/providers"
          className="border-line-strong text-label text-ink-muted duration-short ease-levx hover:text-ink-strong focus-visible:ring-ink-strong inline-flex min-h-10 items-center rounded-full border px-4 font-mono uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft size={14} strokeWidth={1.75} className="mr-2" aria-hidden />
          Back to providers
        </Link>
      }
    >
      {isLoading ? (
        <ProviderGatewayLoading />
      ) : isError ? (
        <ProviderGatewayError
          onRetry={() => {
            void providersQuery.refetch()
            void resultsQuery.refetch()
          }}
        />
      ) : !provider || !resultsQuery.data ? (
        <EmptyPanel
          icon={<Activity size={20} strokeWidth={1.75} aria-hidden />}
          title="Provider not found"
          body="This provider does not exist or has not published public results."
        />
      ) : (
        <ProviderResultsPanel provider={provider} results={resultsQuery.data} />
      )}
    </PageLayout>
  )
}
