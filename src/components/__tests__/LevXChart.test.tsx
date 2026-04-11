import { describe, it } from 'vitest'

describe('LevXChart', () => {
  it.todo('renders historical line using curveMonotoneX')
  it.todo('renders prediction paths using curveCatmullRom.alpha(0.5)')
  it.todo('renders up to 5 AI candidate path overlays')
  it.todo('selected path renders at full opacity; unselected at reduced opacity')
  it.todo('renders checkpoint column markers along the future-time axis at correct positions')
  it.todo('renders horizontal price grid lines via GridRows')
  it.todo('renders distinct loading state')
  it.todo('renders distinct empty state when no Pyth data is available')
  it.todo('renders distinct error state on data failure')
  it.todo('renders empty-paths message when market has zero AI paths')
  it.todo('survives viewport resize without losing drawn path or selected path')
})
