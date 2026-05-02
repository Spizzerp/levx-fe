import { describe, it, expect, beforeEach } from 'vitest'
import { useDrawingStore } from '@/stores/drawingStore'

// Reset store to idle before each test
beforeEach(() => {
  useDrawingStore.setState({
    state: { phase: 'idle' },
    totalCheckpoints: 0,
    undoStack: [],
    redoStack: [],
    activeTool: 'freehand',
  })
})

describe('drawingStore', () => {
  it('transitions idle -> drawMode on enterDrawMode(n)', () => {
    useDrawingStore.getState().enterDrawMode(48)
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
  })

  it('initializes values array as (null)[n] on enterDrawMode', () => {
    useDrawingStore.getState().enterDrawMode(48)
    const state = useDrawingStore.getState().state
    if (state.phase !== 'drawMode') throw new Error('expected drawMode')
    expect(state.values).toHaveLength(48)
    expect(state.values.every((v) => v === null)).toBe(true)
  })

  it('transitions drawMode -> sweeping on beginStroke', () => {
    useDrawingStore.getState().enterDrawMode(5)
    useDrawingStore.getState().beginStroke()
    expect(useDrawingStore.getState().state.phase).toBe('sweeping')
  })

  it('transitions sweeping -> drawMode on endStroke when values partial', () => {
    useDrawingStore.getState().enterDrawMode(5)
    useDrawingStore.getState().beginStroke()
    // Set only 3 of 5 values
    useDrawingStore.getState().setCheckpointValues([
      { index: 0, y: 100 },
      { index: 1, y: 110 },
      { index: 2, y: 120 },
    ])
    useDrawingStore.getState().endStroke()
    expect(useDrawingStore.getState().state.phase).toBe('drawMode')
  })

  it('transitions sweeping -> ready on endStroke when all values non-null', () => {
    useDrawingStore.getState().enterDrawMode(3)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([
      { index: 0, y: 100 },
      { index: 1, y: 110 },
      { index: 2, y: 120 },
    ])
    useDrawingStore.getState().endStroke()
    expect(useDrawingStore.getState().state.phase).toBe('ready')
  })

  it('allows ready -> sweeping on beginStroke (multi-stroke overwrite)', () => {
    useDrawingStore.getState().enterDrawMode(3)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([
      { index: 0, y: 100 },
      { index: 1, y: 110 },
      { index: 2, y: 120 },
    ])
    useDrawingStore.getState().endStroke()
    // Now in ready — re-enter sweeping for multi-stroke
    useDrawingStore.getState().beginStroke()
    expect(useDrawingStore.getState().state.phase).toBe('sweeping')
  })

  it('setCheckpointValues writes domain prices (numbers) at given indices', () => {
    useDrawingStore.getState().enterDrawMode(5)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([
      { index: 2, y: 155.5 },
      { index: 4, y: 200.0 },
    ])
    const state = useDrawingStore.getState().state
    if (state.phase !== 'sweeping') throw new Error('expected sweeping')
    expect(state.values[2]).toBe(155.5)
    expect(state.values[4]).toBe(200.0)
    // Unset indices remain null
    expect(state.values[0]).toBeNull()
    expect(state.values[1]).toBeNull()
    expect(state.values[3]).toBeNull()
  })

  it('setCheckpointValues is a noop when phase is not sweeping', () => {
    useDrawingStore.getState().enterDrawMode(5)
    // Still in drawMode, not sweeping
    useDrawingStore.getState().setCheckpointValues([{ index: 0, y: 999 }])
    const state = useDrawingStore.getState().state
    if (state.phase !== 'drawMode') throw new Error('expected drawMode')
    expect(state.values[0]).toBeNull()
  })

  it('reset clears all checkpoint values to null and returns to drawMode', () => {
    useDrawingStore.getState().enterDrawMode(3)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([
      { index: 0, y: 100 },
      { index: 1, y: 110 },
      { index: 2, y: 120 },
    ])
    useDrawingStore.getState().endStroke() // → ready
    useDrawingStore.getState().reset()
    const state = useDrawingStore.getState().state
    expect(state.phase).toBe('drawMode')
    if (state.phase !== 'drawMode') throw new Error('expected drawMode')
    expect(state.values.every((v) => v === null)).toBe(true)
  })

  it('exitDrawMode returns to idle from any phase', () => {
    useDrawingStore.getState().enterDrawMode(5)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().exitDrawMode()
    expect(useDrawingStore.getState().state.phase).toBe('idle')
  })

  it('values array length always equals totalCheckpoints', () => {
    useDrawingStore.getState().enterDrawMode(12)
    expect(useDrawingStore.getState().totalCheckpoints).toBe(12)
    const state = useDrawingStore.getState().state
    if (state.phase !== 'drawMode') throw new Error('expected drawMode')
    expect(state.values).toHaveLength(12)
  })

  it('multi-stroke overwrite replaces prior value at crossed index', () => {
    useDrawingStore.getState().enterDrawMode(3)
    // First stroke — fill all values
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([
      { index: 0, y: 100 },
      { index: 1, y: 110 },
      { index: 2, y: 120 },
    ])
    useDrawingStore.getState().endStroke() // → ready
    // Second stroke — overwrite index 1
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([{ index: 1, y: 999 }])
    const state = useDrawingStore.getState().state
    if (state.phase !== 'sweeping') throw new Error('expected sweeping')
    expect(state.values[1]).toBe(999)
    // Other indices retain prior values
    expect(state.values[0]).toBe(100)
    expect(state.values[2]).toBe(120)
  })

  it('confirm from ready -> confirming', () => {
    useDrawingStore.getState().enterDrawMode(2)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([
      { index: 0, y: 100 },
      { index: 1, y: 200 },
    ])
    useDrawingStore.getState().endStroke() // → ready
    useDrawingStore.getState().confirm()
    expect(useDrawingStore.getState().state.phase).toBe('confirming')
  })

  it('onTxSuccess -> submitted with txSig', () => {
    useDrawingStore.getState().enterDrawMode(2)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([
      { index: 0, y: 100 },
      { index: 1, y: 200 },
    ])
    useDrawingStore.getState().endStroke()
    useDrawingStore.getState().confirm()
    useDrawingStore.getState().onTxSuccess('abc123sig')
    const state = useDrawingStore.getState().state
    expect(state.phase).toBe('submitted')
    if (state.phase !== 'submitted') throw new Error('expected submitted')
    expect(state.txSig).toBe('abc123sig')
  })

  it('onTxError from confirming -> error with message and values preserved', () => {
    useDrawingStore.getState().enterDrawMode(2)
    useDrawingStore.getState().beginStroke()
    useDrawingStore.getState().setCheckpointValues([
      { index: 0, y: 100 },
      { index: 1, y: 200 },
    ])
    useDrawingStore.getState().endStroke()
    useDrawingStore.getState().confirm()
    useDrawingStore.getState().onTxError('Transaction failed')
    const state = useDrawingStore.getState().state
    expect(state.phase).toBe('error')
    if (state.phase !== 'error') throw new Error('expected error')
    expect(state.message).toBe('Transaction failed')
    expect(state.values).toEqual([100, 200])
  })

  it('beginStroke from idle is a noop (strict transition guard)', () => {
    // state is idle — beginStroke should not change phase
    useDrawingStore.getState().beginStroke()
    expect(useDrawingStore.getState().state.phase).toBe('idle')
  })

  it("activeTool defaults to 'freehand'", () => {
    expect(useDrawingStore.getState().activeTool).toBe('freehand')
  })

  it('setActiveTool updates the active tool', () => {
    useDrawingStore.getState().setActiveTool('line')
    expect(useDrawingStore.getState().activeTool).toBe('line')
  })

  describe('undo', () => {
    it('undoStack is empty after enterDrawMode', () => {
      useDrawingStore.getState().enterDrawMode(3)
      expect(useDrawingStore.getState().undoStack).toEqual([])
    })

    it('beginStroke pushes a values snapshot onto undoStack', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      const stack = useDrawingStore.getState().undoStack
      expect(stack).toHaveLength(1)
      expect(stack[0]).toEqual({ kind: 'values', values: [null, null, null] })
    })

    it('two strokes push two snapshots in order', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
        { index: 1, y: 110 },
        { index: 2, y: 120 },
      ])
      useDrawingStore.getState().endStroke() // → ready
      useDrawingStore.getState().beginStroke() // re-enter sweeping
      const stack = useDrawingStore.getState().undoStack
      expect(stack).toHaveLength(2)
      expect(stack[0]).toEqual({ kind: 'values', values: [null, null, null] })
      expect(stack[1]).toEqual({ kind: 'values', values: [100, 110, 120] })
    })

    it('undo restores values to the most recent snapshot and pops the stack', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
        { index: 1, y: 110 },
        { index: 2, y: 120 },
      ])
      useDrawingStore.getState().endStroke() // → ready
      useDrawingStore.getState().undo()
      const state = useDrawingStore.getState().state
      expect(state.phase).toBe('drawMode')
      if (state.phase !== 'drawMode') throw new Error('expected drawMode')
      expect(state.values).toEqual([null, null, null])
      expect(useDrawingStore.getState().undoStack).toEqual([])
    })

    it('undo restores phase to ready when restored snapshot has no nulls', () => {
      useDrawingStore.getState().enterDrawMode(3)
      // Stroke 1 — fill all values
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
        { index: 1, y: 110 },
        { index: 2, y: 120 },
      ])
      useDrawingStore.getState().endStroke() // → ready
      // Stroke 2 — overwrite one
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([{ index: 1, y: 999 }])
      useDrawingStore.getState().endStroke() // → ready (still all filled)
      // Undo back to stroke-1 result
      useDrawingStore.getState().undo()
      const state = useDrawingStore.getState().state
      expect(state.phase).toBe('ready')
      if (state.phase !== 'ready') throw new Error('expected ready')
      expect(state.values).toEqual([100, 110, 120])
    })

    it('undo is a noop while sweeping (would orphan pointer capture)', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([{ index: 0, y: 100 }])
      const stackBefore = useDrawingStore.getState().undoStack
      useDrawingStore.getState().undo()
      // Phase still sweeping, stack unchanged.
      expect(useDrawingStore.getState().state.phase).toBe('sweeping')
      expect(useDrawingStore.getState().undoStack).toEqual(stackBefore)
    })

    it('undo is a noop when stack is empty', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().undo()
      expect(useDrawingStore.getState().state.phase).toBe('drawMode')
      expect(useDrawingStore.getState().undoStack).toEqual([])
    })

    it('reset clears undoStack', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([{ index: 0, y: 100 }])
      useDrawingStore.getState().endStroke()
      expect(useDrawingStore.getState().undoStack.length).toBeGreaterThan(0)
      useDrawingStore.getState().reset()
      expect(useDrawingStore.getState().undoStack).toEqual([])
    })

    it('exitDrawMode clears undoStack', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().endStroke()
      useDrawingStore.getState().exitDrawMode()
      expect(useDrawingStore.getState().undoStack).toEqual([])
    })

    it('undo over a values entry prunes selection indices that become null', () => {
      // Defensive prune — direct state injection so we can simulate selection
      // surviving a values rewind in scenarios that bypass the queue
      // (e.g. test setup, future code paths). Normal user flows go through
      // the unified stack and undo selection chronologically first.
      useDrawingStore.setState({
        state: { phase: 'ready', values: [100, 110, 120] },
        totalCheckpoints: 3,
        undoStack: [{ kind: 'values', values: [100, null, null] }],
        redoStack: [],
        selectedIndices: new Set([0, 1, 2]),
      })

      useDrawingStore.getState().undo()

      // Only index 0 survives the rewind → selection pruned to {0}.
      expect(useDrawingStore.getState().selectedIndices).toEqual(new Set([0]))
    })

    it('undoStack depth is capped at 50', () => {
      useDrawingStore.getState().enterDrawMode(2)
      // 60 strokes, each just begin+end without committing values stays in drawMode
      for (let i = 0; i < 60; i++) {
        useDrawingStore.getState().beginStroke()
        useDrawingStore.getState().endStroke()
      }
      expect(useDrawingStore.getState().undoStack.length).toBe(50)
    })
  })

  describe('redo', () => {
    it('undo pushes the current values onto redoStack', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
        { index: 1, y: 110 },
        { index: 2, y: 120 },
      ])
      useDrawingStore.getState().endStroke() // → ready
      useDrawingStore.getState().undo()
      expect(useDrawingStore.getState().redoStack).toEqual([
        { kind: 'values', values: [100, 110, 120] },
      ])
    })

    it('redo restores the most recently undone state', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
        { index: 1, y: 110 },
        { index: 2, y: 120 },
      ])
      useDrawingStore.getState().endStroke() // → ready, values=[100,110,120]
      useDrawingStore.getState().undo()       // → drawMode, values=[null,null,null]
      useDrawingStore.getState().redo()       // → ready, values=[100,110,120]
      const state = useDrawingStore.getState().state
      expect(state.phase).toBe('ready')
      if (state.phase !== 'ready') throw new Error('expected ready')
      expect(state.values).toEqual([100, 110, 120])
    })

    it('redo is a noop when redoStack is empty', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().redo()
      expect(useDrawingStore.getState().state.phase).toBe('drawMode')
    })

    it('redo is a noop while sweeping', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().endStroke() // → drawMode (still partial)
      useDrawingStore.getState().undo()       // populates redoStack
      useDrawingStore.getState().beginStroke() // → sweeping
      const stackBefore = useDrawingStore.getState().redoStack
      useDrawingStore.getState().redo()
      expect(useDrawingStore.getState().state.phase).toBe('sweeping')
      expect(useDrawingStore.getState().redoStack).toEqual(stackBefore)
    })

    it('beginning a new stroke clears the redoStack (branching)', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
      ])
      useDrawingStore.getState().endStroke()
      useDrawingStore.getState().undo()
      expect(useDrawingStore.getState().redoStack.length).toBeGreaterThan(0)
      // New stroke from the undone state — redo is no longer reachable.
      useDrawingStore.getState().beginStroke()
      expect(useDrawingStore.getState().redoStack).toEqual([])
    })

    it('undo / redo round-trip preserves the value sequence across many steps', () => {
      useDrawingStore.getState().enterDrawMode(3)

      // stroke 1: [100,110,120]
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
        { index: 1, y: 110 },
        { index: 2, y: 120 },
      ])
      useDrawingStore.getState().endStroke()

      // stroke 2: overwrite to [200,210,220]
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 200 },
        { index: 1, y: 210 },
        { index: 2, y: 220 },
      ])
      useDrawingStore.getState().endStroke()

      // Undo twice
      useDrawingStore.getState().undo() // → [100,110,120]
      useDrawingStore.getState().undo() // → [null,null,null]
      // Redo twice
      useDrawingStore.getState().redo() // → [100,110,120]
      useDrawingStore.getState().redo() // → [200,210,220]

      const state = useDrawingStore.getState().state
      if (state.phase !== 'ready') throw new Error('expected ready')
      expect(state.values).toEqual([200, 210, 220])
    })

    it('redo over a values entry prunes selection indices still null in the restored snapshot', () => {
      // Same defensive guard as undo; direct injection avoids the chronology
      // tangling that comes from selection mutations branching the redo
      // future.
      useDrawingStore.setState({
        state: { phase: 'drawMode', values: [null, null, null] },
        totalCheckpoints: 3,
        undoStack: [],
        redoStack: [{ kind: 'values', values: [100, null, null] }],
        selectedIndices: new Set([0, 1, 2]),
      })

      useDrawingStore.getState().redo()

      expect(useDrawingStore.getState().selectedIndices).toEqual(new Set([0]))
    })

    it('reset clears redoStack', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().endStroke()
      useDrawingStore.getState().undo()
      expect(useDrawingStore.getState().redoStack.length).toBeGreaterThan(0)
      useDrawingStore.getState().reset()
      expect(useDrawingStore.getState().redoStack).toEqual([])
    })

    it('exitDrawMode clears redoStack', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().endStroke()
      useDrawingStore.getState().undo()
      useDrawingStore.getState().exitDrawMode()
      expect(useDrawingStore.getState().redoStack).toEqual([])
    })
  })

  describe('unified history (selection + values)', () => {
    it('setSelectedIndices pushes a selection entry capturing the prior selection', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().setSelectedIndices(new Set([0, 1]))
      const stack = useDrawingStore.getState().undoStack
      expect(stack).toHaveLength(1)
      expect(stack[0]).toEqual({ kind: 'selection', selection: new Set() })
    })

    it('setSelectedIndices is a noop when content is identical', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().setSelectedIndices(new Set([0, 1]))
      // Same content, different reference — should NOT push.
      useDrawingStore.getState().setSelectedIndices(new Set([0, 1]))
      expect(useDrawingStore.getState().undoStack).toHaveLength(1)
    })

    it('clearSelectedIndices pushes an entry only when selection was non-empty', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().clearSelectedIndices()
      expect(useDrawingStore.getState().undoStack).toEqual([])

      useDrawingStore.getState().setSelectedIndices(new Set([2]))
      useDrawingStore.getState().clearSelectedIndices()
      // setSelectedIndices push + clearSelectedIndices push = 2 entries.
      expect(useDrawingStore.getState().undoStack).toHaveLength(2)
    })

    it('Cmd+Z chronological order: undoes selection then preceding stroke', () => {
      useDrawingStore.getState().enterDrawMode(3)
      // Stroke first.
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
        { index: 1, y: 110 },
        { index: 2, y: 120 },
      ])
      useDrawingStore.getState().endStroke() // → ready
      // Then selection.
      useDrawingStore.getState().setSelectedIndices(new Set([0, 1, 2]))

      // First undo pops the selection (most recent).
      useDrawingStore.getState().undo()
      expect(useDrawingStore.getState().selectedIndices).toEqual(new Set())
      // Values still intact — phase still ready.
      const s1 = useDrawingStore.getState().state
      expect(s1.phase).toBe('ready')

      // Second undo pops the values stroke.
      useDrawingStore.getState().undo()
      const s2 = useDrawingStore.getState().state
      expect(s2.phase).toBe('drawMode')
      if (s2.phase !== 'drawMode') throw new Error('expected drawMode')
      expect(s2.values).toEqual([null, null, null])
    })

    it('Cmd+Shift+Z restores both stroke and selection in original order', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([
        { index: 0, y: 100 },
        { index: 1, y: 110 },
        { index: 2, y: 120 },
      ])
      useDrawingStore.getState().endStroke()
      useDrawingStore.getState().setSelectedIndices(new Set([0, 2]))

      // Undo twice — selection then values.
      useDrawingStore.getState().undo()
      useDrawingStore.getState().undo()

      // Redo twice — values then selection.
      useDrawingStore.getState().redo()
      const afterFirstRedo = useDrawingStore.getState().state
      expect(afterFirstRedo.phase).toBe('ready')
      expect(useDrawingStore.getState().selectedIndices).toEqual(new Set())

      useDrawingStore.getState().redo()
      expect(useDrawingStore.getState().selectedIndices).toEqual(new Set([0, 2]))
    })

    it('a fresh selection action clears the redo future (branching)', () => {
      useDrawingStore.getState().enterDrawMode(3)
      useDrawingStore.getState().beginStroke()
      useDrawingStore.getState().setCheckpointValues([{ index: 0, y: 100 }])
      useDrawingStore.getState().endStroke()
      useDrawingStore.getState().undo()
      expect(useDrawingStore.getState().redoStack.length).toBeGreaterThan(0)
      useDrawingStore.getState().setSelectedIndices(new Set([0]))
      expect(useDrawingStore.getState().redoStack).toEqual([])
    })
  })
})
