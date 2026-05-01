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

  it('click-drag places a smooth anchor with handle indicators + hit areas', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 150, clientY: 180 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 150, clientY: 180 })

    const anchor = container.querySelector('[data-testid="bezier-anchor"]') as SVGGElement
    expect(anchor).toBeInTheDocument()
    // Smooth anchor renders 2 lines (handle + mirror) and 5 circles
    // (2 visual handle dots + 2 hit-area dots + 1 anchor dot).
    expect(anchor.querySelectorAll('line').length).toBe(2)
    expect(anchor.querySelectorAll('circle').length).toBe(5)
    expect(anchor.querySelectorAll('[data-testid="bezier-handle-hit"]').length).toBe(2)
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

  it('corner anchor has no handle hit areas', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Pure click — no drag — places a corner anchor.
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 100, clientY: 200 })

    const anchor = container.querySelector('[data-testid="bezier-anchor"]') as SVGGElement
    expect(anchor.querySelectorAll('[data-testid="bezier-handle-hit"]').length).toBe(0)
  })

  it('dragging the out-handle updates the anchor outHandle and reshapes the path', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Place a smooth anchor at (100, 200) with handle dragged to (150, 180).
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 150, clientY: 180 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 150, clientY: 180 })

    const outHit = container.querySelector(
      '[data-testid="bezier-handle-hit"][data-side="out"]',
    ) as SVGCircleElement
    expect(outHit).toBeInTheDocument()
    // Initial out-handle position: cx≈150, cy≈180.
    expect(Number(outHit.getAttribute('cx'))).toBeCloseTo(150, 5)
    expect(Number(outHit.getAttribute('cy'))).toBeCloseTo(180, 5)
    stubOverlayMethods(outHit)

    // Drag the out-handle from (150, 180) to (200, 100).
    fireEvent.pointerDown(outHit, { pointerId: 2, clientX: 150, clientY: 180 })
    fireEvent.pointerMove(outHit, { pointerId: 2, buttons: 1, clientX: 200, clientY: 100 })
    fireEvent.pointerUp(outHit, { pointerId: 2, clientX: 200, clientY: 100 })

    // After release, the out-handle hit circle should be at the new position.
    const outHitAfter = container.querySelector(
      '[data-testid="bezier-handle-hit"][data-side="out"]',
    ) as SVGCircleElement
    expect(Number(outHitAfter.getAttribute('cx'))).toBeCloseTo(200, 5)
    expect(Number(outHitAfter.getAttribute('cy'))).toBeCloseTo(100, 5)
  })

  it('dragging the in-handle mirrors across the anchor (symmetric handles)', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Anchor at (100, 200), out-handle at (150, 180). Mirrored in-handle at (50, 220).
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 150, clientY: 180 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 150, clientY: 180 })

    const inHit = container.querySelector(
      '[data-testid="bezier-handle-hit"][data-side="in"]',
    ) as SVGCircleElement
    expect(Number(inHit.getAttribute('cx'))).toBeCloseTo(50, 5)
    expect(Number(inHit.getAttribute('cy'))).toBeCloseTo(220, 5)
    stubOverlayMethods(inHit)

    // Drag the in-handle to (60, 250). Expected mirror: outHandle at (140, 150).
    fireEvent.pointerDown(inHit, { pointerId: 2, clientX: 50, clientY: 220 })
    fireEvent.pointerMove(inHit, { pointerId: 2, buttons: 1, clientX: 60, clientY: 250 })
    fireEvent.pointerUp(inHit, { pointerId: 2, clientX: 60, clientY: 250 })

    const outHitAfter = container.querySelector(
      '[data-testid="bezier-handle-hit"][data-side="out"]',
    ) as SVGCircleElement
    // anchor (100,200) reflected from (60,250): out = 2*100-60=140, 2*200-250=150
    expect(Number(outHitAfter.getAttribute('cx'))).toBeCloseTo(140, 5)
    expect(Number(outHitAfter.getAttribute('cy'))).toBeCloseTo(150, 5)
  })

  it('handle drag does not place a new anchor (stopPropagation)', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Place a smooth anchor.
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 150, clientY: 180 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 150, clientY: 180 })
    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(1)

    const outHit = container.querySelector(
      '[data-testid="bezier-handle-hit"][data-side="out"]',
    ) as SVGCircleElement
    stubOverlayMethods(outHit)

    // Pointerdown on the handle should NOT bubble to the rect.
    fireEvent.pointerDown(outHit, { pointerId: 2, clientX: 150, clientY: 180 })
    fireEvent.pointerUp(outHit, { pointerId: 2, clientX: 150, clientY: 180 })

    // Still only one anchor — handle drag did not create a new one.
    expect(container.querySelectorAll('[data-testid="bezier-anchor"]').length).toBe(1)
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
