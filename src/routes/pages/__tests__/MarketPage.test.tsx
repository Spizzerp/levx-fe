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
    APP_PROGRAM_ID: 'LhDfCNTdm8Xr5cpEaSCfVSsbReA8muHFsS8zgjJn7Kk',
    APP_ADMIN_WALLETS: [],
    APP_SUPABASE_URL: 'http://127.0.0.1:54321',
    APP_SUPABASE_ANON_KEY: 'test-anon-key',
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

// Mock useParams and Link so MarketPage can render without the full TanStack Router tree
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: 'btc' })),
    Link: ({
      children,
      to,
      className,
    }: {
      children: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
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
    fetchStatus: 'idle',
    isFetchingOlder: false,
    hasMoreHistory: true,
    fetchOlder: () => {},
  }),
  useLazyHistoryTrigger: () => () => {},
}))

// Mock wallet-adapter-react-ui so ConnectGate can render without the provider tree
const setVisible = vi.fn()
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible, visible: false }),
}))

// MarketPage now renders <MarketComments> which calls useSupabaseAuth + useComments.
// Stub them at the module boundary so the test harness does not need to mount
// a real SupabaseAuthProvider tree (which itself depends on the wallet adapter).
vi.mock('@/lib/supabase/hooks', () => ({
  useSupabaseAuth: () => ({
    status: 'idle',
    jwt: null,
    wallet: null,
    expiresAt: null,
    authenticate: vi.fn(),
    signOut: vi.fn(),
  }),
  useComments: () => ({ data: [], isLoading: false, error: null }),
  usePostComment: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useDeleteComment: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useProfiles: () => ({ data: {}, isLoading: false, error: null }),
  getProfileImageUrl: (path: string | null) => (path ? `https://mock-storage/${path}` : null),
  useDrawBroadcast: () => ({ liveDraws: {} }),
  usePublishDrawFrame: () => () => {},
}))

import { MarketPage } from '@/routes/pages/MarketPage'
import { useDrawingStore } from '@/stores/drawingStore'
import { usePythStore } from '@/stores/pythStore'
import type { PredictionPath } from '@/types/market'

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
  lmsrAlpha: 100,
  lambda: 0.1,
  decoherenceRate: 0.01,
  minimumProbability: 0,
  nudgeRate: 0.05,
  pathMaxAge: 0,
  pathsScored: 0,
  pathsDissolved: 0,
}

type TestMarketOverride = Partial<Omit<typeof TEST_MARKET, 'paths'> & { paths: PredictionPath[] }>

