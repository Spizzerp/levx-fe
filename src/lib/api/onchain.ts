/**
 * On-chain data fetching — replaces mock.ts with real RPC queries.
 *
 * Uses a read-only Anchor Program instance (no wallet needed for reads).
 * Functions mirror the mock.ts API surface so hooks.ts can swap imports.
 */

import { PublicKey } from '@solana/web3.js'

import type { Market, UserPosition } from '@/types/market'

import { anchorMarketToFE, anchorPathToFE, anchorPositionToFE } from './adapters'
import { getReadOnlyProgram } from '../solana/program'
import { deriveMarketPda, derivePathPda, derivePositionPda } from '../solana/pda'

/** Known pair labels mapped by base mint address (devnet). Extend as pairs are added. */
const PAIR_LABELS: Record<string, { pair: string; base: string; quote: string }> = {
  // Add known devnet mint → label mappings here as markets are created.
  // Fallback logic below handles unknown mints.
}

function resolvePairLabel(baseMint: PublicKey): { pair: string; base: string; quote: string } {
  const key = baseMint.toBase58()
  return PAIR_LABELS[key] ?? { pair: `${key.slice(0, 4)}…/USDC`, base: key.slice(0, 4), quote: 'USDC' }
}

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
  const allMarkets = await (program.account as any).market.all()

  return allMarkets.map((acc: any) => {
    const raw = acc.account
    const marketId = raw.marketId.toNumber()
    const market = anchorMarketToFE(raw, String(marketId))
    const pairInfo = resolvePairLabel(raw.baseMint)
    market.pair = pairInfo.pair
    market.base = pairInfo.base
    market.quote = pairInfo.quote
    return market
  })
}

export async function getMarket(id: string): Promise<Market> {
  const program = getReadOnlyProgram()
  const marketId = Number(id)
  const [marketPda] = deriveMarketPda(marketId)

  const raw: any = await (program.account as any).market.fetch(marketPda)
  const market = anchorMarketToFE(raw, id)

  const pairInfo = resolvePairLabel(raw.baseMint)
  market.pair = pairInfo.pair
  market.base = pairInfo.base
  market.quote = pairInfo.quote

  // Fetch all paths for this market
  const numPaths = raw.numPaths as number
  const pathPromises = Array.from({ length: numPaths }, (_, i) => {
    const [pathPda] = derivePathPda(marketId, i)
    return (program.account as any).pathOutcome.fetch(pathPda)
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

export async function getUserPosition(_marketId: string): Promise<UserPosition | null> {
  // Requires a connected wallet — the hooks layer will pass wallet context.
  // Returning null here for the basic hook interface; use getPosition() for direct queries.
  return null
}

/**
 * Fetch a specific position for a connected wallet on a given market + path.
 */
export async function getPosition(
  marketId: number,
  wallet: PublicKey,
  pathIndex: number,
  pathLabel: string,
  pathTone: 'ultra-bull' | 'bull' | 'neutral' | 'bear' | 'ultra-bear',
  pathDissolved: boolean,
): Promise<UserPosition | null> {
  const program = getReadOnlyProgram()
  const [positionPda] = derivePositionPda(marketId, wallet, pathIndex)
  try {
    const raw: any = await (program.account as any).position.fetch(positionPda)
    return anchorPositionToFE(raw, String(marketId), pathLabel, pathTone, pathDissolved)
  } catch {
    // Account doesn't exist — user has no position on this path
    return null
  }
}

/**
 * Fetch all positions for a wallet across all markets.
 * Uses getProgramAccounts with a filter on the user pubkey field.
 */
export async function getUserPositions(wallet: PublicKey): Promise<UserPosition[]> {
  const program = getReadOnlyProgram()

  // Position account layout: 8 (discriminator) + 32 (market) + 32 (user) + ...
  // Filter on user field at offset 40
  const accounts: any[] = await (program.account as any).position.all([
    { memcmp: { offset: 40, bytes: wallet.toBase58() } },
  ])

  // For each position, we need the corresponding path data for labels/tones.
  // This is expensive — in production, use an indexer. For devnet, it's fine.
  const positions: UserPosition[] = []

  for (const acc of accounts) {
    const raw = acc.account
    const pathIndex = raw.pathIndex as number
    const marketPubkey = raw.market as PublicKey
    try {
      const marketRaw: any = await (program.account as any).market.fetch(marketPubkey)
      const mktId = marketRaw.marketId.toNumber()
      const [pathPda] = derivePathPda(mktId, pathIndex)
      const pathRaw: any = await (program.account as any).pathOutcome.fetch(pathPda)
      const startTimeMs = marketRaw.startTime.toNumber() * 1000
      const checkpointInterval = marketRaw.checkpointInterval as number
      const path = anchorPathToFE(pathRaw, startTimeMs, checkpointInterval)
      path.tone = deriveTone(path.predictedPrices)
      positions.push(anchorPositionToFE(raw, String(mktId), path.label, path.tone, path.dissolved))
    } catch {
      // Skip positions we can't fully resolve
    }
  }

  return positions
}
