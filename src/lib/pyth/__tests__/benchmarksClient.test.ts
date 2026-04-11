import { describe, it } from 'vitest'

describe('benchmarksClient', () => {
  it.todo('fetches historical price range from Pyth Benchmarks REST endpoint')
  it.todo('parses response into PricePoint[] with publishTime-derived timestamps')
  it.todo('throws on non-2xx response')
  it.todo('aligns resolution parameter to market.checkpointInterval')
})
