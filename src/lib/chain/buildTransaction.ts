import { ComputeBudgetProgram, type TransactionInstruction } from '@solana/web3.js'

export interface BuildTransactionOptions {
  instructions: TransactionInstruction[]
  computeUnitLimit?: number
  priorityFeeMicroLamports?: number
}

/**
 * Prepends ComputeBudgetProgram instructions (CU limit, then CU price) to the
 * caller's instructions when the corresponding options are provided. Either
 * knob may be omitted; if both are omitted the instructions pass through
 * unchanged.
 */
export async function buildTransaction(
  opts: BuildTransactionOptions,
): Promise<TransactionInstruction[]> {
  const prefix: TransactionInstruction[] = []
  if (opts.computeUnitLimit !== undefined) {
    prefix.push(ComputeBudgetProgram.setComputeUnitLimit({ units: opts.computeUnitLimit }))
  }
  if (opts.priorityFeeMicroLamports !== undefined) {
    prefix.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: opts.priorityFeeMicroLamports,
      }),
    )
  }
  return [...prefix, ...opts.instructions]
}
