import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatLeverage } from '@/features/mode2/format'
import { SegmentedSlider } from '@/ui/SegmentedSlider'

const LADDER = [1, 1.5, 2, 2.4, 3] as const

describe('SegmentedSlider', () => {
  it("keeps today's behaviour without disabledValues", async () => {
    const onChange = vi.fn()
    render(<SegmentedSlider value={2} max={4} onChange={onChange} />)

    const ticks = screen.getAllByRole('button')
    expect(ticks.map((tick) => tick.getAttribute('aria-label'))).toEqual([
      'Set to 1x',
      'Set to 2x',
      'Set to 3x',
      'Set to 4x',
    ])
    for (const tick of ticks) expect(tick).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Set to 2x' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Set to 4x' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(4)
  })

  it('renders a disabled tick as a disabled button', () => {
    render(
      <SegmentedSlider
        value={2}
        max={3}
        values={LADDER}
        disabledValues={[2.4]}
        formatAriaValue={formatLeverage}
      />,
    )

    const disabledTick = screen.getByRole('button', { name: 'Set to 2.4×' })
    expect(disabledTick).toBeDisabled()
    expect(disabledTick).toHaveClass('opacity-30')
    const enabledTick = screen.getByRole('button', { name: 'Set to 2.0×' })
    expect(enabledTick).toBeEnabled()
    expect(enabledTick).not.toHaveClass('opacity-30')
  })

  it('ignores a click on a disabled tick', async () => {
    const onChange = vi.fn()
    render(
      <SegmentedSlider
        value={2}
        max={3}
        values={LADDER}
        disabledValues={[2.4]}
        onChange={onChange}
        formatAriaValue={formatLeverage}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Set to 2.4×' }))
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Set to 3.0×' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(3)
  })

  describe('dragging', () => {
    const TRACK_WIDTH = 400

    beforeEach(() => {
      // jsdom lays nothing out and has no pointer capture: give the track a width, stub capture.
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: TRACK_WIDTH,
        bottom: 24,
        width: TRACK_WIDTH,
        height: 24,
        toJSON: () => ({}),
      })
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.hasPointerCapture = vi.fn(() => true)
      Element.prototype.releasePointerCapture = vi.fn()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    /** Five ticks 1..5 over 400px: tick i sits at x = i * 100. */
    function renderDraggable(disabledValues: readonly number[]) {
      const onChange = vi.fn()
      render(
        <SegmentedSlider value={2} max={5} disabledValues={disabledValues} onChange={onChange} />,
      )
      const thumb = screen.getByRole('button', { name: 'Set to 2x' })
      fireEvent.pointerDown(thumb, { button: 0, pointerId: 1, clientX: 100 })
      return { thumb, onChange }
    }

    it('snaps to the nearest enabled value, never a disabled one', () => {
      const { thumb, onChange } = renderDraggable([3, 4])

      // x = 300 is on 4x (disabled): 5x is one tick away, 2x is two.
      fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 300 })
      // x = 200 is on 3x (disabled): 2x is one tick away, 5x is two.
      fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 200 })
      // x = 400 is on 5x.
      fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 400 })

      expect(onChange.mock.calls.map(([next]) => next)).toEqual([2, 5, 2, 5])
    })

    it('behaves as before when nothing is disabled', () => {
      const { thumb, onChange } = renderDraggable([])

      fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 300 })

      expect(onChange.mock.calls.map(([next]) => next)).toEqual([2, 4])
    })
  })
})
