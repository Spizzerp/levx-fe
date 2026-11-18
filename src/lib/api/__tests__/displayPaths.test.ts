import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/env/env.config', () => ({
  env: {
    APP_ENV: 'test',
    APP_API_BASE_URL: 'https://pipeline.test',
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.mainnet-beta.solana.com',
    APP_NETWORK: 'mainnet',
    APP_PROGRAM_ID: 'LhDfCNTdm8Xr5cpEaSCfVSsbReA8muHFsS8zgjJn7Kk',
    APP_ADMIN_WALLETS: [],
    APP_SUPABASE_URL: 'http://127.0.0.1:54321',
    APP_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}))

import {
  attachDisplayData,
  type DisplayPathsRecord,
  DisplayPathsRequestError,
  displayPathsQueryOptions,
  displayPathsRefetchInterval,
  fetchDisplayPaths,
  isDisplayPathsEnabled,
} from '@/lib/api/displayPaths'
import { SCALE } from '@/lib/constants'
import {
  buildDisplayFixturePaths,
  buildDisplayPathsRecord,
  DISPLAY_FIXTURE_ATTACH_MARKET,
  withSimulatedFill,
} from '@/tests/fixtures/displayPaths'
import pipelineRecordJson from '@/tests/fixtures/pipelineDisplayRecord.json'
import type { PredictionPath } from '@/types/market'

type Fill = NonNullable<DisplayPathsRecord['simulated_fill']>

const market = DISPLAY_FIXTURE_ATTACH_MARKET
const startTimeMs = market.startTimeMs
const paths = buildDisplayFixturePaths()
const record = buildDisplayPathsRecord(paths)

