import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useComments } from '../hooks'
import { mockFrom, __emitRealtime, __resetSupabaseMock } from '../__mocks__/supabase-js'

function wrapper({ children }: PropsWithChildren) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockSelectChain(rows: unknown[]) {
  return {
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  }
}

describe('useComments', () => {
  beforeEach(() => {
    __resetSupabaseMock()
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReset()
  })

  it('fetches initial comments', async () => {
    const rows = [
      { id: '1', market_id: 'btc', wallet: 'A', body: 'hi', created_at: '2026-04-17T00:00:00Z', edited_at: null },
    ]
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockSelectChain(rows))
    const { result } = renderHook(() => useComments('btc'), { wrapper })
    await waitFor(() => expect(result.current.data?.length).toBe(1))
    expect(result.current.data?.[0].body).toBe('hi')
  })

  it('realtime INSERT with new id prepends to cache', async () => {
    const initial = [
      { id: '1', market_id: 'btc', wallet: 'A', body: 'first', created_at: '2026-04-17T00:00:00Z', edited_at: null },
    ]
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockSelectChain(initial))
    const { result } = renderHook(() => useComments('btc'), { wrapper })
    await waitFor(() => expect(result.current.data?.length).toBe(1))

    act(() => {
      __emitRealtime('comments:btc', 'INSERT', {
        new: { id: '2', market_id: 'btc', wallet: 'B', body: 'second', created_at: '2026-04-17T00:01:00Z', edited_at: null },
      })
    })
    await waitFor(() => expect(result.current.data?.length).toBe(2))
    expect(result.current.data?.[0].id).toBe('2')
  })

  it('realtime INSERT with existing id does NOT duplicate', async () => {
    const initial = [
      { id: '1', market_id: 'btc', wallet: 'A', body: 'first', created_at: '2026-04-17T00:00:00Z', edited_at: null },
    ]
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockSelectChain(initial))
    const { result } = renderHook(() => useComments('btc'), { wrapper })
    await waitFor(() => expect(result.current.data?.length).toBe(1))

    act(() => {
      __emitRealtime('comments:btc', 'INSERT', { new: initial[0] })
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current.data?.length).toBe(1)
  })
})
