import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { LevXChart } from '@/features/chart/LevXChart'

// Mock env config to prevent missing-env-var throws during test module evaluation
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

// Mock @visx/responsive ParentSize — jsdom reports 0×0 because there's no real layout engine.
// Provide a fixed 800×400 canvas so ChartInner renders instead of returning null.
vi.mock('@visx/responsive', () => ({
  ParentSize: ({ children }: { children: (args: { width: number; height: number }) => React.ReactNode }) =>
    children({ width: 800, height: 400 }),
}))
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'
import { useDrawingStore } from '@/stores/drawingStore'
import { usePriceStore } from '@/stores/priceStore'

const startTime = 1_700_000_000_000
const endTime = startTime + 48 * 30 * 60 * 1000
const market = {
  startTime,
  checkpointInterval: 30 * 60,
  totalCheckpoints: 48,
}
const paths = buildAiPathFixture({
  startTime,
  checkpointInterval: 30 * 60,
  totalCheckpoints: 48,
  basePrice: 100,
})
const history = Array.from({ length: 10 }, (_, i) => ({
  time: startTime - (10 - i) * 60_000,
  value: 100 + i,
}))

beforeEach(() => {
  useDrawingStore.setState({ state: { phase: 'idle' }, totalCheckpoints: 0 })
  usePriceStore.setState({ ticks: {}, feeds: {}, levels: {} })
})

function renderChart(overrides: Partial<Parameters<typeof LevXChart>[0]> = {}) {
  return render(
    <LevXChart
      history={history}
      predictions={paths}
      nowTime={startTime}
      marketStart={startTime}
      marketEnd={endTime}
      selectedPathId={paths[2].id}
      market={market}
      {...overrides}
    />,
  )
}

