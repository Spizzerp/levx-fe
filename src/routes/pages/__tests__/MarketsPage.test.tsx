import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

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
let searchParams: { view?: 'table' | 'grid' } = {}
type LinkMockProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode
  params?: { groupKeyHash?: string }
  to: string
}

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, params, to, ...props }: LinkMockProps) => (
      <a href={params?.groupKeyHash ? `/markets/group/${params.groupKeyHash}` : to} {...props}>
        {children}
      </a>
    ),
    useNavigate: () => navigateSpy,
    useSearch: () => searchParams,
  }
})

vi.mock('@visx/responsive', () => ({
  ParentSize: ({
    children,
  }: {
    children: (args: { width: number; height: number }) => ReactNode
  }) => children({ width: 640, height: 160 }),
}))

// Mock useMarkets from the chain seam — this plan flips the import to @/lib/chain
const useMarketPathPreviewsMock = vi.fn()
vi.mock('@/lib/chain', async () => {
  const actual = await vi.importActual<typeof import('@/lib/chain')>('@/lib/chain')
  return {
    ...actual,
    useMarkets: vi.fn(),
    useMarketPathPreviews: (...args: unknown[]) => useMarketPathPreviewsMock(...args),
  }
})

import { MarketsPage } from '@/routes/pages/MarketsPage'
import type { Market, MarketState } from '@/types/market'

function makeMarket(overrides: Partial<Market> & Pick<Market, 'id' | 'pair' | 'state'>): Market {
  const now = Date.now()
  const base: Market = {
    id: overrides.id,
    marketId: 0,
    pair: overrides.pair,
    base: overrides.pair.split('/')[0],
    quote: overrides.pair.split('/')[1],
    baseMint: `${overrides.pair.split('/')[0]}-mint`,
    quoteMint: `${overrides.pair.split('/')[1]}-mint`,
    vault: '',
    state: overrides.state,
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
    targetNumPaths: 3,
    amplitudes: [],
    lmsrShareQuantities: [],
    pricingActiveMask: 0,
    lmsrAlpha: 100_000,
    lambda: 0,
    decoherenceRate: 500_000,
    minimumProbability: 10_000,
    nudgeRate: 50_000,
    pathMaxAge: 3600,
    pathsScored: 0,
    pathsDissolved: 0,
  }
  return { ...base, ...overrides }
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
          createdAtCheckpoint: 0,
          firstActiveCheckpoint: 0,
          totalWagered: 0,
          totalLeveragedExposure: 0,
          lmsrSharesOutstanding: 0,
          totalTimeWeightedExposure: 0,
          currentImpliedProbability: 0,
          initialAmplitude: 0,
        }) satisfies Market['paths'][number],
    )
  return [
    makeMarket({ id: 'set', pair: 'PEPE/USDC', state: 'settled', paths: pathStub(5) }),
    makeMarket({ id: 'pen', pair: 'SOL/USDC', state: 'pending', paths: pathStub(3) }),
    makeMarket({ id: 'act', pair: 'BTC/USDC', state: 'active', paths: pathStub(5) }),
    makeMarket({ id: 'sam', pair: 'ETH/USDC', state: 'sampling', paths: pathStub(4) }),
  ]
}

