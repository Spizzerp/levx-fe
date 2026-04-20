import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeRangePicker } from '@/features/chart/TimeRangePicker'

describe('TimeRangePicker', () => {
  it('renders tabs for 1M / 5M / 15M / 1H / 1D', () => {
    render(<TimeRangePicker />)
    for (const label of ['1M', '5M', '15M', '1H', '1D']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
  })

  it('highlights the selected interval', () => {
    render(<TimeRangePicker defaultInterval="15m" />)
    const active = screen.getByRole('tab', { name: '15M' })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active).toHaveAttribute('aria-current', 'true')
  })

  it('fires onChange with the new interval on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeRangePicker defaultInterval="1h" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: '5M' }))
    expect(onChange).toHaveBeenCalledWith('5m')
  })

  it('defaults selection to the value of the defaultInterval prop', () => {
    render(<TimeRangePicker defaultInterval="1d" />)
    expect(screen.getByRole('tab', { name: '1D' })).toHaveAttribute('aria-selected', 'true')
  })

  it('reflects controlled value prop over internal state', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeRangePicker value="1m" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: '1M' })).toHaveAttribute('aria-selected', 'true')
    // Click a different tab — onChange fires but controlled value doesn't change
    await user.click(screen.getByRole('tab', { name: '1H' }))
    expect(onChange).toHaveBeenCalledWith('1h')
    // Still shows '1M' because parent did not update the value prop
    expect(screen.getByRole('tab', { name: '1M' })).toHaveAttribute('aria-selected', 'true')
  })
})
