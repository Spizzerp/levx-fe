/**
 * Transaction hooks for wallet-signed instructions:
 *   - add_path(params)
 *   - place_wager(path_index, amount)
 *   - place_batch_wager(path_indices[], amount)
 *   - exit_position()
 *   - claim()
 *   - close_market()
 *
 * Every mutation builds instructions manually, routes through
 * buildTransaction (compute-unit limit + dynamic priority fee), and
 * sends via AnchorProvider.sendAndConfirm. Account addresses (vault,
 * treasury, insurance) are fetched from on-chain state at call time —
 * no hardcoded addresses.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnchorProvider, BN, parseIdlErrors, Program, translateError } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { PublicKey, SystemProgram, Transaction, type TransactionInstruction } from '@solana/web3.js'

import type { Levx } from '@/idl/levx'
import { useProgram } from './program'
import { CU_LIMITS, MAX_CU_PER_TX, SCALE } from '@/lib/constants'
import { env } from '@/env/env.config'
import { toast } from '@/stores/toastStore'
import { getSlippageTolerance } from '@/stores/slippageStore'
import { ERROR_MAP, formatDecoded, lookupError } from './errorMap'
import { logTransactionError } from './logTransactionError'
import {
  deriveMarketPda,
  deriveEigenCachePda,
  derivePathChunkPda,
  derivePathPda,
  derivePathUploadPda,
  derivePositionPda,
  deriveProtocolPda,
} from './pda'
import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'
import { applySlippageTolerance, estimateLmsrExitPayout, estimateLmsrSharesOut } from './lmsr'
import { buildPathChunks, computePathRoot, PATH_ORIGIN_USER_DRAWN } from './pathCommitments'

const MAX_BATCH_SIZE = 4

interface AddPathInput {
  marketId: number
  predictedPrices: number[]
  numCheckpoints: number
  onStatus?: (status: 'authorizing' | 'uploading') => void
  /**
   * Optional pre-fetched path index. When the caller has already read
   * `market.numPaths` (e.g. to show an optimistic pending row), passing
   * it here avoids a second RPC hop inside the mutation.
   */
  pathIndex?: number
}

interface RelayPathUploadResponse {
  market_id: number
  path_index: number
  intent_pda: string
  signatures: string[]
  finalize_signature: string
}

export class PathRelayError extends Error {
  readonly intentPda: string
  readonly nonce: number
  readonly expiresAt: number
  readonly intentSig: string

  constructor(message: string, args: { intentPda: string; nonce: number; expiresAt: number; intentSig: string }) {
    super(message)
    this.name = 'PathRelayError'
    this.intentPda = args.intentPda
    this.nonce = args.nonce
    this.expiresAt = args.expiresAt
    this.intentSig = args.intentSig
  }
}

interface PlaceWagerInput {
  marketId: number
  pathIndex: number
  /** USDC amount in user-facing decimals (e.g. 25.0) */
  amount: number
}

interface PlaceBatchWagerInput {
  marketId: number
  pathIndices: number[]
  amount: number
}

interface PositionInput {
  marketId: number
  pathIndex: number
}

interface MarketInput {
  marketId: number
  vault?: string | PublicKey
}

interface CancelPathUploadInput {
  marketId: number
  intentPda: string
}

const pathUploadBitIsSet = (mask: number, idx: number) => (mask & (1 << idx)) !== 0

/**
 * Builds + signs + confirms a single transaction with the compute-budget
 * prefix. Replicates Anchor's `.rpc()` error-translation path so IDL-defined
 * program errors (ConstraintInit, custom codes, etc.) keep surfacing as
 * decoded messages instead of raw "Simulation failed: 0x…" strings.
 */