// Keep the dev-only refusal logs out of the test output; afterEach restores all mocks,
// so re-spy per test.
beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('attachDisplayData', () => {
  it('attaches a dense series when every checkpoint value equals the chain', () => {
    const out = attachDisplayData(paths, record, market)
    expect(out).toHaveLength(paths.length)
    for (const path of out) expect(path.displayData).toHaveLength(11)
    expect(out[0].displayData![2].value).toBe(paths[0].predictedPrices[1]) // grid point 2 is checkpoint 1
    expect(out[0].displayData![2].time).toBe(paths[0].data[1].time)
    expect(out[0].displayData!.every((p) => p.time >= startTimeMs)).toBe(true)
    // The scored series is left as it was.
    expect(out[0].data).toBe(paths[0].data)
  })

  it('drops grid points before the market start', () => {
    // A leading point one model step before the start; the checkpoints keep their times.
    const r = structuredClone(record)
    r.times.unshift(r.times[0] - r.model_step_seconds)
    r.checkpoint_indices = r.checkpoint_indices.map((i) => i + 1)
    for (const p of r.paths) p.prices_u64.unshift(p.prices_u64[0])
    const out = attachDisplayData(paths, r, market)
    expect(out[0].displayData).toHaveLength(11)
    expect(out[0].displayData![0].time).toBe(startTimeMs)
  })

  it('starts every dense series at the record origin, before the market start', () => {
    const originTime = record.start_time - record.model_step_seconds
    const r = { ...structuredClone(record), origin: { time: originTime, price_u64: 99_500_000 } }
    const out = attachDisplayData(paths, r, market)
    for (const path of out) {
      expect(path.displayData).toHaveLength(12)
      expect(path.displayData![0]).toEqual({ time: originTime * 1000, value: 99.5 })
      expect(path.displayData![1].time).toBe(startTimeMs)
    }
    // The scored series is left as it was.
    expect(out[0].data).toBe(paths[0].data)
  })

  it('keeps the grid points between the origin and the market start', () => {
    // The forecast was made two model steps before the start, so one grid point precedes it.
    const r = structuredClone(record)
    const step = r.model_step_seconds
    r.times.unshift(r.times[0] - step)
    r.checkpoint_indices = r.checkpoint_indices.map((i) => i + 1)
    for (const p of r.paths) p.prices_u64.unshift(p.prices_u64[0])
    const out = attachDisplayData(
      paths,
      { ...r, origin: { time: r.start_time - 2 * step, price_u64: 99_500_000 } },
      market,
    )
    expect(out[0].displayData).toHaveLength(13)
    expect(out[0].displayData!.map((p) => p.time).slice(0, 3)).toEqual([
      startTimeMs - 2 * step * 1000,
      startTimeMs - step * 1000,
      startTimeMs,
    ])
  })

  it.each([
    ['at the market start', { time: record.start_time, price_u64: 99_500_000 }],
    ['after the market start', { time: record.start_time + 60, price_u64: 99_500_000 }],
    ['without a finite time', { time: Number.NaN, price_u64: 99_500_000 }],
    ['without a positive price', { time: record.start_time - 300, price_u64: 0 }],
    ['that is not an object', 'origin'],
    ['that is null', null],
  ])('draws from the market start when the origin is %s', (_name, origin) => {
    const r = { ...structuredClone(record), origin } as unknown as typeof record
    const out = attachDisplayData(paths, r, market)
    expect(out[0].displayData).toHaveLength(11)
    expect(out[0].displayData![0].time).toBe(startTimeMs)
  })

  it('drops grid points past the last checkpoint', () => {
    // The pipeline's horizon can overrun the last checkpoint by one model step.
    const r = structuredClone(record)
    r.times.push(r.times[r.times.length - 1] + r.model_step_seconds)
    for (const p of r.paths) p.prices_u64.push(p.prices_u64[p.prices_u64.length - 1])
    const out = attachDisplayData(paths, r, market)
    expect(out[0].displayData).toHaveLength(11)
    expect(out[0].displayData![10].time).toBe(
      startTimeMs + (market.totalCheckpoints - 1) * market.checkpointInterval * 1000,
    )
  })

  it('logs a refused record once with its reason in dev builds only', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const shifted = structuredClone(record)
    shifted.start_time += 60

    vi.stubEnv('DEV', true)
    attachDisplayData(paths, shifted, market)
    expect(debug).toHaveBeenCalledTimes(1)
    expect(debug.mock.calls[0][0]).toMatch(/^\[display-paths\]/)
    expect(String(debug.mock.calls[0][1])).toMatch(/start_time/)

    debug.mockClear()
    vi.stubEnv('DEV', false)
    attachDisplayData(paths, shifted, market)
    expect(debug).not.toHaveBeenCalled()
  })

  it('logs a path skipped for a price mismatch in dev builds', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const r = structuredClone(record)
    r.paths[0].prices_u64[0] += 1
    vi.stubEnv('DEV', true)
    attachDisplayData(paths, r, market)
    expect(debug).toHaveBeenCalledTimes(1)
    expect(String(debug.mock.calls[0][1])).toMatch(/price/)
  })

  it('refuses the whole record when its time axis disagrees with the market', () => {
    const shifted = structuredClone(record)
    shifted.times = shifted.times.map((t) => t + 60) // prices untouched
    const notIncreasing = structuredClone(record)
    notIncreasing.times[1] = notIncreasing.times[0]
    const otherInterval = structuredClone(record)
    otherInterval.checkpoint_interval = 300
    const otherStart = structuredClone(record)
    otherStart.start_time += 60
    const otherTotal = structuredClone(record)
    otherTotal.total_checkpoints = 5
    otherTotal.checkpoint_indices.pop()

    for (const bad of [shifted, notIncreasing, otherInterval, otherStart, otherTotal]) {
      const out = attachDisplayData(paths, bad, market)
      expect(out).toEqual(paths)
    }
  })

  it('refuses the whole record when a path_index appears twice', () => {
    const r = structuredClone(record)
    r.paths.push(structuredClone(r.paths[0]))
    const out = attachDisplayData(paths, r, market)
    expect(out.every((p) => p.displayData === undefined)).toBe(true)
  })

  it('refuses a path whose checkpoint value differs from the chain by one unit', () => {
    const r = structuredClone(record)
    r.paths[0].prices_u64[0] += 1
    const out = attachDisplayData(paths, r, market)
    expect(out[0].displayData).toBeUndefined()
    expect(out[1].displayData).toBeDefined() // others unaffected
  })

  it('ignores a difference between checkpoints, which the chain does not hold', () => {
    const r = structuredClone(record)
    r.paths[0].prices_u64[1] += 1
    expect(attachDisplayData(paths, r, market)[0].displayData).toBeDefined()
  })

  it('attaches only to indices present on both sides', () => {
    const r = structuredClone(record)
    r.paths.push({ ...structuredClone(r.paths[0]), path_index: 9 })
    const chain = paths.filter((p) => p.pathIndex !== 4)
    const out = attachDisplayData(chain, r, market)
    expect(out).toHaveLength(4)
    expect(out.map((p) => p.pathIndex)).toEqual([0, 1, 2, 3])
    expect(out.every((p) => p.displayData !== undefined)).toBe(true)

    // A chain path with no record entry is left without a dense series.
    const partial = structuredClone(record)
    partial.paths = partial.paths.filter((p) => p.path_index !== 2)
    const out2 = attachDisplayData(paths, partial, market)
    expect(out2[2].displayData).toBeUndefined()
    expect(out2[3].displayData).toBeDefined()
  })

  it('matches record paths by path_index, not by position', () => {
    const r = structuredClone(record)
    r.paths.reverse()
    const out = attachDisplayData(paths, r, market)
    expect(out[0].displayData![2].value).toBe(paths[0].predictedPrices[1])
  })

  it('refuses the whole record when checkpoint_indices are out of range or lengths disagree', () => {
    const outOfRange = structuredClone(record)
    outOfRange.checkpoint_indices[5] = 11
    const negative = structuredClone(record)
    negative.checkpoint_indices[0] = -1
    const tooFewIndices = structuredClone(record)
    tooFewIndices.checkpoint_indices.pop()
    const shortPrices = structuredClone(record)
    shortPrices.paths[3].prices_u64.pop()
    const wrongSchema = structuredClone(record) as unknown as { schema: string }
    wrongSchema.schema = 'display-paths-v2'

    for (const bad of [outOfRange, negative, tooFewIndices, shortPrices, wrongSchema]) {
      const out = attachDisplayData(paths, bad as typeof record, market)
      expect(out.every((p) => p.displayData === undefined)).toBe(true)
    }
  })

  it('refuses a record with a missing or non-array field without throwing', () => {
    const missingTimes = structuredClone(record) as Partial<typeof record>
    delete missingTimes.times
    const pathsNotArray = { ...structuredClone(record), paths: { 0: record.paths[0] } }
    const missingPrices = structuredClone(record) as unknown as { paths: object[] }
    delete (missingPrices.paths[1] as { prices_u64?: unknown }).prices_u64
    const nonFiniteTime = structuredClone(record)
    nonFiniteTime.times[3] = Number.NaN

    for (const bad of [missingTimes, pathsNotArray, missingPrices, nonFiniteTime]) {
      const out = attachDisplayData(paths, bad as unknown as typeof record, market)
      expect(out).toEqual(paths)
      expect(out.every((p) => p.displayData === undefined)).toBe(true)
    }
  })

  it('returns the paths unchanged when there is no record', () => {
    const out = attachDisplayData(paths, null, market)
    expect(out).toEqual(paths)
    expect(out.every((p) => p.displayData === undefined)).toBe(true)
  })
})

