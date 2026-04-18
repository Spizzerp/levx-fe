import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useDrawBroadcast, usePublishDrawFrame } from '../hooks'
import { __emitRealtime, __resetSupabaseMock, mockSend } from '../__mocks__/supabase-js'

describe('useDrawBroadcast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
    __resetSupabaseMock()
    mockSend.mockClear()
  })

  it('last frame per wallet wins; own wallet excluded', () => {
    const { result } = renderHook(() => useDrawBroadcast('btc', 'A'))
    act(() => {
      __emitRealtime('path-draw:btc', 'draw_frame', { payload: { wallet: 'B', points: [{ time: 1, value: 1 }], timestamp: 1 } })
      __emitRealtime('path-draw:btc', 'draw_frame', { payload: { wallet: 'B', points: [{ time: 1, value: 2 }], timestamp: 2 } })
      __emitRealtime('path-draw:btc', 'draw_frame', { payload: { wallet: 'A', points: [{ time: 1, value: 9 }], timestamp: 3 } })
    })
    expect(result.current.liveDraws['B']?.timestamp).toBe(2)
    expect(result.current.liveDraws['A']).toBeUndefined()
  })

  it('stale frames expire after 5s of no updates', async () => {
    const { result } = renderHook(() => useDrawBroadcast('btc', 'A'))
    const t0 = Date.now()
    act(() => {
      __emitRealtime('path-draw:btc', 'draw_frame', { payload: { wallet: 'B', points: [], timestamp: t0 } })
    })
    expect(result.current.liveDraws['B']).toBeDefined()
    await act(async () => {
      vi.advanceTimersByTime(6000)
      // Yield to React's microtask queue so state updates flush.
      await Promise.resolve()
    })
    expect(result.current.liveDraws['B']).toBeUndefined()
  })
})

describe('usePublishDrawFrame', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'Date'] })
    __resetSupabaseMock()
    mockSend.mockClear()
  })

  it('throttles bursts to ~10 Hz with leading + trailing edge', () => {
    const { result } = renderHook(() => usePublishDrawFrame('btc', 'A'))
    act(() => {
      result.current({ wallet: 'A', points: [{ time: 1, value: 1 }], timestamp: 1 })
      result.current({ wallet: 'A', points: [{ time: 2, value: 2 }], timestamp: 2 })
      result.current({ wallet: 'A', points: [{ time: 3, value: 3 }], timestamp: 3 })
    })
    expect(mockSend).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(120) })
    expect(mockSend).toHaveBeenCalledTimes(2)
  })
})
