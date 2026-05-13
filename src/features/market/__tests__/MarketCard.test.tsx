import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  beforeEach(() => {
    useBenchmarksHistoryMock.mockReturnValue({ data: undefined })
    useLatestPriceMock.mockReturnValue(null)
  })

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

  it('renders AI path previews supplied by parent hydration', () => {
    const market = makeMarket({
      numPaths: 1,
      history: [
        { time: Date.UTC(2026, 4, 7, 12), value: 100 },
        { time: Date.UTC(2026, 4, 8, 12), value: 101 },
      ],
    })
    const hydratedPath = {
      id: 'path-0',
      label: 'Path A',
      tone: 'bull' as const,
      origin: 'ai' as const,
      multiplier: 1,
      data: [
        { time: market.startTime, value: 100 },
        { time: market.startTime + 24 * 60 * 60 * 1000, value: 105 },
        { time: market.endTime, value: 115 },
      ],
      pathIndex: 0,
      predictedPrices: [100, 105, 115],
      numCheckpoints: 3,
      generationTimestamp: market.startTime,
      creator: '',
      cumulativeAction: 0,
      compositeScore: 0,
      peakAmplitude: 0,
      amplitudeAtDecoherence: 0,
      dissolved: false,
      dissolvedAtCheckpoint: 0,
      checkpointsProcessed: 0,
      createdAtCheckpoint: 0,
      firstActiveCheckpoint: 0,
      totalWagered: 0,
      totalLeveragedExposure: 0,
      lmsrSharesOutstanding: 0,
      totalTimeWeightedExposure: 0,
      currentImpliedProbability: 0,
      initialAmplitude: 0,
    } satisfies Market['paths'][number]

    const { container } = render(
      <MarketCard
        market={{ ...market, paths: [hydratedPath] }}
        now={market.startTime + 12 * 60 * 60 * 1000}
        onClick={vi.fn()}
      />,
    )

    expect(container.querySelectorAll('[data-testid="market-mini-ai-path"]').length).toBeGreaterThan(
      0,
    )
  })
})
