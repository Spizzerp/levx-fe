import { useQuery } from '@tanstack/react-query'

import type { CurrentPrice, Market, UserPosition } from '@/types/market'

/**
 * When true, all data hooks use the mock layer instead of on-chain RPC.
 * Set APP_USE_MOCK=true in your .env to enable during development.
 */
const USE_MOCK = import.meta.env.APP_USE_MOCK === 'true'

async function getApi() {
  if (USE_MOCK) {
    return import('@/lib/api/mock')
  }
  return import('@/lib/api/onchain')
}

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async (): Promise<Market[]> => {
      const api = await getApi()
      return api.getMarkets()
    },
  })
}

export function useMarket(id: string | undefined) {
  return useQuery({
    queryKey: ['market', id],
    queryFn: async (): Promise<Market> => {
      const api = await getApi()
      return api.getMarket(id!)
    },
    enabled: !!id,
  })
}

export function useUserPosition(marketId: string | undefined) {
  return useQuery({
    queryKey: ['userPosition', marketId],
    queryFn: async (): Promise<UserPosition | null> => {
      const api = await getApi()
      return api.getUserPosition(marketId!)
    },
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
    queryFn: async (): Promise<CurrentPrice> => {
      const mock = await import('@/lib/api/mock')
      return mock.getCurrentPrice(pair!)
    },
    enabled: !!pair,
    refetchInterval: 5000,
  })
}
