import { describe, it } from 'vitest'

describe('drawingStore', () => {
  it.todo('transitions idle -> drawMode on enterDrawMode(n)')
  it.todo('initializes values array as (null)[n] on enterDrawMode')
  it.todo('transitions drawMode -> sweeping on beginStroke')
  it.todo('transitions sweeping -> drawMode on endStroke when values partial')
  it.todo('transitions sweeping -> ready on endStroke when all values non-null')
  it.todo('allows ready -> sweeping on beginStroke (multi-stroke overwrite)')
  it.todo('setCheckpointValues writes domain prices (numbers) at given indices')
  it.todo('reset clears all checkpoint values to null and returns to drawMode')
  it.todo('exitDrawMode returns to idle from any phase')
  it.todo('values array length always equals totalCheckpoints')
})
