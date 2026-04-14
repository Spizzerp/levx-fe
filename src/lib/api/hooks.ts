import { useQuery } from '@tanstack/react-query'

import * as mock from '@/lib/api/mock'
import * as onchain from '@/lib/api/onchain'

/**
 * When true, all data hooks use the mock layer instead of on-chain RPC.
 * Set APP_USE_MOCK=true in your .env to enable during development.
 */
const USE_MOCK = import.meta.env.APP_USE_MOCK === 'true'

const api = USE_MOCK ? mock : onchain

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: api.getMarkets,
  })
}

export function useMarket(id: string | undefined) {
  return useQuery({
    queryKey: ['market', id],
    queryFn: () => api.getMarket(id!),
    enabled: !!id,
  })
}

export function useUserPosition(marketId: string | undefined) {
  return useQuery({
    queryKey: ['userPosition', marketId],
    queryFn: () => api.getUserPosition(marketId!),
    enabled: !!marketId,
  })
}

/**
 * @deprecated Phase 1 retired this hook in favor of `usePythFeed` + `useLatestPrice`
 * from `@/lib/pyth/hooks`. Do not use in new code. Will be removed in a later cleanup pass.
 */
export function useCurrentPrice(pair: string | undefined) {
  return useQuery({
    queryKey: ['price', pair],
    queryFn: () => mock.getCurrentPrice(pair!),
    enabled: !!pair,
    refetchInterval: 5000,
  })
}