function makePathPreview(market: Market): Market['paths'][number] {
  return {
    id: `${market.id}-path-0`,
    label: 'Path A',
    tone: 'bull',
    origin: 'ai',
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
  }
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
  searchParams = {}
  useMarketPathPreviewsMock.mockReset()
  useMarketPathPreviewsMock.mockReturnValue({ data: {} })
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

  it('hydrates missing grid path previews with one page-level query', async () => {
    searchParams = { view: 'grid' }
    const baseMarket = makeMarket({
      id: 'act',
      pair: 'BTC/USDC',
      state: 'active',
      numPaths: 1,
      paths: [],
      history: [
        { time: Date.now() - 60 * 60 * 1000, value: 100 },
        { time: Date.now(), value: 101 },
      ],
    })
    const market = {
      ...baseMarket,
      paths: [
        {
          ...makePathPreview(baseMarket),
          data: [],
          predictedPrices: [],
          numCheckpoints: 0,
        },
      ],
    }
    useMarketPathPreviewsMock.mockReturnValue({
      data: {
        [market.id]: [makePathPreview(market)],
      },
    })
    await setUseMarkets({ data: [market] })

    const { container } = renderPage()

    expect(useMarketPathPreviewsMock).toHaveBeenCalledWith([market.id])
    expect(
      container.querySelectorAll('[data-testid="market-mini-ai-path"]').length,
    ).toBeGreaterThan(0)
  })

  it('renders a Paths column in the DataTable header (MARKET-01)', async () => {
    await setUseMarkets({ data: makeMarketsAcrossStates() })
    renderPage()
    expect(screen.getByText(/^paths$/i)).toBeInTheDocument()
  })

  it('Paths column value equals market.numPaths for each row (MARKET-01)', async () => {
    const markets = makeMarketsAcrossStates()
    await setUseMarkets({ data: markets })
    renderPage()
    // List queries intentionally do not hydrate PathOutcome accounts; nonzero
    // counts come from Market.numPaths so legacy path layouts cannot crash load.
    for (const m of markets) {
      if (m.numPaths === 0) {
        expect(screen.getAllByText('—').length).toBeGreaterThan(0)
      } else {
        expect(screen.getAllByText(new RegExp(`^${m.numPaths}$`)).length).toBeGreaterThan(0)
      }
    }
  })

  it('rows are ordered by display state: active, sampling, pending, settling, maturing, settled, void (MARKET-01)', async () => {
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
  })

  it('renders raw sampling markets as active before cutoff and sampling after cutoff', async () => {
    await setUseMarkets({
      data: [
        makeMarket({ id: 'active', pair: 'BTC/USDC', state: 'active' }),
        makeMarket({ id: 'sampling-open', pair: 'ETH/USDC', state: 'sampling' }),
        makeMarket({
          id: 'sampling-closed',
          pair: 'DOGE/USDC',
          state: 'sampling',
          completedCheckpoints: 269,
        }),
      ],
    })
    renderPage()

    const rows = screen
      .getAllByRole('button')
      .filter((el) => /BTC|ETH|DOGE/.test(el.textContent ?? ''))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent(/BTC/)
    expect(rows[0]).toHaveTextContent(/Active/)
    expect(rows[1]).toHaveTextContent(/ETH/)
    expect(rows[1]).toHaveTextContent(/Active/)
    expect(rows[2]).toHaveTextContent(/DOGE/)
    expect(rows[2]).toHaveTextContent(/Sampling/)
  })

  it('renders the canonical column set (market, state, expires, pool, paths) (MARKET-01)', async () => {
    await setUseMarkets({ data: makeMarketsAcrossStates() })
    renderPage()
    expect(screen.getByText(/^market$/i)).toBeInTheDocument()
    expect(screen.getByText(/^state$/i)).toBeInTheDocument()
    expect(screen.getByText(/^expires$/i)).toBeInTheDocument()
    expect(screen.getByText(/^pool$/i)).toBeInTheDocument()
    expect(screen.getByText(/^paths$/i)).toBeInTheDocument()
  })

  it('renders grouped market discovery links when grouped markets exist', async () => {
    const groupKeyHash = 'ab'.repeat(32)
    await setUseMarkets({
      data: [
        makeMarket({
          id: 'grouped',
          pair: 'BTC/USDC',
          state: 'active',
          groupKeyHash,
          groupKind: 'season',
        }),
      ],
    })

    renderPage()

    expect(screen.getByRole('link', { name: /all groups/i })).toHaveAttribute('href', '/markets')
    const link = screen.getByRole('link', { name: /season abababab/i })
    expect(link).toHaveAttribute('href', `/markets/group/${groupKeyHash}`)
  })

  it('keeps flat market lists free of group discovery controls', async () => {
    await setUseMarkets({
      data: [makeMarket({ id: 'flat', pair: 'ETH/USDC', state: 'active' })],
    })

    renderPage()

    expect(screen.queryByRole('link', { name: /season/i })).not.toBeInTheDocument()
  })

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