async function sendInstructions(
  program: Program<Levx>,
  instructions: TransactionInstruction[],
  computeUnitLimit: number,
): Promise<string> {
  const provider = program.provider as AnchorProvider
  const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
  const finalIxs = await buildTransaction({
    instructions,
    computeUnitLimit,
    priorityFeeMicroLamports,
  })
  const tx = new Transaction().add(...finalIxs)
  try {
    return await provider.sendAndConfirm(tx)
  } catch (err) {
    await logTransactionError('sendInstructions failed', err, {
      connection: provider.connection,
      details: {
        computeUnitLimit,
        priorityFeeMicroLamports,
        originalInstructionCount: instructions.length,
        finalInstructionCount: finalIxs.length,
      },
    })
    throw translateError(err, parseIdlErrors(program.idl))
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LmsrSnapshot {
  numPaths: number
  shareQuantities: number[]
  lmsrAlpha: number
  activeMask: boolean[]
}

function readLmsrSnapshot(marketAcc: any): LmsrSnapshot {
  const numPaths = marketAcc.numPaths as number
  const shareQuantities = (marketAcc.lmsrShareQuantities as BN[])
    .slice(0, numPaths)
    .map((q) => q.toNumber() / SCALE)
  const pricingActiveMask =
    marketAcc.pricingActiveMask instanceof BN
      ? marketAcc.pricingActiveMask.toNumber()
      : Number(marketAcc.pricingActiveMask ?? 0)
  const activeMask = Array.from(
    { length: numPaths },
    (_, idx) => (pricingActiveMask & (1 << idx)) !== 0,
  )
  const lmsrAlpha = (marketAcc.lmsrAlpha as BN).toNumber() / SCALE
  return { numPaths, shareQuantities, lmsrAlpha, activeMask }
}

function cloneLmsrSnapshot(snap: LmsrSnapshot): LmsrSnapshot {
  return {
    ...snap,
    shareQuantities: snap.shareQuantities.slice(),
    activeMask: snap.activeMask.slice(),
  }
}

function fixedPointFloorWithRoundingSlack(valueHuman: number): BN {
  const safeHuman = Math.max(0, valueHuman - 1 / SCALE)
  return new BN(Math.floor(safeHuman * SCALE))
}

function assertNoEigenCacheAccount(ix: TransactionInstruction, marketId: number): void {
  const [eigenCachePda] = deriveEigenCachePda(marketId)
  if (!ix.keys.some((meta) => meta.pubkey.equals(eigenCachePda))) return
  throw new Error(
    'EigenCache-aware slippage quoting is not implemented; do not pass EigenCache to FE-built wager/exit instructions.',
  )
}

function entryFeeBps(marketAcc: any, protocolAcc: any): number {
  const override = marketAcc.feeEntryBpsOverride
  return override !== null && override !== undefined
    ? (override as number)
    : (protocolAcc.defaultFeeEntryBps as number)
}

function settleFeeBps(marketAcc: any, protocolAcc: any): number {
  const override = marketAcc.feeSettleBpsOverride
  return override !== null && override !== undefined
    ? (override as number)
    : (protocolAcc.defaultFeeSettleBps as number)
}

/**
 * Compute `min_shares_out` for `place_wager` honoring the user's
 * configured slippage tolerance. Returns `BN(0)` (no protection) when
 * tolerance is 0 or the LMSR estimate is unavailable — the program
 * still validates and would surface a real on-chain error instead.
 */
function placeWagerMinSharesOut(
  marketAcc: any,
  protocolAcc: any,
  pathIndex: number,
  amountHuman: number,
): BN {
  return placeWagerQuoteFromSnapshot(
    marketAcc,
    readLmsrSnapshot(marketAcc),
    protocolAcc,
    pathIndex,
    amountHuman,
  ).minSharesOut
}

function placeWagerQuoteFromSnapshot(
  marketAcc: any,
  snap: LmsrSnapshot,
  protocolAcc: any,
  pathIndex: number,
  amountHuman: number,
): { minSharesOut: BN; expectedSharesHuman: number } {
  const tol = getSlippageTolerance()
  const feeBps = entryFeeBps(marketAcc, protocolAcc)
  const collateralHuman = amountHuman * (1 - feeBps / 10_000)
  const expected = estimateLmsrSharesOut({
    shareQuantities: snap.shareQuantities,
    numPaths: snap.numPaths,
    lmsrAlpha: snap.lmsrAlpha,
    pathIndex,
    amountScaled: collateralHuman,
    activeMask: snap.activeMask,
  })
  if (tol <= 0) return { minSharesOut: new BN(0), expectedSharesHuman: expected }
  const minHuman = applySlippageTolerance(expected, tol)
  return {
    minSharesOut: fixedPointFloorWithRoundingSlack(minHuman),
    expectedSharesHuman: expected,
  }
}

/**
 * Compute `min_payout_out` for `exit_position` against post-rake
 * proceeds. Mirrors the program's slippage check, which is enforced
 * on `user_payout` after the settlement rake. Returns `BN(0)` if
 * tolerance is 0 or the position has no shares to sell.
 */
function exitPositionMinPayoutOut(marketAcc: any, protocolAcc: any, positionAcc: any): BN {
  const tol = getSlippageTolerance()
  if (tol <= 0) return new BN(0)
  const sharesHuman = (positionAcc.lmsrShares as BN).toNumber() / SCALE
  if (sharesHuman <= 0) return new BN(0)
  const snap = readLmsrSnapshot(marketAcc)
  const feeBps = settleFeeBps(marketAcc, protocolAcc)
  const grossPayout = estimateLmsrExitPayout({
    shareQuantities: snap.shareQuantities,
    numPaths: snap.numPaths,
    lmsrAlpha: snap.lmsrAlpha,
    pathIndex: positionAcc.pathIndex as number,
    sharesScaled: sharesHuman,
    activeMask: snap.activeMask,
  })
  const userPayout = grossPayout * (1 - feeBps / 10_000)
  const minHuman = applySlippageTolerance(userPayout, tol)
  return fixedPointFloorWithRoundingSlack(minHuman)
}

/**
 * Map an Anchor-translated error (or a preflight code attached to an
 * Error via `.code`) into a user-facing string. Routes through the
 * shared `errorMap` so wager / exit / claim hooks all surface the
 * same wording for the same condition.
 */
function describeTxError(err: unknown, fallback: string): string {
  const e = err as {
    code?: string
    error?: { errorCode?: { code?: string } }
    message?: string
  }
  // Prefer the explicit `.code` (synthetic preflight failures attach
  // it directly), fall through to Anchor's translateError shape.
  const code = e?.code ?? e?.error?.errorCode?.code
  const decoded = lookupError(code)
  if (decoded) return formatDecoded(decoded)
  // Fallback regex covers the rare case where translateError didn't
  // populate `errorCode` but the raw message contains a known pattern.
  const msg = e?.message ?? ''
  if (/slippage exceeded/i.test(msg)) return formatDecoded(ERROR_MAP.SlippageExceeded)
  return msg || fallback
}

/* eslint-enable @typescript-eslint/no-explicit-any */

async function relayPathUpload(body: {
  market_id: number
  intent_pda: string
  user_pubkey: string
  nonce: number
  fixed_point_prices: number[]
}): Promise<RelayPathUploadResponse> {
  const baseUrl = env.APP_API_BASE_URL.replace(/\/$/, '')
  if (!baseUrl) {
    throw new Error('Path upload relayer is not configured')
  }
  const res = await fetch(`${baseUrl}/api/v1/path-uploads/relay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = payload?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : detail?.message ?? payload?.error ?? `Relayer failed with HTTP ${res.status}`
    throw new Error(message)
  }
  return payload as RelayPathUploadResponse
}

export function useAddPath() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      marketId,
      predictedPrices,
      numCheckpoints,
      onStatus,
      pathIndex: prefetchedIndex,
    }: AddPathInput) => {
      if (!program) throw new Error('Wallet not connected')

      const user = program.provider.publicKey!
      const [marketPda] = deriveMarketPda(marketId)

      let pathIndex: number
      if (prefetchedIndex !== undefined) {
        pathIndex = prefetchedIndex
      } else {
        const marketAcc = await program.account.market.fetch(marketPda)
        pathIndex = marketAcc.numPaths
      }

      const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000)
      const [pathUploadPda] = derivePathUploadPda(marketId, user, nonce)
      const fixedPointPrices = predictedPrices.map((p) => Math.round(p * SCALE))
      const chunks = await buildPathChunks(marketId, pathUploadPda, fixedPointPrices)
      const pathRoot = await computePathRoot(
        marketId,
        user,
        PATH_ORIGIN_USER_DRAWN,
        numCheckpoints,
        chunks.map((chunk) => chunk.chunkHash),
      )
      const expiresAt = Math.floor(Date.now() / 1000) + 600

      const params = {
        nonce: new BN(nonce),
        pathRoot: Array.from(pathRoot),
        numCheckpoints,
        initialProbabilityBps: 0,
        generationMethod: { userDrawn: {} },
        generationTimestamp: new BN(Math.floor(Date.now() / 1000)),
        expiresAt: new BN(expiresAt),
        relayFeeLamports: new BN(env.APP_PATH_UPLOAD_RELAY_FEE_LAMPORTS),
      }

      const ix = await program.methods
        .createPathUploadIntent(params)
        .accountsPartial({
          protocolState: deriveProtocolPda()[0],
          market: marketPda,
          pathUpload: pathUploadPda,
          creator: user,
          systemProgram: SystemProgram.programId,
        })
        .instruction()

      onStatus?.('authorizing')
      const intentSig = await sendInstructions(program, [ix], CU_LIMITS.createPathUploadIntent)
      onStatus?.('uploading')
      const intentPda = pathUploadPda.toBase58()
      let relay: RelayPathUploadResponse
      try {
        relay = await relayPathUpload({
          market_id: marketId,
          intent_pda: intentPda,
          user_pubkey: user.toBase58(),
          nonce,
          fixed_point_prices: fixedPointPrices,
        })
      } catch (err) {
        throw new PathRelayError((err as Error).message, {
          intentPda,
          nonce,
          expiresAt,
          intentSig,
        })
      }
      return { sig: relay.finalize_signature, intentSig, pathIndex: relay.path_index ?? pathIndex }
    },
    onSuccess: ({ sig }, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Path finalized on-chain', { txSig: sig })
    },
    onError: (err) => {
      if (err instanceof PathRelayError) return
      toast.error('Failed to create path', {
        message: describeTxError(err, 'Unknown error'),
      })
    },
  })
}

export function useCancelPathUpload() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ marketId, intentPda }: CancelPathUploadInput) => {
      if (!program) throw new Error('Wallet not connected')

      const user = program.provider.publicKey!
      const [marketPda] = deriveMarketPda(marketId)
      const pathUploadPda = new PublicKey(intentPda)
      const pathUpload = await program.account.pathUpload.fetch(pathUploadPda)
      const now = Math.floor(Date.now() / 1000)

      const chunksWrittenMask = Number(pathUpload.chunksWrittenMask)
      const chunksClosedMask = Number(pathUpload.chunksClosedMask)
      const chunkCount = Number(pathUpload.chunkCount)
      const expiresAt = pathUpload.expiresAt.toNumber()
      const cleanupIxs: TransactionInstruction[] = []

      if (chunksWrittenMask !== chunksClosedMask) {
        if (now <= expiresAt) {
          throw new Error('Upload has written chunks and can be cancelled after expiry.')
        }

        for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
          const needsCleanup =
            pathUploadBitIsSet(chunksWrittenMask, chunkIndex) &&
            !pathUploadBitIsSet(chunksClosedMask, chunkIndex)
          if (!needsCleanup) continue

          const [pathChunkPda] = derivePathChunkPda(pathUploadPda, chunkIndex)
          const pathChunk = await program.account.pathChunk.fetch(pathChunkPda)
          cleanupIxs.push(
            await program.methods
              .closeAbandonedPathChunk()
              .accountsPartial({
                market: marketPda,
                pathUpload: pathUploadPda,
                pathChunk: pathChunkPda,
                payer: pathChunk.payer,
              })
              .instruction(),
          )
        }
      }

      const ix = await program.methods
        .cancelPathUpload()
        .accountsPartial({
          market: marketPda,
          pathUpload: pathUploadPda,
          creator: user,
        })
        .instruction()

      const computeUnitLimit = Math.min(
        CU_LIMITS.cancelPathUpload + cleanupIxs.length * CU_LIMITS.closeAbandonedPathChunk,
        MAX_CU_PER_TX,
      )
      return sendInstructions(program, [...cleanupIxs, ix], computeUnitLimit)
    },
    onSuccess: (sig, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Path upload cancelled', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to cancel path upload', {
        message: describeTxError(err, 'Unknown error'),
      })
    },
  })
}

export function usePlaceWager() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ marketId, pathIndex, amount }: PlaceWagerInput) => {
      if (!program) throw new Error('Wallet not connected')

      const scaledAmount = new BN(Math.round(amount * SCALE))
      const user = program.provider.publicKey!

      const [protocolPda] = deriveProtocolPda()
      const [marketPda] = deriveMarketPda(marketId)
      const [pathPda] = derivePathPda(marketId, pathIndex)
      const [positionPda] = derivePositionPda(marketId, user, pathIndex)

      const [marketAcc, protocolAcc] = await Promise.all([
        program.account.market.fetch(marketPda),
        program.account.protocolState.fetch(protocolPda),
      ])

      const vault = marketAcc.vault
      const quoteMint = marketAcc.quoteMint
      const treasury = protocolAcc.treasury
      const insuranceFund = protocolAcc.insuranceFund
      const userTokenAccount = await getAssociatedTokenAddress(quoteMint, user)

      const minSharesOut = placeWagerMinSharesOut(marketAcc, protocolAcc, pathIndex, amount)

      const ix = await program.methods
        .placeWager(pathIndex, scaledAmount, minSharesOut)
        .accountsPartial({
          protocolState: protocolPda,
          market: marketPda,
          pathOutcome: pathPda,
          position: positionPda,
          vault,
          treasury,
          insuranceFund,
          userTokenAccount,
          user,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction()
      assertNoEigenCacheAccount(ix, marketId)

      return sendInstructions(program, [ix], CU_LIMITS.placeWager)
    },
    onSuccess: (sig, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPosition', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPositions'] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Position opened', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to open position', {
        message: describeTxError(err, 'Unknown error'),
      })
    },
  })
}

export function usePlaceBatchWager() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ marketId, pathIndices, amount }: PlaceBatchWagerInput) => {
      if (!program) throw new Error('Wallet not connected')
      if (pathIndices.length === 0) throw new Error('Select at least one path')
      if (pathIndices.length > MAX_BATCH_SIZE)
        throw new Error(`Maximum ${MAX_BATCH_SIZE} paths per transaction`)

      const scaledAmount = new BN(Math.round(amount * SCALE))
      const user = program.provider.publicKey!

      const [protocolPda] = deriveProtocolPda()
      const [marketPda] = deriveMarketPda(marketId)

      const [marketAcc, protocolAcc] = await Promise.all([
        program.account.market.fetch(marketPda),
        program.account.protocolState.fetch(protocolPda),
      ])

      const vault = marketAcc.vault
      const quoteMint = marketAcc.quoteMint
      const treasury = protocolAcc.treasury
      const insuranceFund = protocolAcc.insuranceFund
      const userTokenAccount = await getAssociatedTokenAddress(quoteMint, user)

      const quoteSnap = cloneLmsrSnapshot(readLmsrSnapshot(marketAcc))
      const ixs: TransactionInstruction[] = []
      for (const pathIndex of pathIndices) {
        const [pathPda] = derivePathPda(marketId, pathIndex)
        const [positionPda] = derivePositionPda(marketId, user, pathIndex)
        const { minSharesOut, expectedSharesHuman } = placeWagerQuoteFromSnapshot(
          marketAcc,
          quoteSnap,
          protocolAcc,
          pathIndex,
          amount,
        )
        if (Number.isFinite(expectedSharesHuman) && expectedSharesHuman > 0) {
          quoteSnap.shareQuantities[pathIndex] =
            (quoteSnap.shareQuantities[pathIndex] ?? 0) + expectedSharesHuman
        }

        const ix = await program.methods
          .placeWager(pathIndex, scaledAmount, minSharesOut)
          .accountsPartial({
            protocolState: protocolPda,
            market: marketPda,
            pathOutcome: pathPda,
            position: positionPda,
            vault,
            treasury,
            insuranceFund,
            userTokenAccount,
            user,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
        assertNoEigenCacheAccount(ix, marketId)
        ixs.push(ix)
      }

      const computeUnitLimit = Math.min(CU_LIMITS.placeWager * pathIndices.length, MAX_CU_PER_TX)
      return sendInstructions(program, ixs, computeUnitLimit)
    },
    onSuccess: (sig, { marketId, pathIndices }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPosition', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPositions'] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      const label =
        pathIndices.length === 1 ? 'Position opened' : `${pathIndices.length} positions opened`
      toast.success(label, { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to open positions', {
        message: describeTxError(err, 'Unknown error'),
      })
    },
  })
}

export function useExitPosition() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ marketId, pathIndex }: PositionInput) => {
      if (!program) throw new Error('Wallet not connected')

      const user = program.provider.publicKey!
      const [protocolPda] = deriveProtocolPda()
      const [marketPda] = deriveMarketPda(marketId)
      const [pathPda] = derivePathPda(marketId, pathIndex)
      const [positionPda] = derivePositionPda(marketId, user, pathIndex)

      const [marketAcc, protocolAcc, positionAcc] = await Promise.all([
        program.account.market.fetch(marketPda),
        program.account.protocolState.fetch(protocolPda),
        program.account.position.fetch(positionPda),
      ])
      const vault = marketAcc.vault
      const quoteMint = marketAcc.quoteMint
      const userTokenAccount = await getAssociatedTokenAddress(quoteMint, user)

      const minPayoutOut = exitPositionMinPayoutOut(marketAcc, protocolAcc, positionAcc)

      const ix = await program.methods
        .exitPosition(minPayoutOut)
        .accountsPartial({
          market: marketPda,
          pathOutcome: pathPda,
          position: positionPda,
          vault,
          userTokenAccount,
          user,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
      assertNoEigenCacheAccount(ix, marketId)

      return sendInstructions(program, [ix], CU_LIMITS.exitPosition)
    },
    onSuccess: (sig, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPosition', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPositions'] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Position closed', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to close position', {
        message: describeTxError(err, 'Unknown error'),
      })
    },
  })
}

export function useClaim() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ marketId, pathIndex }: PositionInput) => {
      if (!program) throw new Error('Wallet not connected')

      const user = program.provider.publicKey!
      const [protocolPda] = deriveProtocolPda()
      const [marketPda] = deriveMarketPda(marketId)
      const [pathPda] = derivePathPda(marketId, pathIndex)
      const [positionPda] = derivePositionPda(marketId, user, pathIndex)

      const [marketAcc, protocolAcc] = await Promise.all([
        program.account.market.fetch(marketPda),
        program.account.protocolState.fetch(protocolPda),
      ])

      const vault = marketAcc.vault
      const quoteMint = marketAcc.quoteMint
      const treasury = protocolAcc.treasury
      const insuranceFund = protocolAcc.insuranceFund
      const userTokenAccount = await getAssociatedTokenAddress(quoteMint, user)

      const ix = await program.methods
        .claim()
        .accountsPartial({
          protocolState: protocolPda,
          market: marketPda,
          pathOutcome: pathPda,
          position: positionPda,
          vault,
          userTokenAccount,
          treasury,
          insuranceFund,
          user,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()

      return sendInstructions(program, [ix], CU_LIMITS.claim)
    },
    onSuccess: (sig, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPosition', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPositions'] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Payout claimed', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to claim', { message: (err as Error).message })
    },
  })
}

export function useCloseMarket() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ marketId, vault }: MarketInput) => {
      if (!program) throw new Error('Wallet not connected')

      const authority = program.provider.publicKey!
      const [protocolPda] = deriveProtocolPda()
      const [marketPda] = deriveMarketPda(marketId)
      const vaultPda =
        typeof vault === 'string'
          ? new PublicKey(vault)
          : vault ?? (await program.account.market.fetch(marketPda)).vault

      const ix = await program.methods
        .closeMarket()
        .accountsPartial({
          protocolState: protocolPda,
          market: marketPda,
          vault: vaultPda,
          authority,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()

      return sendInstructions(program, [ix], CU_LIMITS.closeMarket)
    },
    onSuccess: (sig, { marketId }) => {
      queryClient.removeQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      queryClient.invalidateQueries({ queryKey: ['userPositions'] })
      toast.success('Market closed', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to close market', {
        message: describeTxError(err, 'Unknown error'),
      })
    },
  })
}
