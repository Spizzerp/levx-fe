import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { scaleLinear, scaleTime } from '@visx/scale'

import { BezierTool } from '@/features/chart/drawingTools/BezierTool'
import { useDrawingStore } from '@/stores/drawingStore'

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
      <BezierTool
        xScale={xScale as Parameters<typeof BezierTool>[0]['xScale']}
        yScale={yScale as Parameters<typeof BezierTool>[0]['yScale']}
        innerWidth={800}
        innerHeight={400}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        checkpointXs={checkpointXs}
        marketStart={marketStart}
      />
    </svg>,
  )
}

beforeEach(() => {
  useDrawingStore.setState({
    state: { phase: 'drawMode', values: new Array(totalCheckpoints).fill(null) },
    totalCheckpoints,
    undoStack: [],
    redoStack: [],
    activeTool: 'bezier',
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BezierTool', () => {
  it('renders only the overlay rect when no anchors are placed', () => {
    const { container } = renderTool()
    expect(container.querySelector('[data-testid="drawing-overlay"][data-tool="bezier"]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(0)
    expect(container.querySelector('[data-testid="bezier-commit"]')).toBeNull()
  })

  it('click (no drag) places a corner anchor', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 100, clientY: 200 })

    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(1)
    // No handle indicator on a corner anchor.
    expect(container.querySelector('[data-testid="bezier-anchor"] line')).toBeNull()
  })

  it('click-drag places a smooth anchor with handle indicators', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 150, clientY: 180 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 150, clientY: 180 })

    const anchor = container.querySelector('[data-testid="bezier-anchor"]') as SVGGElement
    expect(anchor).toBeInTheDocument()
    // Smooth anchor renders the handle line + mirror line + 2 handle dots.
    expect(anchor.querySelectorAll('line').length).toBe(2)
    expect(anchor.querySelectorAll('circle').length).toBe(3) // 2 handle + 1 anchor
  })

  it('shows the commit ✓ button only after 2+ anchors', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    expect(container.querySelector('[data-testid="bezier-commit"]')).toBeNull()

    fireEvent.pointerDown(overlay, { pointerId: 2, clientX: 400, clientY: 100 })
    fireEvent.pointerUp(overlay, { pointerId: 2, clientX: 400, clientY: 100 })
    expect(container.querySelector('[data-testid="bezier-commit"]')).toBeInTheDocument()
  })

  it('clicking ✓ commits crossings via the store and ends with phase=ready when all filled', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Place anchors at the extreme x values so every checkpoint falls inside the segment.
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 0, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 0, clientY: 200 })
    fireEvent.pointerDown(overlay, { pointerId: 2, clientX: 800, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 2, clientX: 800, clientY: 200 })

    const commit = container.querySelector('[data-testid="bezier-commit"]') as SVGGElement
    fireEvent.click(commit)

    const state = useDrawingStore.getState().state
    expect(state.phase).toBe('ready')
    if (state.phase !== 'ready') throw new Error('expected ready')
    // All 48 checkpoints should be filled at ~150 (horizontal corner-to-corner line).
    expect(state.values).toHaveLength(totalCheckpoints)
    for (const v of state.values) expect(v).toBeCloseTo(150, 0)
    // After commit, anchors are cleared.
    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(0)
    // Commit pushed exactly one undo snapshot.
    expect(useDrawingStore.getState().undoStack).toHaveLength(1)
  })

  it('Backspace pops the last anchor', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerDown(overlay, { pointerId: 2, clientX: 200, clientY: 100 })
    fireEvent.pointerUp(overlay, { pointerId: 2, clientX: 200, clientY: 100 })
    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(2)

    act(() => {
      fireEvent.keyDown(window, { key: 'Backspace' })
    })
    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(1)
  })

  it('Escape clears all anchors without touching the store', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerDown(overlay, { pointerId: 2, clientX: 200, clientY: 100 })
    fireEvent.pointerUp(overlay, { pointerId: 2, clientX: 200, clientY: 100 })

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(0)
    // Store untouched — phase still drawMode, no undoStack growth.
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
    expect(useDrawingStore.getState().undoStack).toEqual([])
  })

  it('Enter commits when 2+ anchors are placed', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 0, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 0, clientY: 200 })
    fireEvent.pointerDown(overlay, { pointerId: 2, clientX: 800, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 2, clientX: 800, clientY: 200 })

    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(useDrawingStore.getState().state.phase).toBe('ready')
  })

  it('rejects pointerdown in history region', () => {
    const marketDuration = marketEnd - marketStart
    const wideXScale = scaleTime({
      domain: [marketStart - marketDuration, marketEnd],
      range: [0, 800],
    })
    const { container } = render(
      <svg width={800} height={400}>
        <BezierTool
          xScale={wideXScale as Parameters<typeof BezierTool>[0]['xScale']}
          yScale={yScale as Parameters<typeof BezierTool>[0]['yScale']}
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

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 100, clientY: 200 })

    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(0)
  })
})
