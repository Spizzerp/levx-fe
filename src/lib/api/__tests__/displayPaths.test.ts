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
  DisplayPathsRequestError,
  displayPathsQueryOptions,
  displayPathsRefetchInterval,
  fetchDisplayPaths,
  isDisplayPathsEnabled,
} from '@/lib/api/displayPaths'
import {
  buildDisplayFixturePaths,
  buildDisplayPathsRecord,
  DISPLAY_FIXTURE_ATTACH_MARKET,
} from '@/tests/fixtures/displayPaths'

const market = DISPLAY_FIXTURE_ATTACH_MARKET
const startTimeMs = market.startTimeMs
const paths = buildDisplayFixturePaths()
const record = buildDisplayPathsRecord(paths)

// Keep the dev-only refusal logs out of the test output; afterEach restores all mocks, so re-spy per test.
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
