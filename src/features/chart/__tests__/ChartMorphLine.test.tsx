import React from 'react'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'

import { ChartMorphLine } from '@/features/chart/ChartMorphLine'

type Point = { x: number; y: number }

describe('ChartMorphLine', () => {
  let rafQueue: FrameRequestCallback[]
  let nextFrameId: number

  beforeEach(() => {
    rafQueue = []
    nextFrameId = 1

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafQueue.push(callback)
        return nextFrameId++
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  function renderInSvg(
    root: Root,
    props: Partial<React.ComponentProps<typeof ChartMorphLine>> = {},
  ) {
    root.render(
      <svg>
        <ChartMorphLine
          innerWidth={100}
          innerHeight={100}
          isLoading
          dataPoints={[
            { x: 0, y: 10 },
            { x: 100, y: 10 },
          ]}
          onRevealChart={() => {}}
          {...props}
        />
      </svg>,
    )
  }

  function runNextFrame(time: number) {
    const callback = rafQueue.shift()
    expect(callback).toBeTypeOf('function')
    callback?.(time)
  }

  it('uses the latest dataPoints during morph frames before passive effects flush', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        renderInSvg(root)
      })
      expect(rafQueue).toHaveLength(1)

      runNextFrame(1_000)
      expect(rafQueue).toHaveLength(1)

      await act(async () => {
        renderInSvg(root, { isLoading: false })
      })

      const nextDataPoints: Point[] = [
        { x: 0, y: 90 },
        { x: 100, y: 90 },
      ]

      flushSync(() => {
        renderInSvg(root, {
          isLoading: false,
          dataPoints: nextDataPoints,
        })
      })

      runNextFrame(1_100)
      runNextFrame(1_900)

      const path = container.querySelector('path')
      expect(path).toBeInTheDocument()
      expect(path?.getAttribute('d')).toMatch(/^M0\.0,90\.0 L0\.2,90\.0/)
    } finally {
      root.unmount()
    }
  })

  it('uses the latest reveal callback during morph frames before passive effects flush', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const firstReveal = vi.fn()
    const secondReveal = vi.fn()

    try {
      await act(async () => {
        renderInSvg(root, { onRevealChart: firstReveal })
      })
      expect(rafQueue).toHaveLength(1)

      runNextFrame(1_000)
      expect(rafQueue).toHaveLength(1)

      await act(async () => {
        renderInSvg(root, {
          isLoading: false,
          onRevealChart: firstReveal,
        })
      })

      flushSync(() => {
        renderInSvg(root, {
          isLoading: false,
          onRevealChart: secondReveal,
        })
      })

      runNextFrame(1_100)
      runNextFrame(1_700)

      expect(firstReveal).not.toHaveBeenCalled()
      expect(secondReveal).toHaveBeenCalledTimes(1)
    } finally {
      root.unmount()
    }
  })
})
