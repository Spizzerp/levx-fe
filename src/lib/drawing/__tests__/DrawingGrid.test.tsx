import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { scaleLinear, scaleTime } from '@visx/scale'
import { DrawingGrid } from '@/features/chart/DrawingGrid'

const xScale = scaleTime({ domain: [0, 100_000], range: [0, 400] })
const yScale = scaleLinear({ domain: [100, 200], range: [400, 0] })
const checkpointXs = [10_000, 30_000, 50_000, 70_000, 90_000]

function renderGrid(isDrawMode: boolean) {
  return render(
    <svg>
      <DrawingGrid
        xScale={xScale}
        yScale={yScale}
        innerWidth={400}
        innerHeight={400}
        checkpointXs={checkpointXs}
        isDrawMode={isDrawMode}
      />
    </svg>,
  )
}

describe('DrawingGrid', () => {
  it('renders one vertical checkpoint column line per checkpoint when in draw mode', () => {
    const { container } = renderGrid(true)
    const cols = container.querySelectorAll('[data-testid="checkpoint-column"]')
    expect(cols).toHaveLength(checkpointXs.length)
  })

  it('renders horizontal price grid lines when in draw mode', () => {
    const { container } = renderGrid(true)
    expect(container.querySelector('[data-testid="drawing-grid"]')).toBeInTheDocument()
  })

  it('renders nothing when not in draw mode', () => {
    const { container } = renderGrid(false)
    expect(container.querySelector('[data-testid="drawing-grid"]')).toBeNull()
  })

  it('checkpoint column X positions map to buildCheckpointXs(market) domain times via xScale', () => {
    const { container } = renderGrid(true)
    const cols = container.querySelectorAll('[data-testid="checkpoint-column"]')
    // First column should be at xScale(10_000) = 40
    const firstX = cols[0].getAttribute('x1')
    expect(Number(firstX)).toBeCloseTo(xScale(10_000) as number)
  })
})
