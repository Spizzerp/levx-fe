/**
 * Transaction hooks for user-signed instructions:
 *   - add_path(params)
 *   - place_wager(path_index, amount)
 *   - place_batch_wager(path_indices[], amount)
 *   - exit_position()
 *   - claim()
 *
 * Each returns a TanStack Query useMutation with typed inputs.
 * Account addresses (vault, treasury, insurance) are fetched from on-chain
 * state at call time — no hardcoded addresses.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BN } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { SystemProgram, Transaction } from '@solana/web3.js'

import { useProgram } from './program'
import { SCALE } from '@/lib/constants'
import { toast } from '@/stores/toastStore'
import { deriveMarketPda, derivePathPda, derivePositionPda, deriveProtocolPda } from './pda'
import { buildTransaction } from '@/lib/chain/buildTransaction'

const MAX_BATCH_SIZE = 4

interface AddPathInput {
  marketId: number
  predictedPrices: number[]
  numCheckpoints: number
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

export function useAddPath() {
  const program = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ marketId, predictedPrices, numCheckpoints }: AddPathInput) => {
      if (!program) throw new Error('Wallet not connected')

      const user = program.provider.publicKey!
      const [marketPda] = deriveMarketPda(marketId)

      const marketAcc = await (program.account as any).market.fetch(marketPda)
      const pathIndex: number = marketAcc.numPaths

      const [pathOutcomePda] = derivePathPda(marketId, pathIndex)

      const params = {
        predictedPrices: predictedPrices.map((p) => new BN(Math.round(p * SCALE))),
        numCheckpoints,
        initialProbabilityBps: 0,
        generationMethod: { userDrawn: {} },
        generationTimestamp: new BN(Math.floor(Date.now() / 1000)),
      }

      const sig = await (program.methods as any)
        .addPath(params)
        .accounts({
          market: marketPda,
          pathOutcome: pathOutcomePda,
          creator: user,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      return { sig: sig as string, pathIndex }
    },
    onSuccess: ({ sig, pathIndex: _ }, { marketId }) => {
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

      // Fetch on-chain accounts for vault/treasury/insurance addresses
      const [marketAcc, protocolAcc] = await Promise.all([
        (program.account as any).market.fetch(marketPda),
        (program.account as any).protocolState.fetch(protocolPda),
      ])

      const vault = marketAcc.vault
      const quoteMint = marketAcc.quoteMint
      const treasury = protocolAcc.treasury
      const insuranceFund = protocolAcc.insuranceFund
      const userTokenAccount = await getAssociatedTokenAddress(quoteMint, user)

      const sig = await (program.methods as any)
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
        .rpc()

      return sig as string
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
        (program.account as any).market.fetch(marketPda),
        (program.account as any).protocolState.fetch(protocolPda),
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

          return (program.methods as any)
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

      const finalIxs = await buildTransaction({ instructions: ixs })
      const tx = new Transaction().add(...finalIxs)
      const sig = await (program.provider as any).sendAndConfirm(tx)

      return sig as string
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

      const marketAcc = await (program.account as any).market.fetch(marketPda)
      const vault = marketAcc.vault
      const quoteMint = marketAcc.quoteMint
      const userTokenAccount = await getAssociatedTokenAddress(quoteMint, user)

      const sig = await (program.methods as any)
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
        .rpc()

      return sig as string
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
        (program.account as any).market.fetch(marketPda),
        (program.account as any).protocolState.fetch(protocolPda),
      ])

      const vault = marketAcc.vault
      const quoteMint = marketAcc.quoteMint
      const treasury = protocolAcc.treasury
      const insuranceFund = protocolAcc.insuranceFund
      const userTokenAccount = await getAssociatedTokenAddress(quoteMint, user)

      const sig = await (program.methods as any)
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
        .rpc()

      return sig as string
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
