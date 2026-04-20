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

  it('renders the tagline and logo', () => {
    render(<LandingPage />)
    expect(screen.getByText(/predict the path not the outcome/i)).toBeInTheDocument()
    expect(screen.getByAltText(/levx/i)).toBeInTheDocument()
  })

  it('navigates to /markets when Launch is clicked', async () => {
    render(<LandingPage />)
    await userEvent.click(screen.getByRole('button', { name: /launch/i }))
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/markets' })
  })
})
