import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/env/env.config', () => ({
  env: {
    APP_ENV: 'test',
    APP_API_BASE_URL: '',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.devnet.solana.com',
    APP_NETWORK: 'devnet',
    APP_PROGRAM_ID: 'LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV',
    APP_ADMIN_WALLETS: [],
    APP_PATH_UPLOAD_RELAY_FEE_LAMPORTS: 50_000,
    APP_EIGENCACHE_QUOTES_ENABLED: false,
    APP_SUPABASE_URL: 'https://example.supabase.co',
    APP_SUPABASE_ANON_KEY: 'anon',
  },
}))

const navigateSpy = vi.fn()
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  }
})

import { ProviderGatewayLeaderboardPage } from '@/routes/pages/ProviderGatewayLeaderboardPage'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ProviderGatewayLeaderboardPage', () => {
  beforeEach(() => {
    navigateSpy.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/providers/leaderboard')) {
          return Promise.resolve(
            jsonResponse({
              leaderboard: [
                {
                  provider_id: 'prov_aaaaaaaaaaaaaaaaaaaaaaaa',
                  window_days: 30,
                  scorer_version: 'orthogonal_precision_v1',
                  markets_submitted: 2,
                  paths_submitted: 5,
                  paths_valid: 5,
                  paths_selected: 2,
                  avg_composite_score: 0.82,
                  median_composite_score: 0.8,
                  top_decile_rate: 0.4,
                  selection_rate: 0.4,
                  redundancy_rate: 0.2,
                  orthogonal_contribution: 0.31,
                  calibration_error: 0.05,
                  updated_at: '2026-05-20T12:00:00Z',
                },
              ],
              filters: {
                pair: null,
                horizon: null,
                season_key: null,
                selected_only: false,
                window_days: 30,
              },
            }),
          )
        }
        if (url.endsWith('/api/v1/providers')) {
          return Promise.resolve(
            jsonResponse({
              providers: [
                {
                  schema_version: 1,
                  provider_id: 'prov_aaaaaaaaaaaaaaaaaaaaaaaa',
                  display_name: 'Quant Fund A',
                  provider_type: 'quant_fund',
                  status: 'curated',
                  created_at: '2026-05-20T10:00:00Z',
                  updated_at: '2026-05-20T11:00:00Z',
                },
              ],
            }),
          )
        }
        return Promise.resolve(jsonResponse({}))
      }),
    )
  })

  it('renders provider reputation rows from the pipeline gateway API', async () => {
    render(<ProviderGatewayLeaderboardPage />, { wrapper })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /quant fund a/i })).toBeInTheDocument()
    })

    expect(screen.getByText(/external model reputation/i)).toBeInTheDocument()
    expect(screen.getAllByText('0.820')).toHaveLength(2)
    expect(screen.getByText(/2 \/ 40.0%/i)).toBeInTheDocument()
  })

  it('surfaces missing pipeline API configuration when gateway calls fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not found', { status: 404 }))),
    )

    render(<ProviderGatewayLeaderboardPage />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/pipeline api base url is not configured/i)).toBeInTheDocument()
    })
  })
})
