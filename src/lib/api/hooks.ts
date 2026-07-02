import { useQuery } from '@tanstack/react-query'
import type { PublicKey } from '@solana/web3.js'
import { useMemo } from 'react'

import type { CurrentPrice, Market, Mode2Readiness, UserPosition } from '@/types/market'
import { useWalletStore } from '@/stores/walletStore'

/**
 * When true, all data hooks use the mock layer instead of on-chain RPC.
 * Set APP_USE_MOCK=true in your .env to enable during development.
 */
const USE_MOCK = import.meta.env.APP_USE_MOCK === 'true'

/**
 * Polling baseline. The WS event subscription (`EventStreamProvider`)
 * does the primary invalidation work — these intervals are just the
 * floor for transports that miss events (network glitch, RPC blip, or
 * a market the user navigates to before the WS catches its first
 * MarketActivated). The per-market detail interval is kept long because
 * checkpoint-driven changes already arrive via `CheckpointSampled`.
 */
const MARKETS_REFETCH_MS = 60_000
const MARKET_REFETCH_MS = 60_000
const POSITIONS_REFETCH_MS = 60_000
const MODE2_READINESS_REFETCH_MS = 60_000
const STALE_MS = 5_000
const PATH_PREVIEWS_STALE_MS = 60_000

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
    refetchInterval: MARKETS_REFETCH_MS,
    staleTime: STALE_MS,
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
    refetchInterval: MARKET_REFETCH_MS,
    staleTime: STALE_MS,
  })
}

export function useMarketPathPreviews(marketIds: readonly string[]) {
  const normalizedIds = useMemo(() => Array.from(new Set(marketIds)).sort(), [marketIds])

  return useQuery({
    queryKey: ['marketPathPreviews', normalizedIds],
    queryFn: async (): Promise<Record<string, Market['paths']>> => {
      const api = await getApi()
      return api.getMarketPathPreviews(normalizedIds)
    },
    enabled: normalizedIds.length > 0,
    refetchInterval: false,
    staleTime: PATH_PREVIEWS_STALE_MS,
  })
}

export function useMode2Readiness(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['mode2Readiness'],
    queryFn: async (): Promise<Mode2Readiness> => {
      const api = await getApi()
      return api.getMode2Readiness()
    },
    enabled: options.enabled ?? true,
    refetchInterval: MODE2_READINESS_REFETCH_MS,
    staleTime: STALE_MS,
  })
}

/**
 * The connected wallet's position on a single market (or null). A wallet
 * can technically hold positions on multiple paths in the same market;
 * this hook returns the first match for back-compat with `MarketPage`'s
 * `<UserPositionCard>`. Use `useUserPositions` for the full list.
 */
export function useUserPosition(marketId: string | undefined) {
  const wallet = useWalletStore((s) => s.publicKey)
  const walletKey = wallet?.toBase58() ?? null
  return useQuery({
    queryKey: ['userPosition', marketId, walletKey],
    queryFn: async (): Promise<UserPosition | null> => {
      const api = await getApi()
      return api.getUserPosition(marketId!, wallet as PublicKey | null)
    },
    enabled: !!marketId && (USE_MOCK || !!wallet),
    refetchInterval: POSITIONS_REFETCH_MS,
    staleTime: STALE_MS,
  })
}

/**
 * All on-chain positions held by the connected wallet, joined with their
 * market + path context for direct display in PortfolioPage. Disabled
 * until a wallet is connected (other than in mock mode, which serves a
 * deterministic fixture set).
 */
export function useUserPositions() {
  const wallet = useWalletStore((s) => s.publicKey)
  const walletKey = wallet?.toBase58() ?? null
  return useQuery({
    queryKey: ['userPositions', walletKey],
    queryFn: async (): Promise<UserPosition[]> => {
      const api = await getApi()
      return api.getUserPositions(wallet as PublicKey | null)
    },
    enabled: USE_MOCK || !!wallet,
    refetchInterval: POSITIONS_REFETCH_MS,
    staleTime: STALE_MS,
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
