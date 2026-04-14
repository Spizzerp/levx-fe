import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { MarketStateBadge } from '@/components/MarketStateBadge'
import type { Market, MarketState } from '@/types/market'

function makeMarket(overrides: Partial<Market> = {}): Market {
  const base: Market = {
    id: 'btc',
    marketId: 1,
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'active',
    pool: 1000,
    traders: 10,
    startTime: Date.UTC(2026, 3, 10, 14, 30),
    endTime: Date.UTC(2026, 3, 20, 14, 30),
    checkpointInterval: 3600,
    completedCheckpoints: 0,
    totalCheckpoints: 24,
    leverageEnabled: true,
    maxLeverage: 10,
    entryFeeBps: 150,
    history: [],
    paths: [],
    numPaths: 0,
    amplitudes: [],
    lmsrShareQuantities: [],
    lambda: 0.1,
    decoherenceRate: 0.01,
    minimumProbability: 0,
    pathMaxAge: 0,
    pathsScored: 0,
    pathsDissolved: 0,
  }
  return { ...base, ...overrides }
}

function renderState(state: MarketState, extra: Partial<Market> = {}) {
  return render(<MarketStateBadge market={makeMarket({ state, ...extra })} />)
}

describe('MarketStateBadge', () => {
  it('renders Pending state with "Wagering opens" prose', () => {
    renderState('pending')
    expect(screen.getByText(/Pending/i)).toBeInTheDocument()
    expect(screen.getByText(/Wagering opens/i)).toBeInTheDocument()
  })

  it('renders Active state with "Wager open until" prose', () => {
    renderState('active')
    expect(screen.getByText(/Active/i)).toBeInTheDocument()
    expect(screen.getByText(/Wager open until/i)).toBeInTheDocument()
  })

  it('renders Sampling state with "Final wagers; checkpoint scoring underway" prose', () => {
    renderState('sampling')
    expect(screen.getByText(/Sampling/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Final wagers; checkpoint scoring underway/i),
    ).toBeInTheDocument()
  })

  it('renders Settling state with "Final score being computed" prose', () => {
    renderState('settling')
    expect(screen.getByText(/Settling/i)).toBeInTheDocument()
    expect(screen.getByText(/Final score being computed/i)).toBeInTheDocument()
  })

  it('renders Maturing state with "Review window; claims open in {countdown}" prose', () => {
    renderState('maturing', { endTime: Date.now() + 2 * 60 * 60 * 1000 })
    expect(screen.getByText(/Maturing/i)).toBeInTheDocument()
    expect(screen.getByText(/Review window; claims open in/i)).toBeInTheDocument()
  })

  it('renders Settled state with "Claim available" prose', () => {
    renderState('settled')
    expect(screen.getByText(/Settled/i)).toBeInTheDocument()
    expect(screen.getByText(/Claim available/i)).toBeInTheDocument()
  })

  it('renders Void state with "Market cancelled" prose', () => {
    renderState('void')
    expect(screen.getByText(/Void/i)).toBeInTheDocument()
    expect(screen.getByText(/Market cancelled/i)).toBeInTheDocument()
  })

  it('uses StatusDot with the lifecycle-mapped dot color', () => {
    const { container } = renderState('active')
    // StatusDot renders a dot span with aria-hidden + inline backgroundColor.
    const dot = container.querySelector('span[aria-hidden="true"]') as HTMLElement | null
    expect(dot).not.toBeNull()
    // Active maps to --color-success in StatusDot's statusColors map.
    expect(dot!.getAttribute('style') ?? '').toMatch(/--color-success/)
  })
})
