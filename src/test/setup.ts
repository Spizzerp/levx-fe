import '@testing-library/jest-dom/vitest'

// Mock ResizeObserver — required by @visx/responsive ParentSize in jsdom
;(globalThis as unknown as Record<string, unknown>).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Polyfill PointerEvent — jsdom 26 does not implement PointerEvent natively.
// Without this, fireEvent.pointerDown/Move/Up create generic Events that lack
// clientX, clientY, and pointerId properties, causing NaN in coordinate math.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    pointerId: number
    width: number
    height: number
    pressure: number
    tangentialPressure: number
    tiltX: number
    tiltY: number
    twist: number
    pointerType: string
    isPrimary: boolean

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
      this.width = params.width ?? 1
      this.height = params.height ?? 1
      this.pressure = params.pressure ?? 0
      this.tangentialPressure = params.tangentialPressure ?? 0
      this.tiltX = params.tiltX ?? 0
      this.tiltY = params.tiltY ?? 0
      this.twist = params.twist ?? 0
      this.pointerType = params.pointerType ?? 'mouse'
      this.isPrimary = params.isPrimary ?? true
    }
  }
  ;(globalThis as unknown as Record<string, unknown>).PointerEvent = PointerEvent
  ;(window as unknown as Record<string, unknown>).PointerEvent = PointerEvent
}
