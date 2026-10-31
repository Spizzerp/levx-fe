/**
 * The price each checkpoint settled on, read from the market's `PriceSample` accounts.
 *
 * The keeper closes these accounts at finalize, so a finalized market returns none.
 */

import { useQuery } from '@tanstack/react-query'

import { SCALE } from '@/lib/constants'
import { deriveSamplePda } from '@/lib/solana/pda'
import { getReadOnlyProgram } from '@/lib/solana/program'

export interface CheckpointPrice {
  /** 0-based checkpoint index */
  index: number
  /** unix ms — `PriceSample.timestamp × 1000` */
  time: number
  price: number
}

const NO_CHECKPOINT_PRICES: CheckpointPrice[] = []

/** Settled prices for checkpoints `0 … completed − 1`; closed sample accounts are skipped. */
export async function fetchCheckpointPrices(
  marketId: number,
  completed: number,
): Promise<CheckpointPrice[]> {
  if (completed <= 0) return []
  const addresses = Array.from({ length: completed }, (_, i) => deriveSamplePda(marketId, i)[0])
  const samples = await getReadOnlyProgram().account.priceSample.fetchMultiple(addresses)
  return samples.flatMap((sample, index) =>
    sample
      ? [
          {
            index,
            time: sample.timestamp.toNumber() * 1000,
            price: sample.price.toNumber() / SCALE,
          },
        ]
      : [],
  )
}

/** The market query refetches on `CheckpointSampled`, which changes `completed` and so the key. */
export function useCheckpointPrices(marketId: number | null, completed: number): CheckpointPrice[] {
  const { data } = useQuery({
    queryKey: ['checkpoint-prices', marketId, completed],
    queryFn: () => fetchCheckpointPrices(marketId!, completed),
    enabled: marketId !== null && completed > 0,
    // A settled sample never changes; a new checkpoint arrives under a new key.
    staleTime: Infinity,
  })
  return data ?? NO_CHECKPOINT_PRICES
}
