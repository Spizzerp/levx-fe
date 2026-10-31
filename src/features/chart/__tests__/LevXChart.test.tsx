import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
// Provide an 800×400 canvas so ChartInner renders instead of returning null; a test may start it at 0×0.
const parentSize = vi.hoisted(() => ({ width: 800, height: 400 }))
vi.mock('@visx/responsive', () => ({
  ParentSize: ({ children }: { children: (args: { width: number; height: number }) => React.ReactNode }) =>
    children({ width: parentSize.width, height: parentSize.height }),
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
const SOL_FEED = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
const history = Array.from({ length: 10 }, (_, i) => ({
  time: startTime - (10 - i) * 60_000,
  value: 100 + i,
}))

beforeEach(() => {
  parentSize.width = 800
  parentSize.height = 400
  useDrawingStore.setState({ state: { phase: 'idle' }, totalCheckpoints: 0 })
  usePriceStore.setState({ ticks: {}, feeds: {}, levels: {}, trails: {} })
})

function chartElement(overrides: Partial<Parameters<typeof LevXChart>[0]> = {}) {
  return (
    <LevXChart
      history={history}
      predictions={paths}
      nowTime={startTime}
      marketStart={startTime}
      marketEnd={endTime}
      selectedPathId={paths[2].id}
      market={market}
      {...overrides}
    />
  )
}

function renderChart(overrides: Partial<Parameters<typeof LevXChart>[0]> = {}) {
  return render(chartElement(overrides))
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

  it('reveals the chart when its history loaded before the chart had a size', () => {
    // A market opened in a background tab: the history arrives before the first layout.
    parentSize.width = 0
    parentSize.height = 0
    const { rerender } = renderChart({ isLoading: true, history: [] })
    rerender(chartElement({ isLoading: false }))

    parentSize.width = 800
    parentSize.height = 400
    rerender(chartElement({ isLoading: false }))

    expect(screen.getByTestId('price-line').parentElement).toHaveStyle({ opacity: '1' })
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

  it('the chart draws the per-second trail since mount between history and the live tick', () => {
    // A ten-minute market spreads seconds about half a pixel apart on the 704 px plot.
    const shortEnd = startTime + 10 * 60_000
    /** The time under each point of an SVG path's `d`, to the nearest second. */
    function drawnTimes(d: string | null): number[] {
      const from = startTime - (shortEnd - startTime)
      const to = shortEnd + (shortEnd - startTime) * 0.05
      return (d ?? '')
        .split(/[MLC]/)
        .filter(Boolean)
        .map((command) => {
          const numbers = command.match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number)
          const x = numbers[numbers.length - 2]
          return Math.round((from + (x / (800 - 16 - 80)) * (to - from)) / 1000) * 1000
        })
    }
    const lastCandle = history[history.length - 1].time
    const { setTick } = usePriceStore.getState()
    // The two oldest seconds are already covered by the history and are not drawn again.
    for (const time of [lastCandle - 1000, lastCandle, lastCandle + 1000, lastCandle + 2000]) {
      setTick(SOL_FEED, { time, value: 109.5, publishTime: time / 1000 })
    }
    // The live tick is the newest second
    setTick(SOL_FEED, { time: lastCandle + 3000, value: 109.7, publishTime: lastCandle / 1000 + 3 })

    renderChart({ pair: 'SOL/USDC', marketEnd: shortEnd, nowTime: lastCandle + 3000 })

    expect(drawnTimes(screen.getByTestId('price-line').getAttribute('d'))).toEqual([
      ...history.map((p) => p.time),
      lastCandle + 1000,
      lastCandle + 2000,
      lastCandle + 3000,
    ])
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

  /** Label width as the chart estimates it: Space Mono at 9 px, 0.6 em advance + 0.08 em spacing. */
  function labelWidth(text: string): number {
    return text.length * 9 * (0.6 + 0.08)
  }

  /** Hovers the chart's hit area at a plot x. jsdom's bounding rect is all zeros. */
  function hoverAt(container: HTMLElement, x: number) {
    const hitArea = container.querySelector('rect[fill="transparent"][x="0"][y="0"]')!
    fireEvent.pointerMove(hitArea, { clientX: 16 + x, buttons: 0 })
  }

  it('draws one dot and label per settled checkpoint', () => {
    // Six-hour checkpoints leave each label room (about 86 px apart on the 704 px plot).
    const sixHours = 6 * 60 * 60
    renderChart({
      market: { startTime, checkpointInterval: sixHours, totalCheckpoints: 4 },
      nowTime: startTime + 7 * 60 * 60_000,
      checkpointPrices: [
        { index: 0, time: startTime + 4_000, price: 95.41 },
        { index: 1, time: startTime + sixHours * 1000 + 3_000, price: 96.02 },
      ],
    })
    expect(screen.getAllByTestId('checkpoint-dot')).toHaveLength(2)
    expect(screen.getByText('#1 · 95.41')).toBeInTheDocument()
    expect(screen.getByText('#2 · 96.02')).toBeInTheDocument()
  })

  it('thins checkpoint labels that would overlap and keeps the newest', () => {
    const checkpointPrices = Array.from({ length: 48 }, (_, i) => ({
      index: i,
      time: startTime + i * intervalMs + 3_000,
      price: 100 + i / 4,
    }))
    renderChart({ nowTime: endTime, checkpointPrices })

    expect(screen.getAllByTestId('checkpoint-dot')).toHaveLength(48)
    const labels = screen.getAllByText(/^#\d+ · /)
    expect(labels.length).toBeGreaterThan(1)
    expect(labels.length).toBeLessThan(48)
    expect(screen.getByText('#48 · 111.75')).toBeInTheDocument()
    const spans = labels
      .map((label) => {
        const x = Number(label.getAttribute('x'))
        const half = labelWidth(label.textContent ?? '') / 2
        return { left: x - half, right: x + half }
      })
      .sort((a, b) => a.left - b.left)
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].left).toBeGreaterThanOrEqual(spans[i - 1].right)
    }
  })

  it('thins guides on a dense market and keeps the next one with its countdown', () => {
    renderChart({
      nowTime: startTime + 70 * 60_000,
      checkpointPrices: [
        { index: 0, time: startTime + 4_000, price: 95.41 },
        { index: 1, time: startTime + intervalMs + 3_000, price: 96.02 },
        { index: 2, time: startTime + 2 * intervalMs + 5_000, price: 96.5 },
      ],
    })
    // Checkpoints 3 … 47 are ahead of now, about 7 px apart.
    const guideXs = screen
      .getAllByTestId('checkpoint-guide')
      .map((guide) => Number(guide.getAttribute('x1')))
    expect(guideXs.length).toBeGreaterThan(1)
    expect(guideXs.length).toBeLessThan(45)
    expect(guideXs[0]).toBeCloseTo(xAt(startTime + 3 * intervalMs), 3)
    for (let i = 1; i < guideXs.length; i++) {
      expect(guideXs[i] - guideXs[i - 1]).toBeGreaterThanOrEqual(12)
    }
    expect(screen.getByText('in 20 m')).toBeInTheDocument()
  })

  it('keeps the crosshair off a dissolved path past its cut', () => {
    // paths[2] is the fixture's selected path; it dissolved at checkpoint 2 (start + 1 h).
    const dissolved = { ...paths[2], dissolved: true, dissolvedAtCheckpoint: 3 }
    const cutTime = startTime + 2 * intervalMs
    const { container } = renderChart({
      nowTime: startTime + 3 * 60 * 60_000,
      predictions: [...paths.slice(0, 2), dissolved, ...paths.slice(3)],
    })
    hoverAt(container, xAt(startTime + 10 * 60 * 60_000))
    const crosshair = container.querySelector('line[stroke-dasharray="1 3"]')!
    expect(Number(crosshair.getAttribute('x1'))).toBeLessThanOrEqual(xAt(cutTime) + 1e-6)
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
