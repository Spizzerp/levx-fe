/**
 * On-chain data fetching — replaces mock.ts with real RPC queries.
 *
 * Uses a read-only Anchor Program instance (no wallet needed for reads).
 * Functions mirror the mock.ts API surface so hooks.ts can swap imports.
 */

import { PublicKey } from '@solana/web3.js'

import type { Market, MarketState, PathTone, UserPosition } from '@/types/market'

import { anchorMarketToFE, anchorPathToFE, anchorPositionToFE, parseMarketState } from './adapters'
import { resolveBaseMintLabel } from './pairLabels'
import { getReadOnlyProgram } from '../solana/program'
import {
  PROGRAM_ID,
  deriveMarketPda,
  derivePathChunkPda,
  derivePathPda,
  derivePositionPda,
} from '../solana/pda'
import { activeMaskFromPricingMask, loadEigenCachePolicy } from '../solana/eigenCache'
import { estimateLmsrExitPayout, estimateLmsrPrices, probabilityToMultiplier } from '../solana/lmsr'
import { SCALE } from '@/lib/constants'
import { formatAiPathLabel } from '@/lib/pathLabels'

type DerivedPathTone = Exclude<PathTone, 'custom'>

/**
 * Derive a PathTone from a path's predicted price trajectory.
 * Compares first and last predicted prices to classify direction.
 */
function deriveTone(predictedPrices: number[]): DerivedPathTone {
  if (predictedPrices.length < 2) return 'neutral'
  const first = predictedPrices[0]
  const last = predictedPrices[predictedPrices.length - 1]
  const pctChange = (last - first) / first
  if (pctChange > 0.1) return 'ultra-bull'
  if (pctChange > 0.03) return 'bull'
  if (pctChange < -0.1) return 'ultra-bear'
  if (pctChange < -0.03) return 'bear'
  return 'neutral'
}

function applyDerivedPathDisplay(path: {
  predictedPrices: number[]
  tone: PathTone
  origin: string
  label: string
}): DerivedPathTone {
  const tone = deriveTone(path.predictedPrices)
  path.tone = tone
  if (path.origin === 'ai') {
    path.label = formatAiPathLabel(tone)
  }
  return tone
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_PATH_OUTCOME_CHECKPOINTS = 480
const MAX_PATH_UPLOAD_CHUNKS = 12
// Byte offsets in the current PathOutcome account, including the 8-byte
// Anchor discriminator. Guard these before Borsh sees the Vec length; old
// devnet path accounts have price bytes here and can otherwise trigger huge
// browser allocations during decode.
const PATH_OUTCOME_CHUNK_COUNT_OFFSET = 137
const PATH_OUTCOME_CHUNKS_CLOSED_OFFSET = 138
const PATH_OUTCOME_GENERATION_METHOD_OFFSET = 139
const PATH_OUTCOME_PRICES_LEN_OFFSET = 148
const PATH_OUTCOME_FIXED_ACCOUNT_SIZE = 310

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  )
}

function assertCurrentPathOutcomeLayout(data: Uint8Array, label: string): void {
  if (data.length < PATH_OUTCOME_FIXED_ACCOUNT_SIZE) {
    throw new Error(`${label} is shorter than the current PathOutcome layout`)
  }

  const chunkCount = data[PATH_OUTCOME_CHUNK_COUNT_OFFSET]
  const chunksClosed = data[PATH_OUTCOME_CHUNKS_CLOSED_OFFSET]
  const generationMethod = data[PATH_OUTCOME_GENERATION_METHOD_OFFSET]
  const predictedPricesLen = readU32LE(data, PATH_OUTCOME_PRICES_LEN_OFFSET)

  if (
    chunkCount > MAX_PATH_UPLOAD_CHUNKS ||
    chunksClosed > chunkCount ||
    generationMethod > 1 ||
    predictedPricesLen > MAX_PATH_OUTCOME_CHECKPOINTS
  ) {
    throw new Error(`${label} appears to use a legacy/incompatible PathOutcome layout`)
  }

  const expectedMinSize = PATH_OUTCOME_FIXED_ACCOUNT_SIZE + predictedPricesLen * 8
  if (data.length < expectedMinSize) {
    throw new Error(`${label} is truncated for its declared price count`)
  }
}

