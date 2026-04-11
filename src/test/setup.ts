import '@testing-library/jest-dom/vitest'

// Mock ResizeObserver — required by @visx/responsive ParentSize in jsdom
;(globalThis as unknown as Record<string, unknown>).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
