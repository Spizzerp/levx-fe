import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { MarketCard } from '@/features/market/MarketCard'

import type { Market } from '@/types/market'
import type { PythTick } from '@/lib/pyth/types'

vi.mock('@visx/responsive', () => ({
  ParentSize: ({
    children,
  }: {
    children: (args: { width: number; height: number }) => ReactNode
  }) => children({ width: 640, height: 160 }),
}))

const useBenchmarksHistoryMock = vi.fn()
vi.mock('@/lib/pyth/useBenchmarksHistory', () => ({
  useBenchmarksHistory: (...args: unknown[]) => useBenchmarksHistoryMock(...args),
}))

const useLatestPriceMock = vi.fn()
vi.mock('@/lib/pyth/hooks', () => ({
  useLatestPrice: (...args: unknown[]) => useLatestPriceMock(...args),
}))

function makeMarket(overrides: Partial<Market> = {}): Market {
  const startTime = Date.UTC(2026, 4, 7, 12)
  const base: Market = {
    id: '30',
    marketId: 30,
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    vault: '',
    state: 'sampling',
    pool: 0,
    traders: 0,
    startTime,
    endTime: startTime + 7 * 24 * 60 * 60 * 1000,
    checkpointInterval: 3600,
    completedCheckpoints: 2,
    totalCheckpoints: 42,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 0,
    history: [],
    paths: [],
    numPaths: 0,
    targetNumPaths: 3,
    amplitudes: [],
    lmsrShareQuantities: [],
    pricingActiveMask: 0,
    lmsrAlpha: 0,
    lambda: 0,
    decoherenceRate: 0,
    minimumProbability: 0,
    nudgeRate: 0,
    pathMaxAge: 0,
    pathsScored: 0,
    pathsDissolved: 0,
  }
  return { ...base, ...overrides }
}

describe('MarketCard', () => {
  it('calculates percentage from market start price to the live Pyth price', () => {
    const market = makeMarket()
    const history = [
      { time: market.startTime - 60 * 60 * 1000, value: 99 },
      { time: market.startTime, value: 100 },
      { time: market.startTime + 60 * 60 * 1000, value: 101 },
    ]
    const latestTick: PythTick = {
      publishTime: Math.floor((market.startTime + 2 * 60 * 60 * 1000) / 1000),
      time: market.startTime + 2 * 60 * 60 * 1000,
      value: 110,
    }

    useBenchmarksHistoryMock.mockReturnValue({ data: history })
    useLatestPriceMock.mockReturnValue(latestTick)

    render(<MarketCard market={market} now={latestTick.time} onClick={vi.fn()} />)

    expect(screen.getByText('+10.00%')).toBeInTheDocument()
    expect(screen.getByText('ID: 30')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})
