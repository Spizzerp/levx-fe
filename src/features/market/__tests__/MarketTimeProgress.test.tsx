import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarketTimeProgress } from '@/features/market/MarketTimeProgress'
import { marketTimeProgressPercent } from '@/features/market/timeProgressMath'

describe('MarketTimeProgress', () => {
  it('calculates elapsed market time as a clamped percentage', () => {
    expect(marketTimeProgressPercent({ startTime: 100, endTime: 200, now: 150 })).toBe(50)
    expect(marketTimeProgressPercent({ startTime: 100, endTime: 200, now: 50 })).toBe(0)
    expect(marketTimeProgressPercent({ startTime: 100, endTime: 200, now: 250 })).toBe(100)
  })

  it('reveals the Dia text label when the progress indicator is hovered', () => {
    render(<MarketTimeProgress startTime={100} endTime={200} now={136} />)

    const progress = screen.getByRole('progressbar', { name: /market time elapsed/i })
    expect(progress).toHaveAttribute('aria-valuenow', '36')
    expect(screen.queryByText('Market time elapsed')).not.toBeInTheDocument()

    fireEvent.pointerEnter(progress.parentElement as HTMLElement)

    expect(screen.getByText('Market time elapsed')).toBeInTheDocument()
  })
})
