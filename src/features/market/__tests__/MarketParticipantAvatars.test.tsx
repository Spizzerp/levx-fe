import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const useMarketTopTradersMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/market/useMarketTopTraders', () => ({
  useMarketTopTraders: useMarketTopTradersMock,
}))

vi.mock('@/lib/supabase/hooks', () => ({
  useProfiles: () => ({ data: {} }),
  getProfileImageUrl: (path: string | null) => path,
}))

vi.mock('@/ui/AvatarCircles', () => ({
  AvatarCircles: () => <div data-testid="avatar-circles" />,
}))

import { MarketParticipantAvatars } from '@/features/market/MarketParticipantAvatars'

describe('MarketParticipantAvatars', () => {
  it('skips the top-traders query when the market has no traders', () => {
    useMarketTopTradersMock.mockReturnValue({ data: undefined })

    render(<MarketParticipantAvatars marketIdNum={49} traderCount={0} />)

    expect(useMarketTopTradersMock).toHaveBeenCalledWith(null)
  })
})