async function fetchPathOutcome(
  program: any,
  pathPda: PublicKey,
  context: { market: PublicKey; marketId: number; pathIndex: number },
): Promise<any> {
  const info = await program.provider.connection.getAccountInfo(pathPda)
  if (!info) {
    throw new Error(`PathOutcome account not found: ${pathPda.toBase58()}`)
  }
  if (!info.owner.equals(PROGRAM_ID)) {
    throw new Error(`PathOutcome ${pathPda.toBase58()} is not owned by LevX`)
  }

  const label = `PathOutcome market=${context.marketId} path=${context.pathIndex}`
  assertCurrentPathOutcomeLayout(info.data, label)

  const raw = program.coder.accounts.decode('pathOutcome', info.data)
  if (!raw.market.equals(context.market) || raw.pathIndex !== context.pathIndex) {
    throw new Error(`${label} decoded with mismatched market or path index`)
  }
  return raw
}

async function fetchPathChunks(program: any, chunkPdas: PublicKey[]): Promise<any[]> {
  const chunks: any[] = []
  const connection = program.provider.connection

  for (let i = 0; i < chunkPdas.length; i += 100) {
    const batch = chunkPdas.slice(i, i + 100)
    const infos = await connection.getMultipleAccountsInfo(batch)
    infos.forEach((info: any, batchIndex: number) => {
      if (!info) {
        throw new Error(`PathChunk account not found: ${batch[batchIndex].toBase58()}`)
      }
      chunks.push(program.coder.accounts.decode('pathChunk', info.data))
    })
  }

  return chunks
}

async function hydrateChunkedPath(program: any, pathRaw: any): Promise<any> {
  const chunkCount = Number(pathRaw.chunkCount ?? 0)
  if (chunkCount <= 0) return pathRaw

  try {
    const chunkPdas = Array.from({ length: chunkCount }, (_, chunkIndex) => {
      const [chunkPda] = derivePathChunkPda(pathRaw.pathUpload, chunkIndex)
      return chunkPda
    })
    const chunks = await fetchPathChunks(program, chunkPdas)
    const predictedPrices = chunks.flatMap((chunk: any) =>
      (chunk.prices as any[]).slice(0, Number(chunk.len)),
    )
    return { ...pathRaw, predictedPrices }
  } catch (err) {
    console.warn('[onchain] Failed to hydrate path chunks:', (err as Error).message)
    return { ...pathRaw, predictedPrices: pathRaw.predictedPrices ?? [] }
  }
}

async function fetchMarketPaths(
  program: any,
  args: { marketId: number; marketPda: PublicKey; raw: any },
): Promise<Market['paths']> {
  const { marketId, marketPda, raw } = args
  const numPaths = raw.numPaths as number
  const pathPromises = Array.from({ length: numPaths }, async (_, i) => {
    const [pathPda] = derivePathPda(marketId, i)
    try {
      return await fetchPathOutcome(program, pathPda, { market: marketPda, marketId, pathIndex: i })
    } catch (err) {
      console.warn(
        `[onchain] Skipping undecodable path ${i} for market ${marketId}:`,
        (err as Error).message,
      )
      return null
    }
  })
  const pathRaws: any[] = (await Promise.all(pathPromises)).filter(Boolean)

  const startTimeMs = raw.startTime.toNumber() * 1000
  const checkpointInterval = raw.checkpointInterval as number
  const lambda = raw.lambda.toNumber() / SCALE
  const pricingActiveMask =
    typeof raw.pricingActiveMask?.toNumber === 'function'
      ? raw.pricingActiveMask.toNumber()
      : Number(raw.pricingActiveMask ?? 0)
  const currentPrices =
    lambda === 0
      ? estimateLmsrPrices({
          shareQuantities: (raw.lmsrShareQuantities as { toNumber(): number }[])
            .slice(0, numPaths)
            .map((q) => q.toNumber() / SCALE),
          numPaths,
          lmsrAlpha: raw.lmsrAlpha.toNumber() / SCALE,
          activeMask: activeMaskFromPricingMask(pricingActiveMask, numPaths),
        })
      : []

  const hydratedPathRaws = await Promise.all(
    pathRaws.map((pathRaw: any) => hydrateChunkedPath(program, pathRaw)),
  )
  return hydratedPathRaws.map((pathRaw: any) => {
    const path = anchorPathToFE(pathRaw, startTimeMs, checkpointInterval)
    applyDerivedPathDisplay(path)
    const currentMultiplier = probabilityToMultiplier(currentPrices[path.pathIndex] ?? 0)
    if (currentMultiplier > 0) {
      path.multiplier = currentMultiplier
    }
    return path
  })
}

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

  const marketResults = await Promise.all(
    allMarkets.map(async (acc): Promise<Market | null> => {
      let raw: any
      let marketId = 0
      let market: Market

      try {
        raw = acc.account
        marketId = raw.marketId.toNumber()
        market = anchorMarketToFE(raw, String(marketId))
      } catch {
        // Skip accounts that can't be deserialized (layout mismatch)
        return null
      }

      const pairInfo = resolveBaseMintLabel(raw.baseMint)
      market.pair = pairInfo.pair
      market.base = pairInfo.base
      market.quote = pairInfo.quote

      return market
    }),
  )

  return marketResults.filter((market): market is Market => market !== null)
}

