import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: heartbeatRef.current, error: null }),
        }),
      }),
    }),
  }),
}))

import { KeeperHealthDot } from '@/features/wallet/KeeperHealthDot'

const heartbeatRef: { current: { updated_at: string } | null } = { current: null }

function withQueryClient(node: React.ReactNode): React.ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  })
  return React.createElement(QueryClientProvider, { client }, node) as React.ReactElement
}

function setHeartbeat(secondsAgo: number | null) {
  heartbeatRef.current =
    secondsAgo === null ? null : { updated_at: new Date(Date.now() - secondsAgo * 1000).toISOString() }
}

describe('KeeperHealthDot', () => {
  it('renders nothing while loading / on null heartbeat', async () => {
    setHeartbeat(null)
    const { container } = render(withQueryClient(<KeeperHealthDot />))
    // No status label until the row resolves.
    await waitFor(() => {
      expect(screen.queryByText(/Keeper/)).not.toBeInTheDocument()
    })
    expect(container.querySelector('span')).toBeNull()
  })

  it('shows green when last heartbeat is fresh (≤ 60s)', async () => {
    setHeartbeat(15)
    render(withQueryClient(<KeeperHealthDot />))
    expect(await screen.findByText(/Keeper online/i)).toBeInTheDocument()
  })

  it('shows amber when last heartbeat is stale (60s–5m)', async () => {
    setHeartbeat(120)
    render(withQueryClient(<KeeperHealthDot />))
    expect(await screen.findByText(/Keeper stale/i)).toBeInTheDocument()
  })

  it('shows red when last heartbeat is old enough to flag offline (> 5m)', async () => {
    setHeartbeat(15 * 60)
    render(withQueryClient(<KeeperHealthDot />))
    expect(await screen.findByText(/Keeper offline/i)).toBeInTheDocument()
  })
})