describe('attachDisplayData with a simulated fill', () => {
  const originTime = record.start_time - record.model_step_seconds
  const withOrigin = {
    ...structuredClone(record),
    origin: { time: originTime, price_u64: 99_500_000 },
  }
  const filled = withSimulatedFill(withOrigin, 60)
  const stored = attachDisplayData(paths, withOrigin, market)

  it('draws the fill when it passes through every stored point', () => {
    const out = attachDisplayData(paths, filled, market)
    for (const [i, path] of out.entries()) {
      // the origin, then a point every 60 s up to the last checkpoint 3300 s later
      expect(path.displayData).toHaveLength(1 + 3300 / 60)
      expect(path.displaySimulated).toBe(true)
      expect(path.displayData![0]).toEqual({ time: originTime * 1000, value: 99.5 })
      // every stored point is still on the line, at its own value
      for (const point of stored[i].displayData!) expect(path.displayData).toContainEqual(point)
      // and the scored series is left as it was
      expect(path.data).toBe(paths[i].data)
    }
  })

  it('draws a record without an origin from the market start', () => {
    const out = attachDisplayData(paths, withSimulatedFill(record, 60), market)
    expect(out[0].displayData).toHaveLength(1 + 3000 / 60)
    expect(out[0].displayData![0].time).toBe(startTimeMs)
    expect(out[0].displaySimulated).toBe(true)
  })

  it('draws the stored points when the fill misses one of them by a unit', () => {
    const r = structuredClone(filled)
    const fill = r.simulated_fill!
    fill.paths[0].prices_u64[fill.anchor_indices[3]] += 1
    const out = attachDisplayData(paths, r, market)
    expect(out[0].displayData).toEqual(stored[0].displayData)
    expect(out[0].displaySimulated).toBeUndefined()
    // the other paths' fills still hold
    expect(out[1].displaySimulated).toBe(true)
  })

  it.each([
    ['is not marked simulated', (f: Fill) => void (f.simulated = false as never)],
    [
      'has times out of order',
      (f: Fill) => void ([f.times[1], f.times[2]] = [f.times[2], f.times[1]]),
    ],
    ['has an anchor per stored point missing', (f: Fill) => void f.anchor_indices.pop()],
    ['has an anchor at another time', (f: Fill) => void (f.anchor_indices[2] -= 1)],
    ['has a path of another length', (f: Fill) => void f.paths[0].prices_u64.pop()],
    ['has no times array', (f: Fill) => void (f.times = undefined as never)],
    ['has no paths array', (f: Fill) => void (f.paths = undefined as never)],
  ])('draws the stored points when the fill %s', (_name, breakIt) => {
    const r = structuredClone(filled)
    breakIt(r.simulated_fill!)
    const out = attachDisplayData(paths, r, market)
    expect(out[0].displayData).toEqual(stored[0].displayData)
    expect(out[0].displaySimulated).toBeUndefined()
  })

  it('still refuses a path whose stored checkpoint differs from the chain', () => {
    const r = structuredClone(filled)
    r.paths[0].prices_u64[r.checkpoint_indices[1]] += 1
    r.simulated_fill!.paths[0].prices_u64[
      r.simulated_fill!.anchor_indices[r.checkpoint_indices[1] + 1]
    ] += 1
    const out = attachDisplayData(paths, r, market)
    expect(out[0].displayData).toBeUndefined()
  })
})

