import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { PublicKey } from '@solana/web3.js'
import { useWalletStore } from '@/stores/walletStore'

// Mock env config before any other imports
vi.mock('@/env/env.config', () => ({
  env: {
    APP_ENV: 'test',
    APP_API_BASE_URL: '',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.mainnet-beta.solana.com',
    APP_NETWORK: 'mainnet',
  },
}))

// Mock @visx/responsive ParentSize — jsdom has no layout engine, reports 0x0
vi.mock('@visx/responsive', () => ({
  ParentSize: ({
    children,
  }: {
    children: (args: { width: number; height: number }) => React.ReactNode
  }) => children({ width: 800, height: 400 }),
}))

// Mock useParams so MarketPage can render without the full TanStack Router tree
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: 'btc' })),
  }
})

// Mock useMarket to return deterministic data without hitting the mock backend
vi.mock('@/lib/api/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/hooks')>('@/lib/api/hooks')
  return {
    ...actual,
    useMarket: vi.fn(),
  }
})

// Mock usePythFeed so no real SSE is opened
const usePythFeedSpy = vi.fn()
vi.mock('@/lib/pyth/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pyth/hooks')>('@/lib/pyth/hooks')
  return {
    ...actual,
    usePythFeed: (...args: unknown[]) => usePythFeedSpy(...args),
  }
})

// Mock useBenchmarksHistory so tests don't hit the network
vi.mock('@/lib/pyth/useBenchmarksHistory', () => ({
  useBenchmarksHistory: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    isSuccess: false,
  }),
}))

// Mock wallet-adapter-react-ui so ConnectGate can render without the provider tree
const setVisible = vi.fn()
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible, visible: false }),
}))

import { MarketPage } from '@/routes/pages/MarketPage'
import { useDrawingStore } from '@/stores/drawingStore'
import { usePythStore } from '@/stores/pythStore'

