import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarketGroupSummary } from '@/features/marketGroups/MarketGroupSummary'
import type { MarketGroupSummary as MarketGroupSummaryModel } from '@/features/marketGroups/groupPresentation'

function makeSummary(overrides: Partial<MarketGroupSummaryModel> = {}): MarketGroupSummaryModel {
  return {
    groupKeyHash: 'ab'.repeat(32),
    label: 'Season abababab',
    totalMarkets: 2,
    activeMarkets: 1,
    pendingMarkets: 1,
    settledMarkets: 0,
    endTime: Date.UTC(2026, 0, 10),
    totalPool: 200_000,
    totalTraders: 50,
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
})
