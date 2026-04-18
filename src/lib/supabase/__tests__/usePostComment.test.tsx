import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { usePostComment } from '../hooks'
import { mockFrom, __resetSupabaseMock } from '../__mocks__/supabase-js'

function wrapper({ children }: PropsWithChildren) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockInsertReturning(row: unknown, error: unknown = null) {
  return {
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: row, error }),
      }),
    }),
  }
}

describe('usePostComment', () => {
  beforeEach(() => {
    __resetSupabaseMock()
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReset()
  })

  it('success path: mutation returns the new row', async () => {
    const row = { id: '1', market_id: 'btc', wallet: 'A', body: 'hi', created_at: 'now', edited_at: null }
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockInsertReturning(row))
    const { result } = renderHook(() => usePostComment('btc', 'A'), { wrapper })
    result.current.mutate({ body: 'hi' })
    await waitFor(() => expect(result.current.data?.body).toBe('hi'))
  })

  it('rate-limit P0001 surfaces a rate_limit error', async () => {
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockInsertReturning(null, { code: 'P0001', message: 'rate_limit_cooldown' }),
    )
    const { result } = renderHook(() => usePostComment('btc', 'A'), { wrapper })
    result.current.mutate({ body: 'spam' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/rate_limit/)
  })

  it('RLS rejection (42501) surfaces a permission error', async () => {
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockInsertReturning(null, { code: '42501', message: 'permission denied' }),
    )
    const { result } = renderHook(() => usePostComment('btc', 'A'), { wrapper })
    result.current.mutate({ body: 'spoof' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/permission/)
  })
})
