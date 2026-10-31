import { BN } from '@coral-xyz/anchor'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

import { fetchCheckpointPrices, useCheckpointPrices } from '@/lib/api/checkpointPrices'
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

describe('useCheckpointPrices', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function renderPrices() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCheckpointPrices(7, 1), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children),
    })
    return {
      ...hook,
      fetchStatus: () => client.getQueryState(['checkpoint-prices', 7, 1])?.fetchStatus,
    }
  }

  it('does not read the chain in mock mode', () => {
    vi.stubEnv('APP_USE_MOCK', 'true')
    fetchMultiple.mockReset().mockResolvedValue([sample(0, 1_700_000_000, 95_410_000)])

    const { result, fetchStatus } = renderPrices()

    // An enabled query is already fetching once mounted; this one never starts.
    expect(fetchStatus()).toBe('idle')
    expect(fetchMultiple).not.toHaveBeenCalled()
    expect(result.current).toEqual([])
  })

  it('reads the sample accounts otherwise', async () => {
    vi.stubEnv('APP_USE_MOCK', 'false')
    fetchMultiple.mockReset().mockResolvedValue([sample(0, 1_700_000_000, 95_410_000)])

    const { result, fetchStatus } = renderPrices()

    expect(fetchStatus()).toBe('fetching')
    await waitFor(() =>
      expect(result.current).toEqual([{ index: 0, time: 1_700_000_000_000, price: 95.41 }]),
    )
    expect(fetchMultiple).toHaveBeenCalledOnce()
  })
})
