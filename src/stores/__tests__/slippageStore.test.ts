import { describe, it, expect, beforeEach } from 'vitest'

import {
  SLIPPAGE_DEFAULT,
  SLIPPAGE_MAX,
  getSlippageTolerance,
  useSlippageStore,
} from '@/stores/slippageStore'

beforeEach(() => {
  localStorage.clear()
  // Reset to default so each test starts from a known state. The persist
  // middleware only rehydrates from storage on next mount; resetState here
  // mirrors what a fresh page load would yield.
  useSlippageStore.setState({ tolerance: SLIPPAGE_DEFAULT, preset: SLIPPAGE_DEFAULT })
})

describe('slippageStore', () => {
  it('defaults to SLIPPAGE_DEFAULT and exposes the same value via the helper', () => {
    expect(useSlippageStore.getState().tolerance).toBe(SLIPPAGE_DEFAULT)
    expect(getSlippageTolerance()).toBe(SLIPPAGE_DEFAULT)
  })

  it('setPreset updates tolerance and clears custom mode', () => {
    useSlippageStore.getState().setCustom(0.02)
    expect(useSlippageStore.getState().preset).toBeNull()

    useSlippageStore.getState().setPreset(0.01)
    expect(useSlippageStore.getState().tolerance).toBe(0.01)
    expect(useSlippageStore.getState().preset).toBe(0.01)
  })

  it('setCustom clamps to [0, SLIPPAGE_MAX]', () => {
    useSlippageStore.getState().setCustom(-0.5)
    expect(useSlippageStore.getState().tolerance).toBe(0)

    useSlippageStore.getState().setCustom(2)
    expect(useSlippageStore.getState().tolerance).toBe(SLIPPAGE_MAX)
  })

  it('setCustom rejects non-finite inputs by clamping to 0', () => {
    useSlippageStore.getState().setCustom(Number.NaN)
    expect(useSlippageStore.getState().tolerance).toBe(0)
  })

  it('persists to localStorage under the levx:slippage key', () => {
    useSlippageStore.getState().setPreset(0.05)
    const raw = localStorage.getItem('levx:slippage')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.state.tolerance).toBe(0.05)
    expect(parsed.state.preset).toBe(0.05)
  })
})
