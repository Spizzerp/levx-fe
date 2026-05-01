import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { scaleLinear, scaleTime } from '@visx/scale'

import { LineTool } from '@/features/chart/drawingTools/LineTool'
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
      <LineTool
        xScale={xScale as Parameters<typeof LineTool>[0]['xScale']}
        yScale={yScale as Parameters<typeof LineTool>[0]['yScale']}
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
    activeTool: 'line',
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.restoreAllMocks()
})

describe('LineTool', () => {
  it('renders overlay rect + preview line', () => {
    const { container } = renderTool()
    expect(container.querySelector('[data-testid="drawing-overlay"][data-tool="line"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="line-preview"]')).toBeInTheDocument()
  })

  it('transitions to sweeping on pointerdown inside future region', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })

    expect(useDrawingStore.getState().state.phase).toBe('sweeping')
  })

  it('updates preview line on pointermove (DOM spy)', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    const preview = container.querySelector('[data-testid="line-preview"]') as SVGLineElement
    stubOverlayMethods(overlay)

    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100, clientY: 200 })
    const setAttrSpy = vi.spyOn(preview, 'setAttribute')

    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 400, clientY: 100 })

    expect(setAttrSpy).toHaveBeenCalledWith('x2', '400')
    expect(setAttrSpy).toHaveBeenCalledWith('y2', '100')
  })

  it('commits sampled crossings on pointerup and ends the stroke', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Drag a horizontal line from x=0 to x=800 at y=200 (= price 150).
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 0, clientY: 200 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 800, clientY: 200 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 800, clientY: 200 })

    const state = useDrawingStore.getState().state
    // All 48 checkpoints should be filled with ~150 (horizontal line).
    expect(state.phase).toBe('ready')
    if (state.phase !== 'ready') throw new Error('expected ready')
    const filled = state.values.filter((v) => v !== null)
    expect(filled).toHaveLength(totalCheckpoints)
    for (const v of filled) {
      expect(v).toBeCloseTo(150, 1)
    }
  })

  it('rejects pointerdown in history region (before marketStart)', () => {
    const marketDuration = marketEnd - marketStart
    const wideXScale = scaleTime({
      domain: [marketStart - marketDuration, marketEnd],
      range: [0, 800],
    })
    const { container } = render(
      <svg width={800} height={400}>
        <LineTool
          xScale={wideXScale as Parameters<typeof LineTool>[0]['xScale']}
          yScale={yScale as Parameters<typeof LineTool>[0]['yScale']}
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

    // Guard rejected the click; phase remains drawMode.
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
  })

  it('samples a non-horizontal line linearly across in-range checkpoints', () => {
    const { container } = renderTool()
    const overlay = container.querySelector('[data-testid="drawing-overlay"]') as SVGRectElement
    stubOverlayMethods(overlay)

    // Diagonal: from screen (0, 400) → price 100, time marketStart
    //                  to screen (800, 0) → price 200, time marketEnd
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 0, clientY: 400 })
    fireEvent.pointerMove(overlay, { pointerId: 1, buttons: 1, clientX: 800, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 800, clientY: 0 })

    const state = useDrawingStore.getState().state
    if (state.phase !== 'ready') throw new Error('expected ready')

    // checkpointXs span [marketStart, marketStart + (n-1)*interval], so the
    // last checkpoint sits one interval before marketEnd. The drag spans the
    // full xScale domain [marketStart, marketEnd], so y at checkpoint i is
    // 100 + (i/n)*100 — index 0 ≈ 100, index 47 ≈ 197.9, midpoint ≈ 150.
    expect(state.values[0]).toBeCloseTo(100, 0)
    const last = state.values[totalCheckpoints - 1] as number
    expect(last).toBeGreaterThan(195)
    expect(last).toBeLessThan(200)
    const mid = state.values[Math.floor(totalCheckpoints / 2)]
    expect(mid).toBeGreaterThan(140)
    expect(mid).toBeLessThan(160)
  })
})
