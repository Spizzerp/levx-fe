import { describe, it } from 'vitest'

describe('pythStore', () => {
  it.todo('deduplicates ticks with equal publishTime')
  it.todo('drops ticks with earlier publishTime (out-of-order)')
  it.todo('stores the most recent tick keyed by feedId')
  it.todo('exposes connection status via setStatus action')
})
