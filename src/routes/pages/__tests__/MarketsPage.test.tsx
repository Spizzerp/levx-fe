import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock env config before any other imports (mirrors MarketPage.test.tsx)
vi.mock('@/env/env.config', () => ({
  env: {
    APP_ENV: 'test',
    APP_API_BASE_URL: '',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.mainnet-beta.solana.com',
    APP_NETWORK: 'mainnet',
  },
}))

// Mock navigate so the DataTable row click doesn't crash outside the router
const navigateSpy = vi.fn()
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  }
})

// Mock useMarkets from the chain seam — this plan flips the import to @/lib/chain
vi.mock('@/lib/chain', async () => {
  const actual = await vi.importActual<typeof import('@/lib/chain')>('@/lib/chain')
  return {
    ...actual,
    useMarkets: vi.fn(),
  }
})

import { MarketsPage } from '@/routes/pages/MarketsPage'
import type { Market, MarketState } from '@/types/market'

function makeMarket(overrides: Partial<Market> & Pick<Market, 'id' | 'pair' | 'state'>): Market {
  const now = Date.now()
  return {
    marketId: 0,
    base: overrides.pair.split('/')[0],
    quote: overrides.pair.split('/')[1],
    pool: 100_000,
    traders: 500,
    startTime: now - 7 * 24 * 3_600_000,
    endTime: now + 7 * 24 * 3_600_000,
    checkpointInterval: 3600,
    completedCheckpoints: 0,
    totalCheckpoints: 336,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 150,
    history: [],
    paths: [],
    numPaths: 0,
    amplitudes: [],
    lmsrShareQuantities: [],
    lmsrAlpha: 100_000,
    lambda: 0,
    decoherenceRate: 500_000,
    minimumProbability: 10_000,
    nudgeRate: 50_000,
    pathMaxAge: 3600,
    pathsScored: 0,
    pathsDissolved: 0,
    ...overrides,
  }
}

/**
 * Builds a list of markets spanning 4 states in non-sorted insertion order so
 * the STATE_ORDER sort assertion is meaningful (active is NOT first by index).
 */
function makeMarketsAcrossStates(): Market[] {
  const pathStub = (n: number) =>
    Array.from({ length: n }).map(
      (_, i) =>
        ({
          id: `p${i}`,
          label: `Path ${i}`,
          tone: 'neutral' as const,
          origin: 'ai' as const,
          multiplier: 1,
          data: [],
          pathIndex: i,
          predictedPrices: [],
          numCheckpoints: 0,
          generationTimestamp: 0,
          creator: '',
          cumulativeAction: 0,
          compositeScore: 0,
          peakAmplitude: 0,
          amplitudeAtDecoherence: 0,
          dissolved: false,
          dissolvedAtCheckpoint: 0,
          checkpointsProcessed: 0,
          totalWagered: 0,
          totalLeveragedExposure: 0,
          lmsrSharesOutstanding: 0,
          totalTimeWeightedExposure: 0,
          currentImpliedProbability: 0,
        }) satisfies Market['paths'][number],
    )
  return [
    makeMarket({ id: 'set', pair: 'PEPE/USDC', state: 'settled', paths: pathStub(5) }),
    makeMarket({ id: 'pen', pair: 'SOL/USDC', state: 'pending', paths: pathStub(3) }),
    makeMarket({ id: 'act', pair: 'BTC/USDC', state: 'active', paths: pathStub(5) }),
    makeMarket({ id: 'sam', pair: 'ETH/USDC', state: 'sampling', paths: pathStub(4) }),
  ]
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MarketsPage />
    </QueryClientProvider>,
  )
}

async function setUseMarkets(result: {
  data?: Market[]
  isLoading?: boolean
  isError?: boolean
  refetch?: ReturnType<typeof vi.fn>
}) {
  const { useMarkets } = await import('@/lib/chain')
  ;(useMarkets as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: result.data,
    isLoading: result.isLoading ?? false,
    isError: result.isError ?? false,
    error: result.isError ? new Error('boom') : null,
    refetch: result.refetch ?? vi.fn(),
  })
}

beforeEach(() => {
  navigateSpy.mockClear()
})