const TEST_MARKET = {
  id: 'btc',
  pair: 'BTC/USDC',
  base: 'BTC',
  quote: 'USDC',
  state: 'active' as const,
  pool: 248_901,
  traders: 1204,
  startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
  checkpointInterval: 3600,
  completedCheckpoints: 168,
  totalCheckpoints: 336,
  leverageEnabled: true,
  maxLeverage: 25,
  entryFeeBps: 150,
  history: [{ time: Date.now() - 60_000, value: 72800 }],
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

function renderMarketPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MarketPage />
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  useDrawingStore.setState({ state: { phase: 'idle' }, totalCheckpoints: 0 })
  usePythStore.setState({ ticks: {}, status: 'idle' })
  usePythFeedSpy.mockClear()
  setVisible.mockClear()
  useWalletStore.setState({
    publicKey: null,
    connected: false,
    connecting: false,
    wrongNetwork: false,
    cluster: null,
  })
  const { useMarket } = await import('@/lib/api/hooks')
  ;(useMarket as ReturnType<typeof vi.fn>).mockReturnValue({
    data: TEST_MARKET,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
})

async function selectMarketParams(user: ReturnType<typeof userEvent.setup>) {
  // Select a market duration (1 Day) and a checkpoint interval (1 Hour)
  const durationBtn = screen.getByRole('button', { name: /1 day/i })
  await user.click(durationBtn)
  const intervalBtn = screen.getByRole('button', { name: /1 hour/i })
  await user.click(intervalBtn)
}

async function setMarketState(
  state:
    | 'pending'
    | 'active'
    | 'sampling'
    | 'settling'
    | 'maturing'
    | 'settled'
    | 'void',
) {
  const { useMarket } = await import('@/lib/api/hooks')
  ;(useMarket as ReturnType<typeof vi.fn>).mockReturnValue({
    data: { ...TEST_MARKET, state },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
}

function connectWallet() {
  useWalletStore.setState({
    publicKey: new PublicKey('11111111111111111111111111111111'),
    connected: true,
    connecting: false,
    wrongNetwork: false,
    cluster: 'devnet',
  })
}

describe('MarketPage', () => {
  it('opens a Pyth SSE feed on mount for the current market pair', () => {
    renderMarketPage()
    expect(usePythFeedSpy).toHaveBeenCalled()
    // The feedId passed should be the BTC/USDC feed from PYTH_FEED_IDS
    expect((usePythFeedSpy.mock.calls[0] as unknown[])[0]).toMatch(/^0x[a-f0-9]+$/)
  })

  it('wires the "+ Draw Custom Path" button to drawingStore.enterDrawMode', async () => {
    const user = userEvent.setup()
    renderMarketPage()
    await selectMarketParams(user)
    const btn = screen.getByRole('button', { name: /draw custom path/i })
    await user.click(btn)
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
  })

  it('changes the button label to Cancel Drawing after entering draw mode', async () => {
    const user = userEvent.setup()
    renderMarketPage()
    await selectMarketParams(user)
    await user.click(screen.getByRole('button', { name: /draw custom path/i }))
    expect(screen.getByRole('button', { name: /cancel drawing/i })).toBeInTheDocument()
  })

  it('exits draw mode when Cancel Drawing is clicked', async () => {
    const user = userEvent.setup()
    renderMarketPage()
    await selectMarketParams(user)
    await user.click(screen.getByRole('button', { name: /draw custom path/i }))
    await user.click(screen.getByRole('button', { name: /cancel drawing/i }))
    expect(useDrawingStore.getState().state.phase).toBe('idle')
  })

  it('exits draw mode on unmount (cleanup)', () => {
    const { unmount } = renderMarketPage()
    useDrawingStore.getState().enterDrawMode(48)
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
    unmount()
    expect(useDrawingStore.getState().state.phase).toBe('idle')
  })

  it('displays live price from pythStore tick when available (CHART-01)', async () => {
    usePythStore.setState({
      ticks: {
        // BTC/USDC feed id from feedIds.ts
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43': {
          time: Date.now(),
          value: 72856.43,
          publishTime: Math.floor(Date.now() / 1000),
        },
      },
      status: 'connected',
    })
    renderMarketPage()
    // Header H1 should contain the tick value formatted as USD (formatUSD)
    await waitFor(() => {
      expect(screen.getByText(/72,856/)).toBeInTheDocument()
    })
  })

  // DRAW-09: desktop-only drawing gate.
  it('draw button wrapper has desktop-first "block md:hidden" classes (DRAW-09)', () => {
    renderMarketPage()
    const wrapper = screen.getByTestId('draw-button-wrapper')
    expect(wrapper.className).toMatch(/(^|\s)block($|\s)/)
    expect(wrapper.className).toMatch(/md:hidden/)
    expect(wrapper.className).not.toMatch(/(^|\s)hidden($|\s)/)
    expect(wrapper.className).not.toMatch(/md:block/)
  })

  it('"Drawing requires desktop" notice has desktop-first "hidden md:block" classes (DRAW-09)', () => {
    renderMarketPage()
    const notice = screen.getByTestId('drawing-desktop-notice')
    expect(notice).toHaveTextContent(/drawing requires desktop/i)
    expect(notice.className).toMatch(/(^|\s)hidden($|\s)/)
    expect(notice.className).toMatch(/md:block/)
    expect(notice.className).not.toMatch(/(^|\s)block($|\s)/)
    expect(notice.className).not.toMatch(/md:hidden/)
  })
})

describe('MarketPage state-gated controls', () => {
  // Wager panel is detected via the "Select A Line" label (unique to the wager panel)
  const wagerPanelQuery = () => screen.queryByText(/select a line/i)

  it('mounts the wager panel when market.state is Active (MARKET-04)', async () => {
    await setMarketState('active')
    renderMarketPage()
    expect(wagerPanelQuery()).toBeInTheDocument()
  })

  it('mounts the wager panel when market.state is Sampling (MARKET-04)', async () => {
    await setMarketState('sampling')
    renderMarketPage()
    expect(wagerPanelQuery()).toBeInTheDocument()
  })

  it('does NOT mount the wager panel when market.state is Pending (MARKET-04)', async () => {
    await setMarketState('pending')
    renderMarketPage()
    expect(wagerPanelQuery()).not.toBeInTheDocument()
  })

  it('does NOT mount the wager panel when market.state is Settling (MARKET-04)', async () => {
    await setMarketState('settling')
    renderMarketPage()
    expect(wagerPanelQuery()).not.toBeInTheDocument()
  })

  it('does NOT mount the wager panel when market.state is Maturing (MARKET-04)', async () => {
    await setMarketState('maturing')
    renderMarketPage()
    expect(wagerPanelQuery()).not.toBeInTheDocument()
  })

  it('does NOT mount the wager panel when market.state is Settled (MARKET-04)', async () => {
    await setMarketState('settled')
    renderMarketPage()
    expect(wagerPanelQuery()).not.toBeInTheDocument()
  })

  it('does NOT mount the wager panel when market.state is Void (MARKET-04)', async () => {
    await setMarketState('void')
    renderMarketPage()
    expect(wagerPanelQuery()).not.toBeInTheDocument()
  })

  it('mounts the claim button only when market.state is Settled (MARKET-04)', async () => {
    await setMarketState('settled')
    const { unmount } = renderMarketPage()
    // Claim button slot: connect-wallet prompt (disconnected) OR "Claim" CTA (connected)
    expect(
      screen.getByText(/market has settled\. claim your payout below/i),
    ).toBeInTheDocument()
    unmount()

    await setMarketState('active')
    renderMarketPage()
    expect(
      screen.queryByText(/market has settled\. claim your payout below/i),
    ).not.toBeInTheDocument()
  })

  it('mounts the maturity countdown card only when market.state is Maturing (MARKET-04)', async () => {
    await setMarketState('maturing')
    const { unmount } = renderMarketPage()
    // Countdown card has the unique body copy:
    expect(
      screen.getByText(/market is in the maturity review window/i),
    ).toBeInTheDocument()
    unmount()

    await setMarketState('settled')
    renderMarketPage()
    expect(
      screen.queryByText(/market is in the maturity review window/i),
    ).not.toBeInTheDocument()
  })

  it('renders the MarketStateBadge with the market state prose', async () => {
    await setMarketState('sampling')
    renderMarketPage()
    expect(
      screen.getByText(/Final wagers; checkpoint scoring underway/i),
    ).toBeInTheDocument()
  })

  it('renders a collapsible metadata section with checkpoint schedule, fee rate, pool (MARKET-05)', async () => {
    await setMarketState('active')
    renderMarketPage()
    const trigger = screen.getByRole('button', { name: /market details/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    const user = userEvent.setup()
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    // Body is identified by aria-controls target
    const body = document.getElementById('market-meta-panel-body')
    expect(body).not.toBeNull()
    expect(within(body!).getByText(/checkpoint interval/i)).toBeInTheDocument()
    expect(within(body!).getByText(/total checkpoints/i)).toBeInTheDocument()
    expect(within(body!).getByText(/entry fee/i)).toBeInTheDocument()
    expect(within(body!).getByText(/^pool$/i)).toBeInTheDocument()
  })

  it('metadata section toggles open/closed on trigger click (MARKET-05)', async () => {
    await setMarketState('active')
    renderMarketPage()
    const trigger = screen.getByRole('button', { name: /market details/i })
    const user = userEvent.setup()

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('MarketPage wallet gating', () => {
  it('submit button slot shows "Connect wallet to continue" when walletStore.connected=false (WALLET-04)', async () => {
    await setMarketState('active')
    renderMarketPage()
    expect(
      screen.getByRole('button', { name: /connect wallet to continue/i }),
    ).toBeInTheDocument()
    // Real "Open Long/Short Position" button is NOT mounted while disconnected
    expect(
      screen.queryByRole('button', { name: /open (long|short) position/i }),
    ).not.toBeInTheDocument()
  })

  it('wager panel remains fully visible and interactive when disconnected (only submit slot is gated) (WALLET-04)', async () => {
    await setMarketState('active')
    renderMarketPage()

    // Wager panel chrome is still present:
    expect(screen.getByText(/select a line/i)).toBeInTheDocument()
    expect(screen.getByText(/market duration/i)).toBeInTheDocument()

    // Collateral input (native <input>, first textbox in the panel) is interactive.
    // Preserves user-authored state across disconnect (WALLET-08).
    const user = userEvent.setup()
    const textboxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    const collateral = textboxes[0]
    await user.clear(collateral)
    await user.type(collateral, '50.00')
    expect(collateral.value).toBe('50.00')

    // Connecting swaps the submit slot back without unmounting siblings:
    act(() => connectWallet())
    const textboxesAfter = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(textboxesAfter[0].value).toBe('50.00')
    expect(
      screen.getByRole('button', { name: /open (long|short) position/i }),
    ).toBeInTheDocument()
  })

  it('renders MarketPage without crashing when wallet is disconnected (WALLET-03)', async () => {
    await setMarketState('active')
    expect(() => renderMarketPage()).not.toThrow()
    // Chart + header still render
    expect(screen.getByText(/BTC \/ USDC/i)).toBeInTheDocument()
  })
})

// Silence unused-import lint for test utilities retained for future use
void within
