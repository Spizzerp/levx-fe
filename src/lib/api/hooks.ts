import { useQuery } from '@tanstack/react-query'

import { getCurrentPrice, getMarket, getMarkets } from '@/lib/api/mock'

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: getMarkets,
  })
}

export function useMarket(id: string | undefined) {
  return useQuery({
    queryKey: ['market', id],
    queryFn: () => getMarket(id!),
    enabled: !!id,
  })
}

/**
 * @deprecated Phase 1 retired this hook in favor of `usePythFeed` + `useLatestPrice`
 * from `@/lib/pyth/hooks`. Do not use in new code. Will be removed in a later cleanup pass.
 */
export function useCurrentPrice(pair: string | undefined) {
  return useQuery({
    queryKey: ['price', pair],
    queryFn: () => getCurrentPrice(pair!),
    enabled: !!pair,
    refetchInterval: 5000,
  })
}
