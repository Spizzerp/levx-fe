import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useYAxisFreeze } from '@/lib/drawing/yFreeze'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useYAxisFreeze', () => {
  it('returns live domain when not frozen', () => {
    const { result } = renderHook(({ d }) => useYAxisFreeze(d), {
      initialProps: { d: [100, 200] as [number, number] },
    })
    expect(result.current.effectiveDomain).toEqual([100, 200])
  })

  it('returns frozen domain while freeze() is active', () => {
    const { result, rerender } = renderHook(({ d }) => useYAxisFreeze(d), {
      initialProps: { d: [100, 200] as [number, number] },
    })
    act(() => {
      result.current.freeze()
    })
    rerender({ d: [150, 250] })
    expect(result.current.effectiveDomain).toEqual([100, 200])
  })

  it('resumes live domain ~300ms after thaw() call', () => {
    const { result, rerender } = renderHook(({ d }) => useYAxisFreeze(d), {
      initialProps: { d: [100, 200] as [number, number] },
    })
    act(() => {
      result.current.freeze()
    })
    rerender({ d: [150, 250] })
    act(() => {
      result.current.thaw()
    })
    // At 299ms — still frozen
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current.effectiveDomain).toEqual([100, 200])
    // At 301ms — thawed
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(result.current.effectiveDomain).toEqual([150, 250])
  })

  it('does not thaw early if thaw() fires multiple times in rapid succession', () => {
    const { result, rerender } = renderHook(({ d }) => useYAxisFreeze(d), {
      initialProps: { d: [100, 200] as [number, number] },
    })
    act(() => {
      result.current.freeze()
    })
    rerender({ d: [150, 250] })
    act(() => {
      result.current.thaw()
    })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    // Second thaw() restarts the 300ms timer
    act(() => {
      result.current.thaw()
    })
    // 200ms elapsed after second thaw — still frozen (< 300ms)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.effectiveDomain).toEqual([100, 200])
    // 350ms after second thaw — now thawed
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.effectiveDomain).toEqual([150, 250])
  })
})
