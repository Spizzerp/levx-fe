/**
 * On-chain data fetching — replaces mock.ts with real RPC queries.
 *
 * Uses a read-only Anchor Program instance (no wallet needed for reads).
 * Functions mirror the mock.ts API surface so hooks.ts can swap imports.
 */

import { PublicKey } from '@solana/web3.js'

import type { Market, MarketState, UserPosition } from '@/types/market'

import { anchorMarketToFE, anchorPathToFE, anchorPositionToFE, parseMarketState } from './adapters'
import { resolveBaseMintLabel } from './pairLabels'
import { getReadOnlyProgram } from '../solana/program'
import { deriveMarketPda, derivePathPda, derivePositionPda } from '../solana/pda'
import { estimateLmsrExitPayout } from '../solana/lmsr'
import { SCALE } from '@/lib/constants'

/**
 * Derive a PathTone from a path's predicted price trajectory.
 * Compares first and last predicted prices to classify direction.
 */
function deriveTone(predictedPrices: number[]): 'ultra-bull' | 'bull' | 'neutral' | 'bear' | 'ultra-bear' {
  if (predictedPrices.length < 2) return 'neutral'
  const first = predictedPrices[0]
  const last = predictedPrices[predictedPrices.length - 1]
  const pctChange = (last - first) / first
  if (pctChange > 0.10) return 'ultra-bull'
  if (pctChange > 0.03) return 'bull'
  if (pctChange < -0.10) return 'ultra-bear'
  if (pctChange < -0.03) return 'bear'
  return 'neutral'
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getMarkets(): Promise<Market[]> {
  const program = getReadOnlyProgram()
  let allMarkets: any[]
  try {
    allMarkets = await program.account.market.all()
  } catch (err) {
    // IDL/account layout mismatch — deployed program may be newer than IDL.
    // Return empty rather than crashing the whole page.
    console.warn('[onchain] Failed to fetch markets — IDL may be stale:', (err as Error).message)
    return []
  }

  const markets: Market[] = []
  for (const acc of allMarkets) {
    try {
      const raw = acc.account
      const marketId = raw.marketId.toNumber()
      const market = anchorMarketToFE(raw, String(marketId))
      const pairInfo = resolveBaseMintLabel(raw.baseMint)
      market.pair = pairInfo.pair
      market.base = pairInfo.base
      market.quote = pairInfo.quote
      markets.push(market)
    } catch {
      // Skip accounts that can't be deserialized (layout mismatch)
    }
  }
  return markets
}

export async function getMarket(id: string): Promise<Market> {
  const program = getReadOnlyProgram()
  const marketId = Number(id)
  const [marketPda] = deriveMarketPda(marketId)

  const raw: any = await program.account.market.fetch(marketPda)
  const market = anchorMarketToFE(raw, id)

  const pairInfo = resolveBaseMintLabel(raw.baseMint)
  market.pair = pairInfo.pair
  market.base = pairInfo.base
  market.quote = pairInfo.quote

  // Fetch all paths for this market
  const numPaths = raw.numPaths as number
  const pathPromises = Array.from({ length: numPaths }, (_, i) => {
    const [pathPda] = derivePathPda(marketId, i)
    return program.account.pathOutcome.fetch(pathPda)
  })
  const pathRaws: any[] = await Promise.all(pathPromises)

  const startTimeMs = raw.startTime.toNumber() * 1000
  const checkpointInterval = raw.checkpointInterval as number

  market.paths = pathRaws.map((pathRaw: any) => {
    const path = anchorPathToFE(pathRaw, startTimeMs, checkpointInterval)
    path.tone = deriveTone(path.predictedPrices)
    return path
  })

  return market
}

/**
 * Returns the connected wallet's first position on the given market — or
 * `null` when the wallet has no position there. A wallet can technically
 * hold multiple positions per market (one per path); use `getUserPositions`
 * + filter when you need them all. The single-position shape here is
 * what `MarketPage` consumes via `UserPositionCard`.
 */
export async function getUserPosition(
  marketId: string,
  wallet: PublicKey | null,
): Promise<UserPosition | null> {
  if (!wallet) return null
  const all = await getUserPositions(wallet)
  return all.find((p) => p.marketId === marketId) ?? null
}

/**
 * Compute a user-facing "estimated payout" for a position. The on-chain
 * `position.final_payout` is initialized to 0 and only written by
 * `exit_position` / `claim`, so reading it directly would render $0
 * payout (and a -100% P&L) on every active and settled-but-unclaimed
 * row. Instead we derive a sensible per-state estimate:
 *
 *   - `claimed`   → realized `final_payout` from chain
 *   - `dissolved` → 0
 *   - `void`      → `collateral` (refund — `claim` returns the original wager)
 *   - else        → LMSR mark-to-market via `estimateLmsrExitPayout`,
 *                   which is the same closed-form `exit_position` uses on-chain
 *                   for the λ=0 tier
 *
 * The LMSR estimate is gross of the settlement rake (typically 1–2% via
 * `default_fee_settle_bps`) — close enough for at-a-glance UI. Slippage
 * tolerance on the actual exit/claim still goes through the real on-chain
 * computation.
 */
export function computeEstimatedPayout(args: {
  positionRaw: { collateral: { toNumber(): number }; lmsrShares: { toNumber(): number }; finalPayout: { toNumber(): number }; claimed: boolean }
  pathDissolved: boolean
  pathIndex: number
  marketState: MarketState
  marketShareQuantitiesScaled: number[]
  marketLmsrAlphaScaled: number
  marketAmplitudesScaled: number[]
  marketNumPaths: number
}): number {
  if (args.positionRaw.claimed) {
    return args.positionRaw.finalPayout.toNumber() / SCALE
  }
  if (args.pathDissolved) return 0
  if (args.marketState === 'void') {
    return args.positionRaw.collateral.toNumber() / SCALE
  }
  const sharesScaled = args.positionRaw.lmsrShares.toNumber() / SCALE
  if (sharesScaled <= 0) return 0
  const activeMask = args.marketAmplitudesScaled
    .slice(0, args.marketNumPaths)
    .map((a) => a > 0)
  return estimateLmsrExitPayout({
    shareQuantities: args.marketShareQuantitiesScaled,
    numPaths: args.marketNumPaths,
    lmsrAlpha: args.marketLmsrAlphaScaled,
    pathIndex: args.pathIndex,
    sharesScaled,
    activeMask,
  })
}

/**
 * Fetch a specific position for a connected wallet on a given market + path.
 */
export async function getPosition(
  marketId: number,
  wallet: PublicKey,
  pathIndex: number,
): Promise<UserPosition | null> {
  const program = getReadOnlyProgram()
  const [positionPda] = derivePositionPda(marketId, wallet, pathIndex)
  try {
    const positionRaw: any = await program.account.position.fetch(positionPda)
    const [marketPda] = deriveMarketPda(marketId)
    const marketRaw: any = await program.account.market.fetch(marketPda)
    const [pathPda] = derivePathPda(marketId, pathIndex)
    const pathRaw: any = await program.account.pathOutcome.fetch(pathPda)
    const startTimeMs = marketRaw.startTime.toNumber() * 1000
    const checkpointInterval = marketRaw.checkpointInterval as number
    const path = anchorPathToFE(pathRaw, startTimeMs, checkpointInterval)
    path.tone = deriveTone(path.predictedPrices)
    const pairInfo = resolveBaseMintLabel(marketRaw.baseMint)
    const marketState = parseMarketState(marketRaw.state) as MarketState
    const numPaths = marketRaw.numPaths as number
    const shareQuantitiesScaled = (marketRaw.lmsrShareQuantities as { toNumber(): number }[])
      .slice(0, numPaths)
      .map((q) => q.toNumber() / SCALE)
    const amplitudesScaled = (marketRaw.amplitudes as { toNumber(): number }[])
      .slice(0, numPaths)
      .map((a) => a.toNumber() / SCALE)
    const lmsrAlphaScaled = marketRaw.lmsrAlpha.toNumber() / SCALE
    const estimatedPayout = computeEstimatedPayout({
      positionRaw,
      pathDissolved: path.dissolved,
      pathIndex,
      marketState,
      marketShareQuantitiesScaled: shareQuantitiesScaled,
      marketLmsrAlphaScaled: lmsrAlphaScaled,
      marketAmplitudesScaled: amplitudesScaled,
      marketNumPaths: numPaths,
    })
    return anchorPositionToFE(positionRaw, {
      marketIdNum: marketId,
      marketState,
      pair: pairInfo.pair,
      base: pairInfo.base,
      quote: pairInfo.quote,
      pathLabel: path.label,
      pathTone: path.tone,
      pathDissolved: path.dissolved,
      estimatedPayout,
    })
  } catch {
    // Account doesn't exist — user has no position on this path
    return null
  }
}

/**
 * Fetch all positions for a wallet across all markets.
 * Uses getProgramAccounts with a filter on the user pubkey field.
 *
 * Caches the per-market context (pair label, state) so we don't refetch
 * the Market account once per position when a user holds multiple
 * positions on the same market.
 */
export async function getUserPositions(wallet: PublicKey | null): Promise<UserPosition[]> {
  if (!wallet) return []
  const program = getReadOnlyProgram()

  // Position account layout: 8 (discriminator) + 32 (market) + 32 (user) + ...
  // Filter on user field at offset 40
  const accounts: any[] = await program.account.position.all([
    { memcmp: { offset: 40, bytes: wallet.toBase58() } },
  ])

  const positions: UserPosition[] = []
  interface MarketCacheEntry {
    marketIdNum: number
    marketState: MarketState
    pair: string
    base: string
    quote: string
    startTimeMs: number
    checkpointInterval: number
    numPaths: number
    shareQuantitiesScaled: number[]
    amplitudesScaled: number[]
    lmsrAlphaScaled: number
  }
  const marketCache = new Map<string, MarketCacheEntry | null>()
  const pathCache = new Map<string, { label: string; tone: ReturnType<typeof deriveTone>; dissolved: boolean }>()

  for (const acc of accounts) {
    const raw = acc.account
    const pathIndex = raw.pathIndex as number
    const marketPubkey = raw.market as PublicKey
    const marketKey = marketPubkey.toBase58()

    let mkt = marketCache.get(marketKey)
    if (mkt === undefined) {
      try {
        const marketRaw: any = await program.account.market.fetch(marketPubkey)
        const pairInfo = resolveBaseMintLabel(marketRaw.baseMint)
        const numPaths = marketRaw.numPaths as number
        mkt = {
          marketIdNum: marketRaw.marketId.toNumber(),
          marketState: parseMarketState(marketRaw.state) as MarketState,
          pair: pairInfo.pair,
          base: pairInfo.base,
          quote: pairInfo.quote,
          startTimeMs: marketRaw.startTime.toNumber() * 1000,
          checkpointInterval: marketRaw.checkpointInterval as number,
          numPaths,
          shareQuantitiesScaled: (marketRaw.lmsrShareQuantities as { toNumber(): number }[])
            .slice(0, numPaths)
            .map((q) => q.toNumber() / SCALE),
          amplitudesScaled: (marketRaw.amplitudes as { toNumber(): number }[])
            .slice(0, numPaths)
            .map((a) => a.toNumber() / SCALE),
          lmsrAlphaScaled: marketRaw.lmsrAlpha.toNumber() / SCALE,
        }
        marketCache.set(marketKey, mkt)
      } catch {
        marketCache.set(marketKey, null)
        continue
      }
    }
    if (!mkt) continue

    const pathKey = `${mkt.marketIdNum}-${pathIndex}`
    let pathInfo = pathCache.get(pathKey)
    if (!pathInfo) {
      try {
        const [pathPda] = derivePathPda(mkt.marketIdNum, pathIndex)
        const pathRaw: any = await program.account.pathOutcome.fetch(pathPda)
        const path = anchorPathToFE(pathRaw, mkt.startTimeMs, mkt.checkpointInterval)
        const tone = deriveTone(path.predictedPrices)
        pathInfo = { label: path.label, tone, dissolved: path.dissolved }
      } catch {
        // The keeper's `close_path_outcome` rent-reclaim sweep closes
        // PathOutcome PDAs once a market reaches a terminal state. The
        // user's Position PDA still exists and may still be claimable, so
        // we degrade gracefully with a stub label instead of dropping
        // the row from the portfolio. `dissolved=false` keeps the row
        // eligible for the Claim/Reclaim button.
        pathInfo = {
          label: `Path ${String.fromCharCode(65 + pathIndex)}`,
          tone: 'neutral' as const,
          dissolved: false,
        }
      }
      pathCache.set(pathKey, pathInfo)
    }

    const estimatedPayout = computeEstimatedPayout({
      positionRaw: raw,
      pathDissolved: pathInfo.dissolved,
      pathIndex,
      marketState: mkt.marketState,
      marketShareQuantitiesScaled: mkt.shareQuantitiesScaled,
      marketLmsrAlphaScaled: mkt.lmsrAlphaScaled,
      marketAmplitudesScaled: mkt.amplitudesScaled,
      marketNumPaths: mkt.numPaths,
    })

    positions.push(
      anchorPositionToFE(raw, {
        marketIdNum: mkt.marketIdNum,
        marketState: mkt.marketState,
        pair: mkt.pair,
        base: mkt.base,
        quote: mkt.quote,
        pathLabel: pathInfo.label,
        pathTone: pathInfo.tone,
        pathDissolved: pathInfo.dissolved,
        estimatedPayout,
      }),
    )
  }

  // `getProgramAccounts` ordering isn't part of the API. Sort by
  // (marketIdNum, pathIndex) so the portfolio and `useUserPosition`'s
  // first-match semantics are stable across polls.
  positions.sort((a, b) => a.marketIdNum - b.marketIdNum || a.pathIndex - b.pathIndex)

  return positions
}
