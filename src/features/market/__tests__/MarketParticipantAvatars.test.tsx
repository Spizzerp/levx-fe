import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { formatUSD } from '@/lib/format'

const useMarketParticipantsMock = vi.hoisted(() => vi.fn())
const useProfilesMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/market/useMarketParticipants', () => ({
  useMarketParticipants: useMarketParticipantsMock,
}))

vi.mock('@/lib/supabase/hooks', () => ({
  useProfiles: useProfilesMock,
  getProfileImageUrl: (path: string | null) => (path ? `https://mock-storage/${path}` : null),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    search,
    ...rest
  }: {
    children: ReactNode
    to: string
    className?: string
    search?: Record<string, unknown>
  }) => {
    const searchString = search
      ? new URLSearchParams(
          Object.entries(search).flatMap(([key, value]) =>
            value == null ? [] : [[key, String(value)]],
          ),
        ).toString()
      : ''
    return (
      <a href={`${to}${searchString ? `?${searchString}` : ''}`} className={className} {...rest}>
        {children}
      </a>
    )
  },
}))

import { MarketParticipantAvatars } from '@/features/market/MarketParticipantAvatars'

describe('MarketParticipantAvatars', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfilesMock.mockReturnValue({ data: {} })
    useMarketParticipantsMock.mockReturnValue({
      data: { participants: [], totalParticipants: 0 },
      isLoading: false,
      error: null,
    })
  })

  it('does not render when Supabase has no participant aggregate rows', () => {
    render(<MarketParticipantAvatars marketIdNum={49} traderCount={0} />)

    expect(useMarketParticipantsMock).toHaveBeenCalledWith(null)
    expect(screen.queryByLabelText(/more participants?/i)).not.toBeInTheDocument()
  })

  it('renders top participants with profile links and distinct overflow count', async () => {
    const user = userEvent.setup()
    useMarketParticipantsMock.mockReturnValue({
      data: {
        totalParticipants: 8,
        participants: [
          participant('wallet-a', 100, 12),
          participant('wallet-b', 90, 8),
          participant('wallet-c', 80, 4),
          participant('wallet-d', 70, 2),
          participant('wallet-e', 60, -1),
          participant('wallet-f', 50, -2),
        ],
      },
      isLoading: false,
      error: null,
    })
    useProfilesMock.mockReturnValue({
      data: {
        'wallet-a': {
          wallet_address: 'wallet-a',
          display_name: 'Alice',
          username: 'alice',
          avatar_kind: 'sigil',
          avatar_sigil_idx: 1,
        },
      },
    })

    render(<MarketParticipantAvatars marketIdNum={49} traderCount={8} />)

    expect(screen.getByLabelText('Alice')).toHaveAttribute('href', '/profile?wallet=wallet-a')
    expect(screen.getByLabelText('wallet-b')).toBeInTheDocument()
    expect(screen.queryByLabelText('wallet-f')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('3 more participants'))
    const exposureLabel = screen.getAllByText(/exposure/i)[0]
    expect(exposureLabel).toHaveTextContent(formatUSD(100))
    expect(exposureLabel).toHaveTextContent('exposure')
  })
})

function participant(wallet: string, exposure: number, pnl: number) {
  return {
    market_id: 49,
    wallet,
    collateral: exposure / 2,
    exposure,
    pnl,
    positions: 1,
    updated_at: '2026-05-16T00:00:00Z',
  }
}
