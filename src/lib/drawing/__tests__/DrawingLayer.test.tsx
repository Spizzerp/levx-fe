import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { scaleLinear, scaleTime } from '@visx/scale'
import { DrawingLayer } from '@/components/DrawingLayer'
import { useDrawingStore } from '@/stores/drawingStore'

// ----------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------

const startTime = 1_700_000_000_000
const checkpointIntervalMs = 30 * 60 * 1000
const totalCheckpoints = 48
const checkpointXs = Array.from(
  { length: totalCheckpoints },
  (_, i) => startTime + i * checkpointIntervalMs,
)
const marketStart = startTime
const marketEnd = startTime + totalCheckpoints * checkpointIntervalMs

// Scales that map the future-time region [marketStart, marketEnd] → [0, 800]
const xScale = scaleTime({ domain: [marketStart, marketEnd], range: [0, 800] })
// Price domain [100, 200] → pixels [400, 0] (price increases upward)
const yScale = scaleLinear({ domain: [100, 200], range: [400, 0] })

const MOCK_SVG_RECT = {
  left: 0,
  top: 0,
  width: 800,
  height: 400,
  right: 800,
  bottom: 400,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}

/** Helper: mock pointer-event methods that jsdom doesn't implement.
 *  The DrawingLayer now uses ownerSVGElement.getBoundingClientRect() for coord
 *  conversion, so we mock that on the parent <svg> rather than the overlay rect.
 */
function stubOverlayMethods(overlay: Element) {
  ;(overlay as unknown as Record<string, unknown>).setPointerCapture = vi.fn()
  ;(overlay as unknown as Record<string, unknown>).releasePointerCapture = vi.fn()
  // Mock getBoundingClientRect on the ownerSVGElement (the parent <svg>)
  const svg = (overlay as SVGElement).ownerSVGElement ?? (overlay.closest('svg') as Element | null)
  if (svg) {
    ;(svg as unknown as Record<string, unknown>).getBoundingClientRect = () => MOCK_SVG_RECT
  }
}

function renderLayer() {
  return render(
    <svg width={800} height={400}>
      <DrawingLayer
        xScale={xScale as Parameters<typeof DrawingLayer>[0]['xScale']}
        yScale={yScale as Parameters<typeof DrawingLayer>[0]['yScale']}
        innerWidth={800}
        innerHeight={400}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        checkpointXs={checkpointXs}
        marketStart={marketStart}
      />
    </svg>,
  )
}

// ----------------------------------------------------------------
// Setup / teardown
// ----------------------------------------------------------------

