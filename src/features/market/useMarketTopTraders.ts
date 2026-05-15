import { useQuery } from '@tanstack/react-query'

import { SCALE } from '@/lib/constants'
import { parseMarketState } from '@/lib/api/adapters'
import { activeMaskFromPricingMask } from '@/lib/solana/eigenCache'
import { estimateLmsrExitPayout } from '@/lib/solana/lmsr'
import { deriveMarketPda } from '@/lib/solana/pda'
import { getReadOnlyProgram } from '@/lib/solana/program'
import type { MarketState } from '@/types/market'

export interface MarketTopTrader {
  wallet: string
  collateral: number
  exposure: number
  pnl: number
  positions: number
}

const POSITION_MARKET_OFFSET = 8

function bnToNumber(value: { toNumber(): number } | number | undefined): number {
  if (typeof value === 'number') return value
  return value?.toNumber() ?? 0
}

export async function getMarketTopTraders(marketId: number): Promise<MarketTopTrader[]> {
  const program = getReadOnlyProgram()
  const [marketPda] = deriveMarketPda(marketId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marketRaw: any = await program.account.market.fetch(marketPda)
  const marketState = parseMarketState(marketRaw.state) as MarketState
  const numPaths = marketRaw.numPaths as number
  const shareQuantities = (marketRaw.lmsrShareQuantities as { toNumber(): number }[])
    .slice(0, numPaths)
    .map((q) => q.toNumber() / SCALE)
  const lmsrAlpha = bnToNumber(marketRaw.lmsrAlpha) / SCALE
  const pricingActiveMask =
    typeof marketRaw.pricingActiveMask?.toNumber === 'function'
      ? marketRaw.pricingActiveMask.toNumber()
      : Number(marketRaw.pricingActiveMask ?? 0)
  const activeMask = activeMaskFromPricingMask(pricingActiveMask, numPaths)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts: { account: any }[] = await program.account.position.all([
    { memcmp: { offset: POSITION_MARKET_OFFSET, bytes: marketPda.toBase58() } },
  ])

  const byWallet = new Map<string, MarketTopTrader>()
  for (const { account } of accounts) {
    const wallet = account.user?.toBase58?.()
    if (!wallet) continue

    const existing = byWallet.get(wallet) ?? {
      wallet,
      collateral: 0,
      exposure: 0,
      pnl: 0,
      positions: 0,
    }

    const collateral = bnToNumber(account.collateral) / SCALE
    const exposure = bnToNumber(account.notionalExposure) / SCALE
    const finalPayout = bnToNumber(account.finalPayout) / SCALE
    const shares = bnToNumber(account.lmsrShares) / SCALE
    const pathIndex = account.pathIndex as number
    const estimatedPayout =
      account.claimed || finalPayout > 0
        ? finalPayout
        : marketState === 'void'
          ? collateral
          : estimateLmsrExitPayout({
              shareQuantities,
              numPaths,
              lmsrAlpha,
              pathIndex,
              sharesScaled: shares,
              activeMask,
            })

    existing.collateral += collateral
    existing.exposure += exposure
    existing.pnl += estimatedPayout - collateral
    existing.positions += 1
    byWallet.set(wallet, existing)
  }

  return [...byWallet.values()].sort((a, b) => {
    if (b.exposure !== a.exposure) return b.exposure - a.exposure
    return b.collateral - a.collateral
  })
}

export function useMarketTopTraders(marketId: number | null) {
  return useQuery<MarketTopTrader[]>({
    queryKey: ['marketTopTraders', marketId],
    enabled: marketId != null,
    queryFn: () => getMarketTopTraders(marketId!),
    staleTime: 60_000,
    refetchInterval: false,
  })
}
