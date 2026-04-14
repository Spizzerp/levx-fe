import type { TransactionInstruction } from '@solana/web3.js'

export interface BuildTransactionOptions {
  instructions: TransactionInstruction[]
  computeUnitLimit?: number
  priorityFeeMicroLamports?: number
}

/**
 * Phase 2 shell — returns instructions unchanged.
 * Phase 4: prepend ComputeBudgetProgram.setComputeUnitLimit +
 *          ComputeBudgetProgram.setComputeUnitPrice instructions before signing.
 * The shape is frozen in Phase 2 so Phase 4 wiring is a single-file change.
 */
export async function buildTransaction(
  opts: BuildTransactionOptions,
): Promise<TransactionInstruction[]> {
  // TODO Phase 4: prepend compute unit + priority fee instructions.
  return opts.instructions
}
