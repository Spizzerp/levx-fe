import { describe, it } from 'vitest'

describe('crossingDetector', () => {
  it.todo('forward stroke crossing 1 checkpoint returns 1 entry with linearly-interpolated Y')
  it.todo('forward stroke crossing 3 checkpoints returns 3 entries in ascending index order')
  it.todo('backward (right-to-left) stroke crossing 2 checkpoints returns 2 entries')
  it.todo('no checkpoints in range returns empty array')
  it.todo('vertical stroke (prevX === currX) with checkpoint exactly at X returns single entry at t=0.5')
  it.todo('checkpoint exactly at prevX is included (start-boundary)')
  it.todo('checkpoint exactly at currX is included (end-boundary)')
  it.todo('all checkpoints crossed in one move returns N entries')
  it.todo('fast stroke spanning many columns returns all crossings in correct index order')
})
