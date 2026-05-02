import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { scaleLinear, scaleTime } from '@visx/scale'

import { SelectTool } from '@/features/chart/drawingTools/SelectTool'
import { useDrawingStore } from '@/stores/drawingStore'

// xScale maps marketStart..marketEnd → 0..800. With 48 checkpoints at 30 min
// intervals, checkpointXs[i] sits at chart pixel x = i * (800 / 48) = i * 16.667.
// yScale maps domain price 100..200 → pixels 400..0 (inverted, top is high).
const startTime = 1_700_000_000_000
const checkpointIntervalMs = 30 * 60 * 1000
const totalCheckpoints = 48
const checkpointXs = Array.from(
  { length: totalCheckpoints },
  (_, i) => startTime + i * checkpointIntervalMs,
)
const marketStart = startTime
const marketEnd = startTime + totalCheckpoints * checkpointIntervalMs

const xScale = scaleTime({ domain: [marketStart, marketEnd], range: [0, 800] })
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

function stubOverlayMethods(overlay: Element) {
  ;(overlay as unknown as Record<string, unknown>).setPointerCapture = vi.fn()
  ;(overlay as unknown as Record<string, unknown>).releasePointerCapture = vi.fn()
  const svg = (overlay as SVGElement).ownerSVGElement ?? (overlay.closest('svg') as Element | null)
  if (svg) {
    ;(svg as unknown as Record<string, unknown>).getBoundingClientRect = () => MOCK_SVG_RECT
  }
}

function renderTool() {
  return render(
    <svg width={800} height={400}>
      <SelectTool
        xScale={xScale as Parameters<typeof SelectTool>[0]['xScale']}
        yScale={yScale as Parameters<typeof SelectTool>[0]['yScale']}
        innerWidth={800}
        innerHeight={400}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        checkpointXs={checkpointXs}
        marketStart={marketStart}
      />
    </svg>,
  )
}

/** Pixel x of checkpoint i in the test's xScale. */
function px(i: number) {
  return Number(xScale(checkpointXs[i]))
}
/** Pixel y for a given domain price. */
function py(value: number) {
  return Number(yScale(value))
}

