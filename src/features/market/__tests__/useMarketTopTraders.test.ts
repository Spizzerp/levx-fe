import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SCALE } from '@/lib/constants'

const useQueryMock = vi.hoisted(() => vi.fn())
const parseMarketStateMock = vi.hoisted(() => vi.fn())
const activeMaskFromPricingMaskMock = vi.hoisted(() => vi.fn())
const estimateLmsrExitPayoutMock = vi.hoisted(() => vi.fn())
const deriveMarketPdaMock = vi.hoisted(() => vi.fn())
const getReadOnlyProgramMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}))

vi.mock('@/lib/api/adapters', () => ({
  parseMarketState: parseMarketStateMock,
}))

vi.mock('@/lib/solana/eigenCache', () => ({
  activeMaskFromPricingMask: activeMaskFromPricingMaskMock,
}))

vi.mock('@/lib/solana/lmsr', () => ({
  estimateLmsrExitPayout: estimateLmsrExitPayoutMock,
}))

vi.mock('@/lib/solana/pda', () => ({
  deriveMarketPda: deriveMarketPdaMock,
}))

vi.mock('@/lib/solana/program', () => ({
  getReadOnlyProgram: getReadOnlyProgramMock,
}))

import { getMarketTopTraders, useMarketTopTraders } from '@/features/market/useMarketTopTraders'

function scaled(value: number) {
  return {
    toNumber: () => value * SCALE,
  }
}

function rawNumber(value: number) {
  return {
    toNumber: () => value,
  }
}

function wallet(address: string) {
  return {
    toBase58: () => address,
  }
}

function position({
  user,
  collateral,
  exposure,
  finalPayout = 0,
  shares = 0,
  pathIndex = 0,
  claimed = false,
}: {
  user: string
  collateral: number
  exposure: number
  finalPayout?: number
  shares?: number
  pathIndex?: number
  claimed?: boolean
}) {
  return {
    account: {
      user: wallet(user),
      collateral: scaled(collateral),
      notionalExposure: scaled(exposure),
      finalPayout: scaled(finalPayout),
      lmsrShares: scaled(shares),
      pathIndex,
      claimed,
    },
  }
}

describe('getMarketTopTraders', () => {
  const marketPda = wallet('market-pda')
  const fetchMarket = vi.fn()
  const fetchPositions = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    deriveMarketPdaMock.mockReturnValue([marketPda])
    parseMarketStateMock.mockReturnValue('active')
    activeMaskFromPricingMaskMock.mockReturnValue([true, true, false])
    estimateLmsrExitPayoutMock.mockReturnValue(20)
    fetchMarket.mockResolvedValue({
      state: { active: {} },
      numPaths: 3,
      lmsrShareQuantities: [scaled(10), scaled(12), scaled(0)],
      lmsrAlpha: scaled(100),
      pricingActiveMask: rawNumber(0b011),
    })
    fetchPositions.mockResolvedValue([])
    useQueryMock.mockReturnValue({})
    getReadOnlyProgramMock.mockReturnValue({
      account: {
        market: { fetch: fetchMarket },
        position: { all: fetchPositions },
      },
    })
  })

  it('aggregates positions by wallet and sorts by exposure then collateral', async () => {
    fetchPositions.mockResolvedValue([
      position({
        user: 'wallet-a',
        collateral: 10,
        exposure: 12,
        finalPayout: 14,
        claimed: true,
      }),
      position({
        user: 'wallet-b',
        collateral: 20,
        exposure: 20,
        shares: 3,
        pathIndex: 1,
      }),
      position({
        user: 'wallet-a',
        collateral: 5,
        exposure: 10,
        finalPayout: 3,
        claimed: true,
      }),
      position({
        user: 'wallet-c',
        collateral: 25,
        exposure: 20,
        finalPayout: 25,
        claimed: true,
      }),
    ])

    const traders = await getMarketTopTraders(49)

    expect(deriveMarketPdaMock).toHaveBeenCalledWith(49)
    expect(fetchMarket).toHaveBeenCalledWith(marketPda)
    expect(fetchPositions).toHaveBeenCalledWith([
      { memcmp: { offset: 8, bytes: 'market-pda' } },
    ])
    expect(activeMaskFromPricingMaskMock).toHaveBeenCalledWith(0b011, 3)
    expect(estimateLmsrExitPayoutMock).toHaveBeenCalledWith({
      shareQuantities: [10, 12, 0],
      numPaths: 3,
      lmsrAlpha: 100,
      pathIndex: 1,
      sharesScaled: 3,
      activeMask: [true, true, false],
    })
    expect(traders).toEqual([
      {
        wallet: 'wallet-a',
        collateral: 15,
        exposure: 22,
        pnl: 2,
        positions: 2,
      },
      {
        wallet: 'wallet-c',
        collateral: 25,
        exposure: 20,
        pnl: 0,
        positions: 1,
      },
      {
        wallet: 'wallet-b',
        collateral: 20,
        exposure: 20,
        pnl: 0,
        positions: 1,
      },
    ])
  })

  it('uses collateral as payout for void markets without estimating LMSR exit value', async () => {
    parseMarketStateMock.mockReturnValue('void')
    fetchPositions.mockResolvedValue([
      position({
        user: 'wallet-a',
        collateral: 15,
        exposure: 50,
        shares: 9,
        pathIndex: 2,
      }),
    ])

    const traders = await getMarketTopTraders(55)

    expect(estimateLmsrExitPayoutMock).not.toHaveBeenCalled()
    expect(traders).toEqual([
      {
        wallet: 'wallet-a',
        collateral: 15,
        exposure: 50,
        pnl: 0,
        positions: 1,
      },
    ])
  })

  it('does not poll top traders in the background', () => {
    useMarketTopTraders(49)

    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['marketTopTraders', 49],
        enabled: true,
        refetchInterval: false,
      }),
    )
  })
})
