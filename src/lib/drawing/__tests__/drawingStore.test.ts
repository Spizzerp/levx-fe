import { describe, it, expect, beforeEach } from 'vitest'
import { useDrawingStore } from '@/stores/drawingStore'

// Reset store to idle before each test
beforeEach(() => {
  useDrawingStore.setState({ state: { phase: 'idle' }, totalCheckpoints: 0 })
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
})
