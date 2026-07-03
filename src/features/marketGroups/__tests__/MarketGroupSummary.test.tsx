import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarketGroupSummary } from '@/features/marketGroups/MarketGroupSummary'
import type { MarketGroupSummary as MarketGroupSummaryModel } from '@/features/marketGroups/groupPresentation'

function makeSummary(overrides: Partial<MarketGroupSummaryModel> = {}): MarketGroupSummaryModel {
  return {
    groupKeyHash: 'ab'.repeat(32),
    label: 'BTC/USDC 1D Season',
    subtitle: 'BTC/USDC · 1D · Season · 2 markets',
    shortHash: 'abababab...ababab',
    kind: 'season',
    status: 'active',
    parentGroup: null,
    primaryPair: 'BTC/USDC',
    pairs: ['BTC/USDC'],
    metadataSource: 'inferred',
    timeframeSeconds: 86_400,
    timeframeLabel: '1D',
    childMarketCount: 2,
    totalMarkets: 2,
    activeMarkets: 1,
    pendingMarkets: 1,
    settledMarkets: 0,
    endTime: Date.UTC(2026, 0, 10),
    totalPool: 200_000,
    totalTraders: 50,
    sortOrder: 0,
    ...overrides,
  }
}

describe('MarketGroupSummary', () => {
  it('shows ended when the group window has already elapsed', () => {
    render(<MarketGroupSummary summary={makeSummary()} now={Date.UTC(2026, 0, 11)} />)

    expect(screen.getByText('Ended')).toBeInTheDocument()
    expect(screen.queryByText('Open-ended')).not.toBeInTheDocument()
  })

  it('shows open-ended when no group end time is available', () => {
    render(
      <MarketGroupSummary
        summary={makeSummary({ endTime: undefined })}
        now={Date.UTC(2026, 0, 1)}
      />,
    )

    expect(screen.getByText('Open-ended')).toBeInTheDocument()
  })

  it('shows season metadata when present', () => {
    render(
      <MarketGroupSummary
        summary={makeSummary({ productSeason: '2026', horizonLabel: '1D' })}
        now={Date.UTC(2026, 0, 1)}
      />,
    )

    expect(screen.getByText('Season')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(screen.getByText('Horizon')).toBeInTheDocument()
    expect(screen.getAllByText('1D').length).toBeGreaterThan(0)
  })
})
