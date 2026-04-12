import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

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
  const { useMarket } = await import('@/lib/api/hooks')
  ;(useMarket as ReturnType<typeof vi.fn>).mockReturnValue({
    data: TEST_MARKET,
    isLoading: false,
    error: null,
  })
})

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
    const btn = screen.getByRole('button', { name: /draw custom path/i })
    await user.click(btn)
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
  })

  it('changes the button label to Cancel Drawing after entering draw mode', async () => {
    const user = userEvent.setup()
    renderMarketPage()
    await user.click(screen.getByRole('button', { name: /draw custom path/i }))
    expect(screen.getByRole('button', { name: /cancel drawing/i })).toBeInTheDocument()
  })

  it('exits draw mode when Cancel Drawing is clicked', async () => {
    const user = userEvent.setup()
    renderMarketPage()
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