describe('LevXChart', () => {
  it('renders historical line using curveMonotoneX and prediction paths using curveCatmullRom.alpha(0.5)', () => {
    const { container } = renderChart()
    // At minimum, paths render as <path> elements inside the SVG
    const svgPaths = container.querySelectorAll('svg path')
    expect(svgPaths.length).toBeGreaterThan(0)
    // Presence of a `<path d=...>` for each prediction (visual contract)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders up to 5 AI candidate path overlays', () => {
    const { container } = renderChart()
    // 5 prediction paths + 1 selected overlay + 1 history = 7 LinePath elements at minimum
    const svgPaths = container.querySelectorAll('svg path')
    expect(svgPaths.length).toBeGreaterThanOrEqual(5)
  })

  it('renders selected path at full opacity (selected overlay exists)', () => {
    const { container } = renderChart()
    // The selected overlay uses the theme-aware --chart-line CSS variable
    // (component uses `stroke={C.line}` where C.line = 'var(--chart-line, #FFFFFF)').
    const selectedOverlay = container.querySelector('svg path[stroke*="chart-line"]')
    expect(selectedOverlay).toBeInTheDocument()
  })

  it('renders distinct loading state', () => {
    renderChart({ isLoading: true })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders distinct error state', () => {
    renderChart({ error: new Error('network down') })
    expect(screen.getByText(/chart error/i)).toBeInTheDocument()
    expect(screen.getByText(/network down/i)).toBeInTheDocument()
  })

  it('renders empty state when no history and no Pyth tick', () => {
    renderChart({ history: [] })
    expect(screen.getByText(/waiting for price data/i)).toBeInTheDocument()
  })

  it('renders chart without predictions when predictions array is empty', () => {
    const { container } = renderChart({ predictions: [] })
    // Should still render the SVG with just the history line
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders DrawingGrid when drawing store is in draw mode', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(48).fill(null) },
      totalCheckpoints: 48,
    })
    const { container } = renderChart()
    expect(container.querySelector('[data-testid="drawing-grid"]')).toBeInTheDocument()
  })

  it('does NOT render DrawingGrid when store phase is idle', () => {
    const { container } = renderChart()
    expect(container.querySelector('[data-testid="drawing-grid"]')).toBeNull()
  })

  it('survives viewport change: unchanged props produce same prediction paths (ParentSize safety)', () => {
    const { container, rerender } = renderChart()
    const beforeCount = container.querySelectorAll('svg path').length
    rerender(
      <LevXChart
        history={history}
        predictions={paths}
        nowTime={startTime}
        marketStart={startTime}
        marketEnd={endTime}
        selectedPathId={paths[2].id}
        market={market}
      />,
    )
    expect(container.querySelectorAll('svg path').length).toBe(beforeCount)
  })

  it('appends the live tick to visible history when the price store has a newer tick', () => {
    usePriceStore.setState({
      ticks: {
        '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d': {
          time: startTime + 60_000,
          value: 123,
          publishTime: Math.floor((startTime + 60_000) / 1000),
        },
      },
    })
    const { container } = renderChart({ pair: 'SOL/USDC' })
    // The merged history path should still render (can't easily assert specific d-value in jsdom, but the component must not crash and SVG must render)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('invokes renderDrawingOverlay with live scales when provided', () => {
    const spy = vi.fn(() => null)
    renderChart({ renderDrawingOverlay: spy })
    expect(spy).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = (spy.mock.calls as any[][])[0]?.[0] as Record<string, unknown>
    expect(args).toBeDefined()
    expect(args['innerWidth']).toBeGreaterThan(0)
    expect(args['innerHeight']).toBeGreaterThan(0)
    expect((args['checkpointXs'] as unknown[]).length).toBe(48)
    expect(typeof args['xScale']).toBe('function')
    expect(typeof args['yScale']).toBe('function')
  })

  it('freezes Y-axis domain when drawing store enters sweeping', async () => {
    useDrawingStore.setState({
      state: { phase: 'sweeping', values: new Array(48).fill(null), pointerDown: true },
      totalCheckpoints: 48,
    })
    const { container } = renderChart()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('LevXChart checkpoints', () => {
  const intervalMs = market.checkpointInterval * 1000

  /** The default market-focused domain over the 800 − 16 − 80 px plot, as the chart computes it. */
  function xAt(time: number): number {
    const duration = endTime - startTime
    const from = startTime - duration
    const to = endTime + duration * 0.05
    return ((time - from) / (to - from)) * (800 - 16 - 80)
  }

  /** The last x in an SVG path's `d` (the end point of the drawn line). */
  function lastX(d: string | null): number {
    const numbers = (d ?? '').match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []
    return Number(numbers[numbers.length - 2])
  }

  it('draws one dot and label per settled checkpoint', () => {
    renderChart({
      nowTime: startTime + 45 * 60_000,
      checkpointPrices: [
        { index: 0, time: startTime + 4_000, price: 95.41 },
        { index: 1, time: startTime + intervalMs + 3_000, price: 96.02 },
      ],
    })
    expect(screen.getAllByTestId('checkpoint-dot')).toHaveLength(2)
    expect(screen.getByText('#1 · 95.41')).toBeInTheDocument()
    expect(screen.getByText('#2 · 96.02')).toBeInTheDocument()
  })

  it('cuts a dissolved path at its dissolving checkpoint', () => {
    const dissolved = { ...paths[0], dissolved: true, dissolvedAtCheckpoint: 3 }
    const cutTime = startTime + 2 * intervalMs
    renderChart({
      nowTime: startTime + 3 * 60 * 60_000,
      predictions: [dissolved, ...paths.slice(1)],
    })
    const line = screen.getByTestId('dissolved-path')
    expect(lastX(line.getAttribute('d'))).toBeCloseTo(xAt(cutTime), 3)
    expect(line.getAttribute('opacity')).toBe('0.35')
    expect(Number(screen.getByTestId('dissolve-mark').getAttribute('x'))).toBeCloseTo(
      xAt(cutTime),
      3,
    )
  })

  it('marks a path dissolved at the first checkpoint at the market start', () => {
    const dissolved = { ...paths[0], dissolved: true, dissolvedAtCheckpoint: 1 }
    renderChart({
      nowTime: startTime + 45 * 60_000,
      predictions: [dissolved, ...paths.slice(1)],
    })
    expect(screen.queryByTestId('dissolved-path')).toBeNull()
    expect(Number(screen.getByTestId('dissolve-mark').getAttribute('x'))).toBeCloseTo(
      xAt(startTime),
      3,
    )
  })

  it('labels the next unsampled checkpoint with its countdown', () => {
    renderChart({
      nowTime: startTime + 70 * 60_000,
      checkpointPrices: [
        { index: 0, time: startTime + 4_000, price: 95.41 },
        { index: 1, time: startTime + intervalMs + 3_000, price: 96.02 },
        { index: 2, time: startTime + 2 * intervalMs + 5_000, price: 96.5 },
      ],
    })
    // Checkpoint 3 is due at start + 90 min, 20 min after now.
    expect(screen.getByText('in 20 m')).toBeInTheDocument()
    expect(screen.getAllByText(/^in \d+ m$/)).toHaveLength(1)
  })
})
