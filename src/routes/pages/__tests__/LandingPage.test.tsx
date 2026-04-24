import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/env/env.config', () => ({
  env: {
    APP_ENV: 'test',
    APP_API_BASE_URL: '',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.mainnet-beta.solana.com',
    APP_NETWORK: 'mainnet',
  },
}))

const navigateSpy = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateSpy,
}))

// Stub the chart — the landing test cares about chrome + CTA, not the chart itself.
vi.mock('@/features/chart/LevXChart', () => ({
  LevXChart: () => <div data-testid="chart-stub" />,
}))

import { LandingPage } from '@/routes/pages/LandingPage'

describe('LandingPage', () => {
  beforeEach(() => {
    navigateSpy.mockClear()
  })

  it('renders the market-preview header and logo', () => {
    render(<LandingPage />)
    expect(screen.getByAltText(/levx/i)).toBeInTheDocument()
    // Pair header from the recreated market container
    expect(screen.getByText(/btc \/ usdc/i)).toBeInTheDocument()
    // State badge
    expect(screen.getByText(/^active$/i)).toBeInTheDocument()
    // Meta strip label (unique enough to this hero)
    expect(screen.getByText(/entry fee/i)).toBeInTheDocument()
  })

  it('opens the waitlist modal when the market-preview CTA is clicked', async () => {
    render(<LandingPage />)
    // With no paths selected, MarketPreview's rail CTA reads "Join Waitlist".
    // It no longer navigates — it opens the inline waitlist modal.
    await userEvent.click(screen.getByRole('button', { name: /join waitlist/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(navigateSpy).not.toHaveBeenCalled()
  })
})
