import { BN } from '@coral-xyz/anchor'
import { describe, expect, it, vi } from 'vitest'

// The real deriveSamplePda fails under jsdom (cross-realm Uint8Array check), so it is
// replaced by a fake that names each address after the requested index.
vi.mock('@/lib/solana/pda', () => ({
  deriveSamplePda: vi.fn((marketId: number, checkpointIndex: number) => [
    `sample-${marketId}-${checkpointIndex}`,
    255,
  ]),
}))

const fetchMultiple = vi.hoisted(() => vi.fn())
vi.mock('@/lib/solana/program', () => ({
  getReadOnlyProgram: () => ({ account: { priceSample: { fetchMultiple } } }),
}))

import { fetchCheckpointPrices } from '@/lib/api/checkpointPrices'
import { deriveSamplePda } from '@/lib/solana/pda'

function sample(checkpointIndex: number, timestampSec: number, price: number) {
  return {
    checkpointIndex,
    timestamp: new BN(timestampSec),
    price: new BN(price),
    confidence: new BN(10_000),
    lowConfidence: false,
  }
}

describe('fetchCheckpointPrices', () => {
  it('converts samples to ms and scaled prices and skips closed accounts', async () => {
    fetchMultiple.mockResolvedValue([
      sample(0, 1_700_000_000, 95_410_000),
      null,
      sample(2, 1_700_003_600, 96_000_000),
    ])

    const prices = await fetchCheckpointPrices(7, 3)

    expect(vi.mocked(deriveSamplePda).mock.calls).toEqual([
      [7, 0],
      [7, 1],
      [7, 2],
    ])
    expect(fetchMultiple).toHaveBeenCalledWith(['sample-7-0', 'sample-7-1', 'sample-7-2'])
    expect(prices).toEqual([
      { index: 0, time: 1_700_000_000_000, price: 95.41 },
      { index: 2, time: 1_700_003_600_000, price: 96 },
    ])
  })
})