describe('attachDisplayData with a record as the pipeline writes it', () => {
  // `pipelineDisplayRecord.json` is the output of the pipeline's own `build_display_record`
  // (levx-infra, pipeline/src/levx_pipeline/display_record.py), serialized as the endpoint serves it.
  const pipelineRecord = pipelineRecordJson as DisplayPathsRecord
  const pipelineMarket = {
    startTimeMs: pipelineRecord.start_time * 1000,
    checkpointInterval: pipelineRecord.checkpoint_interval,
    totalCheckpoints: pipelineRecord.total_checkpoints,
  }
  // The chain holds each path's value at the checkpoints, and nothing else.
  const chainPaths: PredictionPath[] = pipelineRecord.paths.map((recordPath) => {
    const prices = pipelineRecord.checkpoint_indices.map((i) => recordPath.prices_u64[i] / SCALE)
    return {
      ...paths[0],
      id: `path-${recordPath.path_index}`,
      pathIndex: recordPath.path_index,
      numCheckpoints: prices.length,
      predictedPrices: prices,
      data: prices.map((value, j) => ({
        time: pipelineMarket.startTimeMs + j * pipelineMarket.checkpointInterval * 1000,
        value,
      })),
    }
  })

  it('draws every path from the simulated fill, through each stored point', () => {
    const fill = pipelineRecord.simulated_fill!
    const out = attachDisplayData(chainPaths, pipelineRecord, pipelineMarket)
    expect(out).toHaveLength(5)
    for (const [i, path] of out.entries()) {
      expect(path.displaySimulated).toBe(true)
      // the origin, then every time of the fill
      expect(path.displayData).toHaveLength(1 + fill.times.length)
      expect(path.displayData![0].time).toBe(pipelineRecord.origin!.time * 1000)
      for (const [k, t] of pipelineRecord.times.entries()) {
        expect(path.displayData).toContainEqual({
          time: t * 1000,
          value: pipelineRecord.paths[i].prices_u64[k] / SCALE,
        })
      }
    }
  })
})

describe('fetchDisplayPaths', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches the market record from the pipeline', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(record), { status: 200 }))
    await expect(fetchDisplayPaths(7)).resolves.toEqual(record)
    expect(fetchSpy).toHaveBeenCalledWith('https://pipeline.test/api/v1/markets/7/display-paths')
  })

  it('fetchDisplayPaths returns null on 404 and throws on 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"detail":"not found"}', { status: 404 }),
    )
    await expect(fetchDisplayPaths(7)).resolves.toBeNull()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('boom', { status: 500 }))
    const error = await fetchDisplayPaths(7).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DisplayPathsRequestError)
    expect((error as DisplayPathsRequestError).status).toBe(500)
  })
})

describe('displayPathsRefetchInterval', () => {
  it('polls every 15 s while the pipeline has no record and stops once one exists', () => {
    expect(displayPathsRefetchInterval({ state: { data: null } })).toBe(15_000)
    expect(displayPathsRefetchInterval({ state: { data: record } })).toBe(false)
  })
})

describe('isDisplayPathsEnabled', () => {
  const on = { enabled: true, marketId: 7, baseUrl: 'https://pipeline.test', useMock: false }

  it('is off without a pipeline URL, in mock mode, or without a market', () => {
    expect(isDisplayPathsEnabled({ ...on, baseUrl: '' })).toBe(false)
    expect(isDisplayPathsEnabled({ ...on, useMock: true })).toBe(false)
    expect(isDisplayPathsEnabled({ ...on, marketId: null })).toBe(false)
    expect(isDisplayPathsEnabled({ ...on, enabled: false })).toBe(false)
  })

  it('is on otherwise', () => {
    expect(isDisplayPathsEnabled(on)).toBe(true)
  })
})

describe('displayPathsQueryOptions', () => {
  it('polls only while pollWhile holds', () => {
    expect(displayPathsQueryOptions(7, true, true).refetchInterval).toBe(
      displayPathsRefetchInterval,
    )
    expect(displayPathsQueryOptions(7, true, false).refetchInterval).toBe(false)
  })
})
