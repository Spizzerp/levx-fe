import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { __resetPriorityFeeCacheForTest, getPriorityFee } from '@/lib/chain/priorityFee'

function makeConnection(
  impl: () => Promise<{ slot: number; prioritizationFee: number }[]>,
): Connection {
  return { getRecentPrioritizationFees: impl } as unknown as Connection
}

afterEach(() => {
  __resetPriorityFeeCacheForTest()
})

describe('getPriorityFee', () => {
  it('returns the 75th percentile of sampled fees', async () => {
    // 100 samples 0..99 → p75 at index Math.floor(100*0.75) = 75 → value 75
    const samples = Array.from({ length: 100 }, (_, i) => ({ slot: i, prioritizationFee: i }))
    const conn = makeConnection(async () => samples)
    const fee = await getPriorityFee(conn)
    expect(fee).toBe(10_000) // 75 is below FALLBACK_MICROLAMPORTS so floor kicks in
  })

  it('uses p75 when it exceeds the fallback floor', async () => {
    // 20 samples 20_000..21_900 (step 100) → p75 at index 15 → 21_500
    const samples = Array.from({ length: 20 }, (_, i) => ({
      slot: i,
      prioritizationFee: 20_000 + i * 100,
    }))
    const conn = makeConnection(async () => samples)
    const fee = await getPriorityFee(conn)
    expect(fee).toBe(21_500)
  })

  it('falls back when the RPC returns an empty array', async () => {
    const conn = makeConnection(async () => [])
    const fee = await getPriorityFee(conn)
    expect(fee).toBe(10_000)
  })

  it('falls back when the RPC throws', async () => {
    const conn = makeConnection(async () => {
      throw new Error('rpc down')
    })
    const fee = await getPriorityFee(conn)
    expect(fee).toBe(10_000)
  })

  it('caches successive calls within the TTL window', async () => {
    const spy = vi.fn(async () => [
      { slot: 0, prioritizationFee: 30_000 },
      { slot: 1, prioritizationFee: 30_000 },
    ])
    const conn = makeConnection(spy)
    const first = await getPriorityFee(conn)
    const second = await getPriorityFee(conn)
    expect(first).toBe(30_000)
    expect(second).toBe(30_000)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
