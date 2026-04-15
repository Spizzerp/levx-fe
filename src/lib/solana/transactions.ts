/**
 * Transaction hooks for user-signed instructions:
 *   - place_wager(path_index, amount)
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
import { SystemProgram } from '@solana/web3.js'

import { useProgram } from './program'
import { SCALE } from '@/lib/constants'
import { deriveMarketPda, derivePathPda, derivePositionPda, deriveProtocolPda } from './pda'

interface PlaceWagerInput {
  marketId: number
  pathIndex: number
  /** USDC amount in user-facing decimals (e.g. 25.0) */
  amount: number
}

interface PositionInput {
  marketId: number
  pathIndex: number
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
    onSuccess: (_sig, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPosition', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
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
    onSuccess: (_sig, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPosition', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
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
    onSuccess: (_sig, { marketId }) => {
      queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['userPosition', String(marketId)] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
    },
  })
}