function makePath(overrides: Partial<PredictionPath> = {}): PredictionPath {
  return {
    id: 'path-0',
    label: 'Path A',
    tone: 'bull',
    origin: 'ai',
    multiplier: 1.25,
    data: [
      { time: TEST_MARKET.startTime, value: 72_800 },
      { time: TEST_MARKET.endTime, value: 74_000 },
    ],
    pathIndex: 0,
    predictedPrices: [72_800, 74_000],
    numCheckpoints: 2,
    generationTimestamp: Date.now(),
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
    ...overrides,
  }
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

async function selectMarketParams(_user: ReturnType<typeof userEvent.setup>) {
  // Duration / checkpoint-interval pickers were removed when markets moved
  // on-chain — params now come from the loaded Market account. No-op kept so
  // existing call sites stay readable as "set up market params before draw".
  return Promise.resolve()
}

async function setMarketState(
  state: 'pending' | 'active' | 'sampling' | 'settling' | 'maturing' | 'settled' | 'void',
  overrides: TestMarketOverride = {},
) {
  const { useMarket } = await import('@/lib/api/hooks')
  ;(useMarket as ReturnType<typeof vi.fn>).mockReturnValue({
    data: { ...TEST_MARKET, state, ...overrides },
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

  it('prefills elapsed checkpoints before drawing in an active market', async () => {
    const user = userEvent.setup()
    renderMarketPage()
    await selectMarketParams(user)
    await user.click(screen.getByRole('button', { name: /draw custom path/i }))

    const state = useDrawingStore.getState().state
    if (state.phase !== 'drawMode') throw new Error('expected drawMode')
    expect(state.values.slice(0, TEST_MARKET.completedCheckpoints).every((v) => v === 72_800)).toBe(
      true,
    )
    expect(state.values[TEST_MARKET.completedCheckpoints]).toBeNull()
  })

  it('changes the button label to Cancel after entering draw mode', async () => {
    const user = userEvent.setup()
    renderMarketPage()
    await selectMarketParams(user)
    await user.click(screen.getByRole('button', { name: /draw custom path/i }))
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
  })

  it('exits draw mode when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderMarketPage()
    await selectMarketParams(user)
    await user.click(screen.getByRole('button', { name: /draw custom path/i }))
    // Button label was shortened from "Cancel Drawing" → "Cancel" in the
    // post-redesign wager panel.
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
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
  // Wager panel is detected via the "Collateral" label (unique to the wager
  // panel — appears next to the collateral Input).
  const wagerPanelQuery = () => screen.queryByText(/^collateral$/i)

  it('mounts the wager panel when market.state is Active (MARKET-04)', async () => {
    await setMarketState('active')
    renderMarketPage()
    expect(wagerPanelQuery()).toBeInTheDocument()
  })

  it('mounts the wager panel when market.state is Sampling before the wagering cutoff (MARKET-04)', async () => {
    await setMarketState('sampling')
    renderMarketPage()
    expect(wagerPanelQuery()).toBeInTheDocument()
  })

  it('does NOT mount the wager panel when market.state is Sampling at the wagering cutoff (MARKET-04)', async () => {
    await setMarketState('sampling', { completedCheckpoints: 269 })
    renderMarketPage()
    expect(wagerPanelQuery()).not.toBeInTheDocument()
  })

  it('mounts the wager panel when market.state is Pending so users see the form behind the AI loader (MARKET-04)', async () => {
    // Pending markets used to mount a standalone PendingPathsBanner
    // aside instead of the wager panel; that left a big empty rail
    // for the duration of AI path generation. The current behavior
    // mounts the same wager rail chrome as wager-open markets — controls
    // disabled by the shared wagering-open gate
    // that) and the path-list slot is replaced by a heart-pulse
    // loader. Net: users see the bet they'll place rather than an
    // empty waiting room.
    await setMarketState('pending')
    renderMarketPage()
    expect(wagerPanelQuery()).toBeInTheDocument()
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
    expect(screen.getByText(/market has settled\. claim your payout below/i)).toBeInTheDocument()
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
    expect(screen.getByText(/market is in the maturity review window/i)).toBeInTheDocument()
    unmount()

    await setMarketState('settled')
    renderMarketPage()
    expect(screen.queryByText(/market is in the maturity review window/i)).not.toBeInTheDocument()
  })

  it('renders the MarketStateBadge as Active for sampling markets before the wagering cutoff', async () => {
    await setMarketState('sampling')
    renderMarketPage()
    // The badge was simplified to render only the label (no descriptive prose).
    // STATE_PROSE remains exported for any future surface that wants it.
    expect(screen.getByText(/Active/i)).toBeInTheDocument()
  })

  it('renders the MarketStateBadge as Sampling once the wagering cutoff is reached', async () => {
    await setMarketState('sampling', { completedCheckpoints: 269 })
    renderMarketPage()
    expect(screen.getByText(/Sampling/i)).toBeInTheDocument()
  })

  it('keeps the submit button enabled for sampling markets before the wagering cutoff', async () => {
    await setMarketState('sampling', {
      paths: [makePath()],
      numPaths: 1,
    })
    act(() => connectWallet())
    const user = userEvent.setup()
    renderMarketPage()

    await user.click(screen.getByRole('button', { name: /path a/i }))

    expect(screen.getByRole('button', { name: /open long position/i })).not.toBeDisabled()
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
    expect(screen.getByRole('button', { name: /connect wallet to continue/i })).toBeInTheDocument()
    // Real "Open Long/Short Position" button is NOT mounted while disconnected
    expect(
      screen.queryByRole('button', { name: /open (long|short) position/i }),
    ).not.toBeInTheDocument()
  })

  it('wager panel remains fully visible and interactive when disconnected (only submit slot is gated) (WALLET-04)', async () => {
    await setMarketState('active')
    renderMarketPage()

    // Wager panel chrome is still present (Collateral label is unique to this panel).
    expect(screen.getByText(/^collateral$/i)).toBeInTheDocument()

    // Collateral input is interactive and preserves user-authored state across
    // disconnect (WALLET-08). Look up by its accessible label rather than DOM order
    // so sibling textboxes (e.g. the comments composer) don't break the query.
    const user = userEvent.setup()
    const collateral = screen.getByLabelText(/collateral/i) as HTMLInputElement
    await user.clear(collateral)
    await user.type(collateral, '50.00')
    expect(collateral.value).toBe('50.00')

    // Connecting preserves the input value across the submit-slot swap.
    act(() => connectWallet())
    const collateralAfter = screen.getByLabelText(/collateral/i) as HTMLInputElement
    expect(collateralAfter.value).toBe('50.00')
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
