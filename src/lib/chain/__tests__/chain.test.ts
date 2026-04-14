import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import * as chainApi from '@/lib/chain'
import * as mockHooks from '@/lib/api/hooks'

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('src/lib/chain public API', () => {
  it('re-exports useMarkets with the same signature as src/lib/api/hooks (MARKET-06)', () => {
    expect(chainApi.useMarkets).toBe(mockHooks.useMarkets)
  })

  it('re-exports useMarket with the same signature as src/lib/api/hooks (MARKET-06)', () => {
    expect(chainApi.useMarket).toBe(mockHooks.useMarket)
  })

  it('re-exports useUserPosition with the same signature as src/lib/api/hooks (MARKET-06)', () => {
    expect(chainApi.useUserPosition).toBe(mockHooks.useUserPosition)
  })

  it('useMarkets in Phase 2 delegates to the mock implementation and returns mock data shape', async () => {
    const { result } = renderHook(() => chainApi.useMarkets(), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data!.length).toBeGreaterThan(0)
    const first = result.current.data![0]
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('pair')
    expect(first).toHaveProperty('state')
  })

  it('useMarket in Phase 2 delegates to the mock implementation', async () => {
    const { result } = renderHook(() => chainApi.useMarket('btc'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeDefined()
    expect(result.current.data!.id).toBe('btc')
  })

  it('exports AnchorProgramProvider and useAnchorProgram from index', () => {
    expect(typeof chainApi.AnchorProgramProvider).toBe('function')
    expect(typeof chainApi.useAnchorProgram).toBe('function')
  })
})
