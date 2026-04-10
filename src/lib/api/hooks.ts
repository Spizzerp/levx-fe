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

export function useCurrentPrice(pair: string | undefined) {
  return useQuery({
    queryKey: ['price', pair],
    queryFn: () => getCurrentPrice(pair!),
    enabled: !!pair,
    refetchInterval: 5000,
  })
}