beforeEach(() => {
  useDrawingStore.setState({
    state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
    totalCheckpoints,
    activeTool: 'select',
    selectedIndices: new Set<number>(),
    undoStack: [],
    redoStack: [],
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.restoreAllMocks()
})

describe('SelectTool', () => {
  it('renders an overlay rect tagged with data-tool="select"', () => {
    const { container } = renderTool()
    expect(
      container.querySelector('[data-testid="drawing-overlay"][data-tool="select"]'),
    ).toBeInTheDocument()
  })

  it('marquee drag selects checkpoints whose dot pixels fall within the bounds', () => {
    // Seed 3 dots: i=5 (price 150), i=10 (price 160), i=20 (price 140).
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    vals[10] = 160
    vals[20] = 140
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Marquee covering checkpoints 5 and 10 only:
    //   x range: from before px(5) to after px(10), excluding px(20)
    //   y range: covers prices 145..165 (roughly the middle band)
    const x1 = px(5) - 5
    const x2 = px(10) + 5
    const y1 = py(165)
    const y2 = py(145)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: x1, clientY: y1 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: x2, clientY: y2 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: x2, clientY: y2 })

    const sel = useDrawingStore.getState().selectedIndices
    expect(sel.has(5)).toBe(true)
    expect(sel.has(10)).toBe(true)
    expect(sel.has(20)).toBe(false)
    expect(sel.size).toBe(2)
  })

  it('a click on empty space (no drag) clears existing selection', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([5]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Click at a spot far from any dot, with no drag.
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 700, clientY: 50 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 700, clientY: 50 })

    expect(useDrawingStore.getState().selectedIndices.size).toBe(0)
  })

  it('clicking on an unselected dot replaces selection with just that dot', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    vals[10] = 160
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([10]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Pointer-down right on dot 5, then up at same spot (no drag).
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: px(5), clientY: py(150) })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: px(5), clientY: py(150) })

    const sel = useDrawingStore.getState().selectedIndices
    expect(sel.has(5)).toBe(true)
    expect(sel.has(10)).toBe(false)
    expect(sel.size).toBe(1)
  })

  it('dragging a selected dot vertically moves all selected dots by the same domain delta', () => {
    // Seed: dots at i=5 (150), i=10 (160). Both selected.
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    vals[10] = 160
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([5, 10]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Pointer down on dot 5 at price 150 (chart y = py(150)).
    // Then move pointer up to price 170 (chart y = py(170)) — delta = +20 in domain.
    const startY = py(150)
    const endY = py(170)
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: px(5), clientY: startY })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: px(5), clientY: endY })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: px(5), clientY: endY })

    const st = useDrawingStore.getState().state
    if (st.phase !== 'drawMode' && st.phase !== 'ready') throw new Error('expected quiescent phase')
    // i=5 was 150 → 170 (+20). i=10 was 160 → 180 (+20).
    expect(st.values[5]).toBeCloseTo(170, 1)
    expect(st.values[10]).toBeCloseTo(180, 1)
  })

  it('clamps drag delta so the most-extreme selected node stays within the y domain', () => {
    // Seed: dots at i=5 (190), i=10 (105). Both selected. yScale domain is [100, 200].
    // Trying to push them down by 50 should clamp to -5 (105 → 100), preserving spacing.
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 190
    vals[10] = 105
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([5, 10]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Drag down by 50 in domain (negative delta).
    const startY = py(190)
    const endY = py(140) // delta = -50 raw, expect -5 after clamp
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: px(5), clientY: startY })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: px(5), clientY: endY })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: px(5), clientY: endY })

    const st = useDrawingStore.getState().state
    if (st.phase !== 'drawMode' && st.phase !== 'ready') throw new Error('expected quiescent phase')
    // i=10 (lowest) clamps at 100; i=5 moves by the same delta -5 → 185.
    expect(st.values[10]).toBeCloseTo(100, 1)
    expect(st.values[5]).toBeCloseTo(185, 1)
  })

  it('shift+click on an unselected dot adds it to the selection (does not replace)', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    vals[10] = 160
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([5]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: px(10), clientY: py(160), shiftKey: true })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: px(10), clientY: py(160), shiftKey: true })

    const sel = useDrawingStore.getState().selectedIndices
    expect(sel.has(5)).toBe(true)
    expect(sel.has(10)).toBe(true)
    expect(sel.size).toBe(2)
    // No drag → no undo entry.
    expect(useDrawingStore.getState().undoStack).toHaveLength(0)
  })

  it('alt+click on a selected dot removes it from the selection', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    vals[10] = 160
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([5, 10]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: px(10), clientY: py(160), altKey: true })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: px(10), clientY: py(160), altKey: true })

    const sel = useDrawingStore.getState().selectedIndices
    expect(sel.has(5)).toBe(true)
    expect(sel.has(10)).toBe(false)
    expect(sel.size).toBe(1)
  })

  it('shift+marquee adds enclosed dots to the existing selection', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    vals[10] = 160
    vals[20] = 140
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([20]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Marquee covering 5 and 10.
    const x1 = px(5) - 5
    const x2 = px(10) + 5
    const y1 = py(165)
    const y2 = py(145)
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: x1, clientY: y1, shiftKey: true })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: x2, clientY: y2, shiftKey: true })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: x2, clientY: y2, shiftKey: true })

    const sel = useDrawingStore.getState().selectedIndices
    expect(sel.has(5)).toBe(true)
    expect(sel.has(10)).toBe(true)
    expect(sel.has(20)).toBe(true)
    expect(sel.size).toBe(3)
  })

  it('alt+marquee removes enclosed dots from the existing selection', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    vals[10] = 160
    vals[20] = 140
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([5, 10, 20]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Marquee covering 5 and 10.
    const x1 = px(5) - 5
    const x2 = px(10) + 5
    const y1 = py(165)
    const y2 = py(145)
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: x1, clientY: y1, altKey: true })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: x2, clientY: y2, altKey: true })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: x2, clientY: y2, altKey: true })

    const sel = useDrawingStore.getState().selectedIndices
    expect(sel.has(5)).toBe(false)
    expect(sel.has(10)).toBe(false)
    expect(sel.has(20)).toBe(true)
    expect(sel.size).toBe(1)
  })

  it('shift+click on empty space leaves selection unchanged', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([5]),
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 700, clientY: 50, shiftKey: true })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 700, clientY: 50, shiftKey: true })

    expect(useDrawingStore.getState().selectedIndices.has(5)).toBe(true)
    expect(useDrawingStore.getState().selectedIndices.size).toBe(1)
  })

  it('a move gesture pushes a single undo entry (one stroke wraps the drag)', () => {
    const vals = new Array(totalCheckpoints).fill(null) as (number | null)[]
    vals[5] = 150
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: vals },
      totalCheckpoints,
      selectedIndices: new Set<number>([5]),
      undoStack: [],
    })

    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: px(5), clientY: py(150) })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: px(5), clientY: py(160) })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: px(5), clientY: py(170) })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: px(5), clientY: py(170) })

    expect(useDrawingStore.getState().undoStack).toHaveLength(1)
  })
})
