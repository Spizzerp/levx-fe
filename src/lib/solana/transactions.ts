/**
 * Transaction hooks for user-signed instructions:
 *   - add_path(params)
 *   - place_wager(path_index, amount)
 *   - place_batch_wager(path_indices[], amount)
 *   - exit_position()
 *   - claim()
 *
 * Every mutation builds instructions manually, routes through
 * buildTransaction (compute-unit limit + dynamic priority fee), and
 * sends via AnchorProvider.sendAndConfirm. Account addresses (vault,
 * treasury, insurance) are fetched from on-chain state at call time —
 * no hardcoded addresses.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AnchorProvider,
  BN,
  parseIdlErrors,
  Program,
  translateError,
} from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { SystemProgram, Transaction, type TransactionInstruction } from '@solana/web3.js'

import type { Levx } from '@/idl/levx'
import { useProgram } from './program'
import { CU_LIMITS, MAX_CU_PER_TX, SCALE } from '@/lib/constants'
import { toast } from '@/stores/toastStore'
import { deriveMarketPda, derivePathPda, derivePositionPda, deriveProtocolPda } from './pda'
import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'

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
    throw translateError(err, parseIdlErrors(program.idl))
  }
}

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
        .accounts({
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
      toast.error('Failed to create path', { message: (err as Error).message })
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

      const ix = await program.methods
        .placeWager(pathIndex, scaledAmount)
        .accounts({
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
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Position opened', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to open position', { message: (err as Error).message })
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

          return program.methods
            .placeWager(pathIndex, scaledAmount)
            .accounts({
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
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      const label = pathIndices.length === 1 ? 'Position opened' : `${pathIndices.length} positions opened`
      toast.success(label, { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to open positions', { message: (err as Error).message })
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
      const [marketPda] = deriveMarketPda(marketId)
      const [pathPda] = derivePathPda(marketId, pathIndex)
      const [positionPda] = derivePositionPda(marketId, user, pathIndex)

      const marketAcc = await program.account.market.fetch(marketPda)
      const vault = marketAcc.vault
      const quoteMint = marketAcc.quoteMint
      const userTokenAccount = await getAssociatedTokenAddress(quoteMint, user)

      const ix = await program.methods
        .exitPosition()
        .accounts({
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
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Position closed', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to close position', { message: (err as Error).message })
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
        .accounts({
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
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Payout claimed', { txSig: sig })
    },
    onError: (err) => {
      toast.error('Failed to claim', { message: (err as Error).message })
    },
  })
}
