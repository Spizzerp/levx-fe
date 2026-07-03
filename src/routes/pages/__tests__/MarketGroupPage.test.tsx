import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import type { Market } from '@/types/market'

const GROUP = 'ab'.repeat(32)
const navigateSpy = vi.fn()
const refetch = vi.fn()

type UseMarketsState = {
  data?: Market[]
  isLoading?: boolean
  isError?: boolean
  refetch?: () => void
}

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
    useParams: () => ({ groupKeyHash: GROUP }),
  }
})

vi.mock('@/features/market/MarketCard', () => ({
  MarketCard: ({ market, now, onClick }: { market: Market; now: number; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {market.pair}
      <span>now:{now}</span>
    </button>
  ),
}))

vi.mock('@/lib/chain', () => ({
  useMarkets: vi.fn(),
}))

import { useMarkets } from '@/lib/chain'
import { MarketGroupPage } from '@/routes/pages/MarketGroupPage'

function makeMarket(overrides: Partial<Market>): Market {
  const now = Date.now()
  return {
    id: overrides.id ?? 'btc',
    marketId: overrides.marketId ?? 1,
    pair: overrides.pair ?? 'BTC/USDC',
    base: overrides.base ?? 'BTC',
    quote: overrides.quote ?? 'USDC',
    vault: '',
    state: overrides.state ?? 'active',
    pool: overrides.pool ?? 100_000,
    traders: overrides.traders ?? 20,
    startTime: now - 86_400_000,
    endTime: now + 86_400_000,
    checkpointInterval: 3600,
    completedCheckpoints: 0,
    totalCheckpoints: 48,
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
    groupKeyHash: GROUP,
    groupKind: 'season',
    timeframeSeconds: 86_400,
    ...overrides,
    baseMint: overrides.baseMint ?? 'BTC-mint',
    quoteMint: overrides.quoteMint ?? 'USDC-mint',
  }
}

function setUseMarkets(value: UseMarketsState) {
  ;(useMarkets as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: value.data,
    isLoading: false,
    isError: false,
    refetch,
    ...value,
  })
}

function renderPage() {
  return render(<MarketGroupPage />)
}

describe('MarketGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setUseMarkets({ data: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a stable loading state', () => {
    setUseMarkets({ data: undefined, isLoading: true })

    renderPage()

    expect(screen.getByRole('status', { name: /loading market group/i })).toBeInTheDocument()
  })

  it('renders group summary and child markets', () => {
    setUseMarkets({
      data: [
        makeMarket({ id: 'btc', pair: 'BTC/USDC', state: 'active' }),
        makeMarket({ id: 'eth', pair: 'ETH/USDC', state: 'pending' }),
        makeMarket({ id: 'flat', pair: 'SOL/USDC', state: 'active', groupKeyHash: undefined }),
      ],
    })

    renderPage()

    expect(screen.getByRole('heading', { name: /btc\/usdc 1d season/i })).toBeInTheDocument()
    expect(screen.getByText(/2 independent markets/i)).toBeInTheDocument()
    expect(screen.getByText(/grouping is discovery-only/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /BTC\/USDC/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ETH\/USDC/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /SOL\/USDC/i })).not.toBeInTheDocument()
  })

  it('ticks child market cards as time passes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    setUseMarkets({
      data: [makeMarket({ id: 'btc', pair: 'BTC/USDC', state: 'active' })],
    })

    renderPage()

    expect(screen.getByText('now:1000')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByText('now:2000')).toBeInTheDocument()
  })

  it('renders an empty state when the group hash has no children', () => {
    setUseMarkets({ data: [makeMarket({ id: 'flat', groupKeyHash: undefined })] })

    renderPage()

    expect(screen.getByText(/no markets in this group yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view all markets/i })).toHaveAttribute(
      'href',
      '/markets',
    )
  })

  it('renders an error state with retry', () => {
    setUseMarkets({ data: undefined, isError: true })

    renderPage()

    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
