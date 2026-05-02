import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { DrawingToolbar } from '@/features/chart/DrawingToolbar'
import { useBezierStore } from '@/stores/bezierStore'
import { useDrawingStore } from '@/stores/drawingStore'

beforeEach(() => {
  useDrawingStore.setState({
    state: { phase: 'idle' },
    totalCheckpoints: 0,
    activeTool: 'freehand',
    undoStack: [],
    redoStack: [],
  })
  useBezierStore.setState({ anchors: [], past: [], future: [] })
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

  it('renders freehand, line, bezier, and select buttons', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
    })
    const { container } = render(<DrawingToolbar top={40} right={88} />)
    expect(container.querySelector('[data-testid="drawing-tool-freehand"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="drawing-tool-line"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="drawing-tool-bezier"]')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="drawing-tool-select"]')).toBeInTheDocument()
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

  it('B switches to bezier tool', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
      undoStack: [],
      redoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    fireEvent.keyDown(window, { key: 'b' })
    expect(useDrawingStore.getState().activeTool).toBe('bezier')
  })

  it('S switches to select tool', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
      undoStack: [],
      redoStack: [],
    })
    render(<DrawingToolbar top={40} right={88} />)
    fireEvent.keyDown(window, { key: 's' })
    expect(useDrawingStore.getState().activeTool).toBe('select')
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

  it('Cmd+Z routes to bezier history when bezier active and past non-empty', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null, null] },
      totalCheckpoints: 3,
      activeTool: 'bezier',
      undoStack: [],
      redoStack: [],
    })
    useBezierStore.setState({
      anchors: [{ domainX: 1, domainY: 1, outHandle: null }],
      past: [{ kind: 'edit', before: [], after: [{ domainX: 1, domainY: 1, outHandle: null }] }],
      future: [],
    })
    render(<DrawingToolbar top={40} right={88} />)

    fireEvent.keyDown(window, { key: 'z', metaKey: true })

    expect(useBezierStore.getState().anchors).toEqual([])
    expect(useBezierStore.getState().past).toEqual([])
    expect(useBezierStore.getState().future).toHaveLength(1)
    // drawingStore was not touched (this was an 'edit' action, not a commit).
    expect(useDrawingStore.getState().undoStack).toEqual([])
  })

  it('Cmd+Z on a bezier commit-kind action also calls drawingStore.undo()', () => {
    // Set up: drawingStore has a values snapshot in undoStack (mimicking what
    // commit pushes), and bezierStore.past has a 'commit' action.
    useDrawingStore.setState({
      state: { phase: 'ready', values: [42, 42] },
      totalCheckpoints: 2,
      activeTool: 'bezier',
      undoStack: [[null, null]],
      redoStack: [],
    })
    useBezierStore.setState({
      anchors: [],
      past: [{ kind: 'commit', before: [{ domainX: 1, domainY: 1, outHandle: null }] }],
      future: [],
    })
    render(<DrawingToolbar top={40} right={88} />)

    fireEvent.keyDown(window, { key: 'z', metaKey: true })

    // Bezier anchors restored from pre-commit snapshot.
    expect(useBezierStore.getState().anchors).toHaveLength(1)
    expect(useBezierStore.getState().past).toEqual([])
    expect(useBezierStore.getState().future).toHaveLength(1)
    // drawingStore.undo() was called — values reverted, undoStack popped.
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
    expect(useDrawingStore.getState().undoStack).toEqual([])
  })

  it('Cmd+Z falls through to drawingStore when bezier active but past empty', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'bezier',
      undoStack: [[null]],
      redoStack: [],
    })
    useBezierStore.setState({ anchors: [], past: [], future: [] })
    render(<DrawingToolbar top={40} right={88} />)

    fireEvent.keyDown(window, { key: 'z', metaKey: true })

    // bezier untouched, drawingStore.undo() was called.
    expect(useBezierStore.getState().future).toEqual([])
    expect(useDrawingStore.getState().undoStack).toEqual([])
  })

  it('Cmd+Shift+Z on bezier commit redoes the commit and calls drawingStore.redo()', () => {
    // Set up: post-undo state — bezier future has a commit, drawingStore.redoStack has the values.
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null, null] },
      totalCheckpoints: 2,
      activeTool: 'bezier',
      undoStack: [],
      redoStack: [[42, 42]],
    })
    useBezierStore.setState({
      anchors: [{ domainX: 1, domainY: 1, outHandle: null }],
      past: [],
      future: [{ kind: 'commit', before: [{ domainX: 1, domainY: 1, outHandle: null }] }],
    })
    render(<DrawingToolbar top={40} right={88} />)

    fireEvent.keyDown(window, { key: 'Z', metaKey: true, shiftKey: true })

    // Bezier anchors cleared (commit re-applied).
    expect(useBezierStore.getState().anchors).toEqual([])
    expect(useBezierStore.getState().future).toEqual([])
    // drawingStore.redo() was called — values restored.
    expect(useDrawingStore.getState().state.phase).toBe('ready')
    expect(useDrawingStore.getState().redoStack).toEqual([])
  })

  it('Cmd+Z does NOT consult bezier history when active tool is freehand', () => {
    useDrawingStore.setState({
      state: { phase: 'drawMode', values: [null] },
      totalCheckpoints: 1,
      activeTool: 'freehand',
      undoStack: [[null]],
      redoStack: [],
    })
    useBezierStore.setState({
      anchors: [],
      past: [{ kind: 'edit', before: [], after: [{ domainX: 1, domainY: 1, outHandle: null }] }],
      future: [],
    })
    render(<DrawingToolbar top={40} right={88} />)

    fireEvent.keyDown(window, { key: 'z', metaKey: true })

    // bezier untouched (active tool isn't bezier).
    expect(useBezierStore.getState().past).toHaveLength(1)
    // drawingStore.undo() was called.
    expect(useDrawingStore.getState().undoStack).toEqual([])
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
