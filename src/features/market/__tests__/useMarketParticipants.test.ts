import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ from: fromMock }),
}))

import { getMarketParticipants } from '@/features/market/useMarketParticipants'

describe('getMarketParticipants', () => {
  let query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(),
    }
    fromMock.mockReturnValue(query)
  })

  it('reads top participants and exact distinct count from Supabase', async () => {
    query.limit.mockResolvedValue({
      data: [
        {
          market_id: 49,
          wallet: 'wallet-a',
          collateral: '50',
          exposure: '100',
          pnl: '12.5',
          positions: 2,
          updated_at: '2026-05-16T00:00:00Z',
        },
      ],
      error: null,
      count: 17,
    })

    const result = await getMarketParticipants(49)

    expect(fromMock).toHaveBeenCalledWith('market_participants')
    expect(query.select).toHaveBeenCalledWith(
      'market_id, wallet, collateral, exposure, pnl, positions, updated_at',
      { count: 'exact' },
    )
    expect(query.eq).toHaveBeenCalledWith('market_id', 49)
    expect(query.order).toHaveBeenNthCalledWith(1, 'exposure', { ascending: false })
    expect(query.order).toHaveBeenNthCalledWith(2, 'collateral', { ascending: false })
    expect(query.order).toHaveBeenNthCalledWith(3, 'wallet', { ascending: true })
    expect(query.limit).toHaveBeenCalledWith(5)
    expect(result).toEqual({
      participants: [
        {
          market_id: 49,
          wallet: 'wallet-a',
          collateral: 50,
          exposure: 100,
          pnl: 12.5,
          positions: 2,
          updated_at: '2026-05-16T00:00:00Z',
        },
      ],
      totalParticipants: 17,
    })
  })

  it('falls back to returned row count when Supabase omits count', async () => {
    query.limit.mockResolvedValue({
      data: [
        { market_id: 49, wallet: 'wallet-a' },
        { market_id: 49, wallet: 'wallet-b' },
      ],
      error: null,
      count: null,
    })

    await expect(getMarketParticipants(49)).resolves.toMatchObject({
      totalParticipants: 2,
    })
  })

  it('throws Supabase errors', async () => {
    query.limit.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
      count: null,
    })

    await expect(getMarketParticipants(49)).rejects.toThrow('permission denied')
  })
})
