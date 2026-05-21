import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'

import type {
  OpenProviderMarketsResponse,
  PipelineStatus,
  ProviderLeaderboardResponse,
  ProviderResultsResponse,
  ProvidersResponse,
} from './types'

const PROVIDER_GATEWAY_STALE_MS = 15_000

export const providerGatewayKeys = {
  status: ['providerGateway', 'status'] as const,
  providers: ['providerGateway', 'providers'] as const,
  openMarkets: ['providerGateway', 'openMarkets'] as const,
  leaderboard: (windowDays: number, selectedOnly: boolean) =>
    ['providerGateway', 'leaderboard', windowDays, selectedOnly] as const,
  providerResults: (providerId: string | undefined) =>
    ['providerGateway', 'providerResults', providerId] as const,
}

export function useProviderGatewayStatus() {
  return useQuery({
    queryKey: providerGatewayKeys.status,
    queryFn: () => apiFetch<PipelineStatus>('/api/v1/status'),
    staleTime: PROVIDER_GATEWAY_STALE_MS,
    refetchInterval: 60_000,
  })
}

export function useProviderGatewayProviders() {
  return useQuery({
    queryKey: providerGatewayKeys.providers,
    queryFn: () => apiFetch<ProvidersResponse>('/api/v1/providers'),
    staleTime: PROVIDER_GATEWAY_STALE_MS,
    refetchInterval: 60_000,
  })
}

export function useOpenProviderMarkets() {
  return useQuery({
    queryKey: providerGatewayKeys.openMarkets,
    queryFn: () => apiFetch<OpenProviderMarketsResponse>('/api/v1/provider-markets/open'),
    staleTime: PROVIDER_GATEWAY_STALE_MS,
    refetchInterval: 30_000,
  })
}

export function useProviderLeaderboard({
  windowDays,
  selectedOnly,
}: {
  windowDays: number
  selectedOnly: boolean
}) {
  const params = new URLSearchParams({
    window_days: String(windowDays),
    selected_only: String(selectedOnly),
  })

  return useQuery({
    queryKey: providerGatewayKeys.leaderboard(windowDays, selectedOnly),
    queryFn: () => apiFetch<ProviderLeaderboardResponse>(`/api/v1/providers/leaderboard?${params}`),
    staleTime: PROVIDER_GATEWAY_STALE_MS,
    refetchInterval: 60_000,
  })
}

export function useProviderResults(providerId: string | undefined) {
  return useQuery({
    queryKey: providerGatewayKeys.providerResults(providerId),
    queryFn: () => apiFetch<ProviderResultsResponse>(`/api/v1/providers/${providerId}/results`),
    enabled: Boolean(providerId),
    staleTime: PROVIDER_GATEWAY_STALE_MS,
    refetchInterval: 60_000,
  })
}
