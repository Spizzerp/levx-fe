import { describe, it } from 'vitest'

describe('DrawingLayer', () => {
  it.todo('calls setPointerCapture(pointerId) on pointerdown')
  it.todo('mutates raw stroke path via ref.setAttribute on pointermove (DOM spy)')
  it.todo('commits each crossing to drawingStore during pointermove')
  it.todo('does NOT update React state for the raw stroke during drag')
  it.todo('renders React-backed smoothed Catmull-Rom curve from drawingStore.values')
  it.todo('renders a checkpoint dot + price label at each captured value')
  it.todo('fades raw stroke to opacity 0 after pointerup')
  it.todo('only activates sweeping when pointerdown occurs inside future-time region')
})