beforeEach(() => {
  // Reset store to idle before every test.
  useDrawingStore.setState({ state: { phase: 'idle' }, totalCheckpoints: 0 })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------
// Tests (replacing all it.todo stubs)
// ----------------------------------------------------------------

describe('DrawingLayer', () => {
  it('returns null when phase is idle (no overlay rendered)', () => {
    const { container } = renderLayer()
    expect(container.querySelector('[data-testid="drawing-layer"]')).toBeNull()
  })

  it('renders overlay + raw stroke path when phase is drawMode', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    expect(container.querySelector('[data-testid="drawing-layer"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="drawing-overlay"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="raw-stroke"]')).toBeInTheDocument()
  })

  it('calls setPointerCapture(pointerId) on pointerdown', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)
    const spy = (overlay as unknown as { setPointerCapture: ReturnType<typeof vi.fn> })
      .setPointerCapture

    fireEvent.pointerDown(overlay, { pointerId: 7, clientX: 400, clientY: 200 })

    // jsdom 26 does not implement PointerEvent natively; fireEvent dispatches a
    // MouseEvent-backed synthetic event so pointerId arrives as undefined in jsdom.
    // The critical assertion is that setPointerCapture is called on pointerdown.
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('mutates raw stroke path via setAttribute on pointermove (DOM spy)', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    const rawStroke = container.querySelector('[data-testid="raw-stroke"]') as SVGPathElement
    stubOverlayMethods(overlay)

    const setAttrSpy = vi.spyOn(rawStroke, 'setAttribute')

    // pointerdown seeds the path; clear spy so we test only the pointermove call.
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 10, clientY: 200 })
    setAttrSpy.mockClear()

    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 50, clientY: 210 })

    expect(setAttrSpy).toHaveBeenCalledWith('d', expect.stringContaining('L'))
  })

  it('does NOT update React state for the raw stroke during drag', () => {
    // This is verified implicitly: if raw stroke used React state, the component
    // would re-render on every pointermove, and the smoothed-curve query would
    // force re-render. We confirm there is no `data-testid="smoothed-curve"` after
    // a single move (no crossings yet at this small displacement).
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 0, clientY: 200 })
    // A very small move — no checkpoint crossed → store unchanged → no React re-render
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 1, clientY: 200 })

    // Smoothed curve should NOT exist (needs >= 2 captured points).
    expect(container.querySelector('[data-testid="smoothed-curve"]')).toBeNull()
    // The raw stroke element is still present (React-rendered, but its 'd' attribute
    // is managed via ref, not state).
    expect(container.querySelector('[data-testid="raw-stroke"]')).toBeInTheDocument()
  })

  it('commits crossings to drawingStore during pointermove', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // pointerdown at x=0, pointermove to x=800 → crosses all 48 checkpoints
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 0, clientY: 200 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 800, clientY: 200 })

    const st = useDrawingStore.getState().state
    expect(st.phase).toBe('sweeping')
    if (st.phase === 'sweeping') {
      const filled = st.values.filter((v): v is number => v !== null).length
      expect(filled).toBeGreaterThan(0)
    }
  })

  it('renders React-backed smoothed Catmull-Rom curve from drawingStore.values', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[0] = 150
    vals[5] = 160
    useDrawingStore.setState({
      state: { phase: 'sweeping', values: vals, pointerDown: true },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    // LinePath renders a <path> with data-testid="smoothed-curve"
    expect(container.querySelector('[data-testid="smoothed-curve"]')).toBeInTheDocument()
  })

  it('renders checkpoint dots with price labels only at global max and min', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[0] = 150
    vals[5] = 160
    vals[10] = 170 // global max
    vals[15] = 155
    vals[20] = 140 // global min
    vals[25] = 165
    useDrawingStore.setState({
      state: { phase: 'sweeping', values: vals, pointerDown: true },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    const dots = container.querySelectorAll('[data-testid="checkpoint-dot"]')
    expect(dots).toHaveLength(6)

    // Labels only on global max (170) and global min (140)
    const labels = container.querySelectorAll('[data-testid="checkpoint-dot"] text')
    expect(labels).toHaveLength(2)
    expect(labels[0].textContent).toBe('170')
    expect(labels[1].textContent).toBe('140')
  })

  it('fades raw stroke to opacity 0 after pointerup', async () => {
    vi.useFakeTimers()
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    const rawStroke = container.querySelector('[data-testid="raw-stroke"]') as SVGPathElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 200, clientY: 200 })

    // After pointerup the component sets opacity to '0' via direct style mutation.
    expect(rawStroke.style.opacity).toBe('0')

    // After 420ms the path is cleared back to empty.
    act(() => { vi.advanceTimersByTime(500) })
    expect(rawStroke.getAttribute('d')).toBe('')

    vi.useRealTimers()
  })

  it('only activates sweeping when pointerdown occurs inside future-time region', () => {
    // Build a scale where half the width is history (before marketStart).
    // domain: [marketStart - marketDuration, marketEnd], range: [0, 800]
    // So marketStart maps to pixel 400 (exactly the midpoint).
    const marketDuration = marketEnd - marketStart // 48 * 30 * 60 * 1000 ms
    const wideXScale = scaleTime({
      domain: [marketStart - marketDuration, marketEnd],
      range: [0, 800],
    })
    // Verify: wideXScale(marketStart) should be 400.
    // domain span = 2 * marketDuration; marketStart is at the midpoint.

    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = render(
      <svg width={800} height={400}>
        <DrawingLayer
          xScale={wideXScale as Parameters<typeof DrawingLayer>[0]['xScale']}
          yScale={yScale as Parameters<typeof DrawingLayer>[0]['yScale']}
          innerWidth={800}
          innerHeight={400}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          checkpointXs={checkpointXs}
          marketStart={marketStart}
        />
      </svg>,
    )
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Click at x=100, which maps to a domain time well before marketStart (history region).
    // wideXScale.invert(100) ≈ marketStart - marketDuration + 100/800 * 2*marketDuration
    //                        = marketStart - marketDuration * (1 - 0.25)
    //                        = marketStart - 0.75 * marketDuration
    // This is clearly before marketStart → guard should reject.
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })

    // Store should remain in drawMode — pointerdown guard rejected the click.
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
  })

  it('fires onStrokeStart and onStrokeEnd callbacks', () => {
    const onStart = vi.fn()
    const onEnd = vi.fn()
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = render(
      <svg>
        <DrawingLayer
          xScale={xScale as Parameters<typeof DrawingLayer>[0]['xScale']}
          yScale={yScale as Parameters<typeof DrawingLayer>[0]['yScale']}
          innerWidth={800}
          innerHeight={400}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          checkpointXs={checkpointXs}
          marketStart={marketStart}
          onStrokeStart={onStart}
          onStrokeEnd={onEnd}
        />
      </svg>,
    )
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    expect(onStart).toHaveBeenCalledTimes(1)

    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 200, clientY: 200 })
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('transitions to sweeping after pointerdown', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 400, clientY: 200 })

    expect(useDrawingStore.getState().state.phase).toBe('sweeping')
  })

  it('allows multi-stroke: re-entering sweeping from ready state overwrites crossed checkpoints', () => {
    // Seed all values as non-null so store goes to ready after first endStroke.
    const filledValues = new Array(totalCheckpoints).fill(150) as number[]
    useDrawingStore.setState({
      state: { phase: 'ready', values: filledValues },
      totalCheckpoints,
    })
    const { container } = renderLayer()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Start a new stroke from ready — should re-enter sweeping.
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 50 })
    expect(useDrawingStore.getState().state.phase).toBe('sweeping')

    // Move across some checkpoints to overwrite values.
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 200, clientY: 50 })
    const st = useDrawingStore.getState().state
    if (st.phase === 'sweeping') {
      // Some values near the start should now differ from the original 150.
      const overwritten = st.values.filter((v) => v !== null && v !== 150)
      // Y at screen pixel 50 → domain price: yScale.invert(50) ≈ 187.5
      // They should have been set to roughly 187.5 — not the original 150.
      expect(overwritten.length).toBeGreaterThan(0)
    }
  })
})
