import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { MarketStateBadge } from '@/features/market/MarketStateBadge'
import { STATE_PROSE } from '@/features/market/marketStateProse'
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
    nudgeRate: 0.05,
    pathMaxAge: 0,
    pathsScored: 0,
    pathsDissolved: 0,
  }
  return { ...base, ...overrides }
}

function renderState(state: MarketState, extra: Partial<Market> = {}) {
  return render(<MarketStateBadge market={makeMarket({ state, ...extra })} />)
}

// The shipped badge renders ONLY the StatusDot label per state. The descriptive
// prose was removed in a UI simplification but the STATE_PROSE map is kept as
// the canonical phrasing source for any future surface that wants it. These tests
// assert both contracts: the visible label, and the STATE_PROSE export.
describe('MarketStateBadge', () => {
  it('renders Pending label', () => {
    renderState('pending')
    expect(screen.getByText(/Pending/i)).toBeInTheDocument()
  })

  it('renders Active label', () => {
    renderState('active')
    expect(screen.getByText(/Active/i)).toBeInTheDocument()
  })

  it('renders Sampling label', () => {
    renderState('sampling')
    expect(screen.getByText(/Sampling/i)).toBeInTheDocument()
  })

  it('renders Settling label', () => {
    renderState('settling')
    expect(screen.getByText(/Settling/i)).toBeInTheDocument()
  })

  it('renders Maturing label', () => {
    renderState('maturing', { endTime: Date.now() + 2 * 60 * 60 * 1000 })
    expect(screen.getByText(/Maturing/i)).toBeInTheDocument()
  })

  it('renders Settled label', () => {
    renderState('settled')
    expect(screen.getByText(/Settled/i)).toBeInTheDocument()
  })

  it('renders Void label', () => {
    renderState('void')
    expect(screen.getByText(/Void/i)).toBeInTheDocument()
  })

  it('uses StatusDot with the lifecycle-mapped dot color (positive gradient for active)', () => {
    const { container } = renderState('active')
    const dot = container.querySelector('span[aria-hidden="true"]') as HTMLElement | null
    expect(dot).not.toBeNull()
    // Active maps to DOT_GRADIENT.positive in StatusDot's statusDots map —
    // a linear-gradient containing #5CF78B (the success-tone hex).
    expect(dot!.getAttribute('style') ?? '').toMatch(/#5CF78B/i)
  })

  it('STATE_PROSE provides phrasing for every market state', () => {
    const m = makeMarket()
    expect(STATE_PROSE.pending(m)).toMatch(/Wagering opens/i)
    expect(STATE_PROSE.active(m)).toMatch(/Wager open until/i)
    expect(STATE_PROSE.sampling(m)).toMatch(/Final wagers/i)
    expect(STATE_PROSE.settling(m)).toMatch(/Final score being computed/i)
    expect(STATE_PROSE.maturing({ ...m, endTime: Date.now() + 60_000 })).toMatch(/Review window/i)
    expect(STATE_PROSE.settled(m)).toMatch(/Claim available/i)
    expect(STATE_PROSE.void(m)).toMatch(/Market cancelled/i)
  })
})
