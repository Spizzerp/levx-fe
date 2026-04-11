import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeRangePicker } from '@/components/TimeRangePicker'

describe('TimeRangePicker', () => {
  it('renders tabs for 1h / 1d / 1w / 1m', () => {
    render(<TimeRangePicker />)
    for (const label of ['1H', '1D', '1W', '1M']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
  })

  it('highlights the selected range', () => {
    render(<TimeRangePicker defaultRange="1w" />)
    const active = screen.getByRole('tab', { name: '1W' })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active).toHaveAttribute('aria-current', 'true')
  })

  it('fires onChange with the new range on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeRangePicker defaultRange="1d" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: '1W' }))
    expect(onChange).toHaveBeenCalledWith('1w')
  })

  it('defaults selection to the value of the defaultRange prop', () => {
    render(<TimeRangePicker defaultRange="1m" />)
    expect(screen.getByRole('tab', { name: '1M' })).toHaveAttribute('aria-selected', 'true')
  })

  it('reflects controlled value prop over internal state', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeRangePicker value="1h" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: '1H' })).toHaveAttribute('aria-selected', 'true')
    // Click a different tab — onChange fires but internal state is irrelevant (controlled)
    await user.click(screen.getByRole('tab', { name: '1D' }))
    expect(onChange).toHaveBeenCalledWith('1d')
    // Still shows '1H' because parent did not update the value prop
    expect(screen.getByRole('tab', { name: '1H' })).toHaveAttribute('aria-selected', 'true')
  })
})
