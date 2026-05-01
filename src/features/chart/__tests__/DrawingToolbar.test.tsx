import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { DrawingToolbar } from '@/features/chart/DrawingToolbar'
import { useDrawingStore } from '@/stores/drawingStore'

beforeEach(() => {
  useDrawingStore.setState({
    state: { phase: 'idle' },
    totalCheckpoints: 0,
    activeTool: 'freehand',
    undoStack: [],
    redoStack: [],
  })
})

describe('DrawingToolbar', () => {
  it('renders nothing when phase is idle', () => {
    const { container } = render(<DrawingToolbar top={40} right={88} />)
    expect(container.querySelector('[data-testid="drawing-toolbar"]')).toBeNull()
  })

  it('renders the freehand tool button when in drawMode', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null, null] },
      totalCheckpoints: 3,
      activeTool: 'freehand',
    })
    const { container } = render(<DrawingToolbar top={40} right={88} />)
    expect(container.querySelector('[data-testid="drawing-toolbar"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="drawing-tool-freehand"]')).toBeInTheDocument()
  })

  it('marks the active tool with data-active="true"', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null, null] },
      totalCheckpoints: 3,
      activeTool: 'freehand',
    })
    const { container } = render(<DrawingToolbar top={40} right={88} />)
    const btn = container.querySelector('[data-testid="drawing-tool-freehand"]') as HTMLButtonElement
    expect(btn.getAttribute('data-active')).toBe('true')
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls setActiveTool on click', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null, null] },
      totalCheckpoints: 3,
      activeTool: 'freehand',
    })
    const { container } = render(<DrawingToolbar top={40} right={88} />)
    const btn = container.querySelector('[data-testid="drawing-tool-freehand"]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(useDrawingStore.getState().activeTool).toBe('freehand')
  })

  it('positions itself at the supplied top/right offsets', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
    })
    const { container } = render(<DrawingToolbar top={40} right={88} />)
    const toolbar = container.querySelector('[data-testid="drawing-toolbar"]') as HTMLElement
    expect(toolbar.style.top).toBe('40px')
    expect(toolbar.style.right).toBe('88px')
  })

  it('renders both freehand and line buttons', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
    })
    const { container } = render(<DrawingToolbar top={40} right={88} />)
    expect(container.querySelector('[data-testid="drawing-tool-freehand"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="drawing-tool-line"]')).toBeInTheDocument()
  })

  it('switching tools updates active state', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
    })
    const { container } = render(<DrawingToolbar top={40} right={88} />)
    const lineBtn = container.querySelector('[data-testid="drawing-tool-line"]') as HTMLButtonElement
    fireEvent.click(lineBtn)
    expect(useDrawingStore.getState().activeTool).toBe('line')
  })

  it('Ctrl+Z calls undo when in draw mode', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null, null] },
      totalCheckpoints: 3,
      activeTool: 'freehand',
      undoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)

    // Push a snapshot via beginStroke→endStroke.
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([{ index: 0, y: 100 }])
    useDrawingStore.getState().endStroke()
    expect(useDrawingStore.getState().undoStack).toHaveLength(1)

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(useDrawingStore.getState().undoStack).toEqual([])
  })

  it('Cmd+Z calls undo (macOS)', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null, null] },
      totalCheckpoints: 3,
      activeTool: 'freehand',
      undoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().endStroke()
    expect(useDrawingStore.getState().undoStack).toHaveLength(1)

    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(useDrawingStore.getState().undoStack).toEqual([])
  })

  it('Ctrl+Shift+Z calls redo, not undo', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null, null] },
      totalCheckpoints: 3,
      activeTool: 'freehand',
      undoStack: [],
      redoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    // Set up: stroke + undo so redoStack has one entry.
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([{ index: 0, y: 50 }])
    useDrawingStore.getState().endStroke()
    useDrawingStore.getState().undo()
    expect(useDrawingStore.getState().redoStack).toHaveLength(1)

    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(useDrawingStore.getState().redoStack).toEqual([])
  })

  it('Ctrl+Y calls redo', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null, null] },
      totalCheckpoints: 3,
      activeTool: 'freehand',
      undoStack: [],
      redoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([{ index: 0, y: 50 }])
    useDrawingStore.getState().endStroke()
    useDrawingStore.getState().undo()
    expect(useDrawingStore.getState().redoStack).toHaveLength(1)

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    expect(useDrawingStore.getState().redoStack).toEqual([])
  })

  it('F switches to freehand tool', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'line',
      undoStack: [],
      redoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    fireEvent.keyDown(window, { key: 'f' })
    expect(useDrawingStore.getState().activeTool).toBe('freehand')
  })

  it('L switches to line tool', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
      undoStack: [],
      redoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    fireEvent.keyDown(window, { key: 'l' })
    expect(useDrawingStore.getState().activeTool).toBe('line')
  })

  it('tool shortcuts are ignored when Ctrl/Cmd is held', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
      undoStack: [],
      redoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    expect(useDrawingStore.getState().activeTool).toBe('freehand')
  })

  it('tool shortcuts are ignored when typing in an input', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
      undoStack: [],
      redoStack: [],
    })
    const { container } = render(
      <>
        <DrawingToolbar top={40} right={88} />
        <input data-testid="some-input" />
      </>,
    )
    const input = container.querySelector('[data-testid="some-input"]') as HTMLInputElement
    input.focus()
    fireEvent.keyDown(input, { key: 'l' })
    expect(useDrawingStore.getState().activeTool).toBe('freehand')
  })

  it('keydown listener is not registered when phase is idle', () => {
    useDrawingStore.setState({
      state: { phase: 'idle' },
      totalCheckpoints: 0,
      activeTool: 'freehand',
      undoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    // With no toolbar mounted (idle), the listener never attached.
    // Pre-seed a stack and verify Ctrl+Z does not consume it.
    useDrawingStore.setState({ undoStack: [[null, null, null]] })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(useDrawingStore.getState().undoStack).toHaveLength(1)
  })
})