export async function getMarket(id: string): Promise<Market> {
  const program = getReadOnlyProgram()
  const marketId = Number(id)
  const [marketPda] = deriveMarketPda(marketId)

  const raw: any = await program.account.market.fetch(marketPda)
  const market = anchorMarketToFE(raw, id)
  market.eigenCacheStatus = (await loadEigenCachePolicy(program, marketId, marketPda, raw)).status

  const pairInfo = resolveBaseMintLabel(raw.baseMint)
  market.pair = pairInfo.pair
  market.base = pairInfo.base
  market.quote = pairInfo.quote

  market.paths = await fetchMarketPaths(program, { marketId, marketPda, raw })

  return market
}

export async function getMarketPathPreviews(
  marketIds: readonly string[],
): Promise<Record<string, Market['paths']>> {
  const program = getReadOnlyProgram()
  const entries = await Promise.all(
    marketIds.map(async (id) => {
      const marketId = Number(id)
      const [marketPda] = deriveMarketPda(marketId)
      const raw: any = await program.account.market.fetch(marketPda)
      const paths = await fetchMarketPaths(program, { marketId, marketPda, raw })
      return [id, paths] as const
    }),
  )
  return Object.fromEntries(entries)
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
  positionRaw: {
    collateral: { toNumber(): number }
    lmsrShares: { toNumber(): number }
    finalPayout: { toNumber(): number }
    claimed: boolean
  }
  pathDissolved: boolean
  pathIndex: number
  marketState: MarketState
  marketShareQuantitiesScaled: number[]
  marketLmsrAlphaScaled: number
  marketAmplitudesScaled: number[]
  marketPricingActiveMask?: number
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
  const activeMask =
    args.marketPricingActiveMask !== undefined
      ? activeMaskFromPricingMask(args.marketPricingActiveMask, args.marketNumPaths)
      : args.marketAmplitudesScaled.slice(0, args.marketNumPaths).map((a) => a > 0)
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
    const pathRaw: any = await hydrateChunkedPath(
      program,
      await fetchPathOutcome(program, pathPda, { market: marketPda, marketId, pathIndex }),
    )
    const startTimeMs = marketRaw.startTime.toNumber() * 1000
    const checkpointInterval = marketRaw.checkpointInterval as number
    const path = anchorPathToFE(pathRaw, startTimeMs, checkpointInterval)
    applyDerivedPathDisplay(path)
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
      marketPricingActiveMask:
        typeof marketRaw.pricingActiveMask?.toNumber === 'function'
          ? marketRaw.pricingActiveMask.toNumber()
          : Number(marketRaw.pricingActiveMask ?? 0),
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
    pricingActiveMask: number
    lmsrAlphaScaled: number
  }
  const marketCache = new Map<string, MarketCacheEntry | null>()
  const pathCache = new Map<
    string,
    { label: string; tone: ReturnType<typeof deriveTone>; dissolved: boolean }
  >()

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
          pricingActiveMask:
            typeof marketRaw.pricingActiveMask?.toNumber === 'function'
              ? marketRaw.pricingActiveMask.toNumber()
              : Number(marketRaw.pricingActiveMask ?? 0),
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
        const [marketPda] = deriveMarketPda(mkt.marketIdNum)
        const pathRaw: any = await hydrateChunkedPath(
          program,
          await fetchPathOutcome(program, pathPda, {
            market: marketPda,
            marketId: mkt.marketIdNum,
            pathIndex,
          }),
        )
        const path = anchorPathToFE(pathRaw, mkt.startTimeMs, mkt.checkpointInterval)
        const tone = applyDerivedPathDisplay(path)
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
      marketPricingActiveMask: mkt.pricingActiveMask,
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