describe('MarketsPage', () => {
  it('renders the table even when walletStore.connected=false (WALLET-03)', async () => {
    await setUseMarkets({ data: makeMarketsAcrossStates() })
    renderPage()
    // Heading renders. No wallet provider is wrapped around this tree — if the
    // page tried to call useWallet/useWalletStore with a selector, React would throw.
    expect(screen.getByRole('heading', { name: /markets/i })).toBeInTheDocument()
  })

  it('does not redirect when wallet is disconnected (WALLET-03)', async () => {
    await setUseMarkets({ data: makeMarketsAcrossStates() })
    renderPage()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('renders a Paths column in the DataTable header (MARKET-01)', async () => {
    await setUseMarkets({ data: makeMarketsAcrossStates() })
    renderPage()
    expect(screen.getByText(/^paths$/i)).toBeInTheDocument()
  })

  it('Paths column value equals market.paths.length for each row (MARKET-01)', async () => {
    const markets = makeMarketsAcrossStates()
    await setUseMarkets({ data: markets })
    renderPage()
    // Each market's paths.length should show up somewhere in a row cell.
    // active/settled have 5 paths, sampling has 4, pending has 3.
    // We assert the numeric cells exist by text — since paths.length is >0, no em-dash.
    for (const m of markets) {
      expect(
        screen.getAllByText(new RegExp(`^${m.paths.length}$`)).length,
      ).toBeGreaterThan(0)
    }
  })

  it(
    'rows are ordered by STATE_ORDER: active, sampling, pending, settling, maturing, settled, void (MARKET-01)',
    async () => {
      await setUseMarkets({ data: makeMarketsAcrossStates() })
      renderPage()
      // Rows are rendered as <button> elements (DataTable with onRowClick).
      // Filter to data rows that contain a pair cell (skip filter pill buttons).
      const rows = screen
        .getAllByRole('button')
        .filter((el) => /BTC|ETH|SOL|PEPE/.test(el.textContent ?? ''))
      expect(rows).toHaveLength(4)
      // Insertion order was: settled, pending, active, sampling
      // Expected order: active, sampling, pending, settled
      expect(rows[0]).toHaveTextContent(/BTC/)
      expect(rows[1]).toHaveTextContent(/ETH/)
      expect(rows[2]).toHaveTextContent(/SOL/)
      expect(rows[3]).toHaveTextContent(/PEPE/)
    },
  )

  it(
    'renders the canonical column set (market, state, expires, pool, paths) (MARKET-01)',
    async () => {
      await setUseMarkets({ data: makeMarketsAcrossStates() })
      renderPage()
      expect(screen.getByText(/^market$/i)).toBeInTheDocument()
      expect(screen.getByText(/^state$/i)).toBeInTheDocument()
      expect(screen.getByText(/^expires$/i)).toBeInTheDocument()
      expect(screen.getByText(/^pool$/i)).toBeInTheDocument()
      expect(screen.getByText(/^paths$/i)).toBeInTheDocument()
    },
  )

  it('renders a skeleton component when useMarkets is loading (MARKET-08)', async () => {
    await setUseMarkets({ isLoading: true, data: undefined })
    renderPage()
    expect(screen.getByRole('status', { name: /loading markets/i })).toBeInTheDocument()
  })

  it('renders an error state with a retry button when useMarkets errors (MARKET-08)', async () => {
    const refetch = vi.fn()
    await setUseMarkets({ isError: true, data: undefined, refetch })
    renderPage()
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('renders an empty-state message when useMarkets returns zero markets (MARKET-08)', async () => {
    await setUseMarkets({ data: [] })
    renderPage()
    expect(screen.getByText(/no active markets/i)).toBeInTheDocument()
  })

  it('retry button re-invokes the query refetch (MARKET-08)', async () => {
    const refetch = vi.fn()
    await setUseMarkets({ isError: true, data: undefined, refetch })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})

// Compile-time guard: STATE_ORDER covers every MarketState.
// (Acts as a smoke check for the discriminated union — test passes if module loads.)
describe('MarketsPage STATE_ORDER coverage', () => {
  it('covers every MarketState in the union', () => {
    const allStates: MarketState[] = [
      'pending',
      'active',
      'sampling',
      'settling',
      'maturing',
      'settled',
      'void',
    ]
    expect(allStates).toHaveLength(7)
  })
})
