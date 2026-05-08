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
import { toast } from '@/stores/toastStore'
import { getSlippageTolerance } from '@/stores/slippageStore'
import { ERROR_MAP, formatDecoded, lookupError } from './errorMap'
import { logTransactionError } from './logTransactionError'
import { deriveMarketPda, derivePathPda, derivePositionPda, deriveProtocolPda } from './pda'
import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'
import { applySlippageFloor, estimateLmsrExitPayout, estimateLmsrSharesOut } from './lmsr'

const MAX_BATCH_SIZE = 4

interface AddPathInput {
  marketId: number
  predictedPrices: number[]
  numCheckpoints: number
  /**
   * Optional pre-fetched path index. When the caller has already read
   * `market.numPaths` (e.g. to show an optimistic pending row), passing
   * it here avoids a second RPC hop inside the mutation.
   */
  pathIndex?: number
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
  const amplitudes = (marketAcc.amplitudes as BN[]).slice(0, numPaths).map((a) => a.toNumber())
  const activeMask = amplitudes.map((a) => a > 0)
  const lmsrAlpha = (marketAcc.lmsrAlpha as BN).toNumber() / SCALE
  return { numPaths, shareQuantities, lmsrAlpha, activeMask }
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
  const tol = getSlippageTolerance()
  if (tol <= 0) return new BN(0)
  const snap = readLmsrSnapshot(marketAcc)
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
  const minHuman = applySlippageFloor(expected, tol)
  return new BN(Math.floor(minHuman * SCALE))
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
  const minHuman = applySlippageFloor(userPayout, tol)
  return new BN(Math.floor(minHuman * SCALE))
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

export function useAddPath() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      marketId,
      predictedPrices,
      numCheckpoints,
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

      const [pathOutcomePda] = derivePathPda(marketId, pathIndex)

      const params = {
        predictedPrices: predictedPrices.map((p) => new BN(Math.round(p * SCALE))),
        numCheckpoints,
        initialProbabilityBps: 0,
        generationMethod: { userDrawn: {} },
        generationTimestamp: new BN(Math.floor(Date.now() / 1000)),
      }

      const ix = await program.methods
        .addPath(params)
        .accountsPartial({
          market: marketPda,
          pathOutcome: pathOutcomePda,
          creator: user,
          systemProgram: SystemProgram.programId,
        })
        .instruction()

      const sig = await sendInstructions(program, [ix], CU_LIMITS.addPath)
      return { sig, pathIndex }
    },
    onSuccess: ({ sig }, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Path created on-chain', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to create path', {
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

      const ixs = await Promise.all(
        pathIndices.map(async (pathIndex) => {
          const [pathPda] = derivePathPda(marketId, pathIndex)
          const [positionPda] = derivePositionPda(marketId, user, pathIndex)
          const minSharesOut = placeWagerMinSharesOut(marketAcc, protocolAcc, pathIndex, amount)

          return program.methods
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
        }),
      )

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
