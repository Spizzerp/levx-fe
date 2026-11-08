import { afterEach, describe, expect, it, vi } from 'vitest'

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
  fetchDisplayPaths,
} from '@/lib/api/displayPaths'
import {
  buildDisplayFixturePaths,
  buildDisplayPathsRecord,
  DISPLAY_FIXTURE_MARKET,
} from '@/tests/fixtures/displayPaths'

const startTimeMs = DISPLAY_FIXTURE_MARKET.startTime
const paths = buildDisplayFixturePaths()
const record = buildDisplayPathsRecord(paths)

describe('attachDisplayData', () => {
  it('attaches a dense series when every checkpoint value equals the chain', () => {
    const out = attachDisplayData(paths, record, startTimeMs)
    expect(out).toHaveLength(paths.length)
    for (const path of out) expect(path.displayData).toHaveLength(11)
    expect(out[0].displayData![2].value).toBe(paths[0].predictedPrices[1]) // grid point 2 is checkpoint 1
    expect(out[0].displayData![2].time).toBe(paths[0].data[1].time)
    expect(out[0].displayData!.every((p) => p.time >= startTimeMs)).toBe(true)
    // The scored series is left as it was.
    expect(out[0].data).toBe(paths[0].data)
  })

  it('drops grid points before the market start', () => {
    const r = structuredClone(record)
    r.times[0] -= 1
    const out = attachDisplayData(paths, r, startTimeMs)
    expect(out[0].displayData).toHaveLength(10)
    expect(out[0].displayData!.every((p) => p.time >= startTimeMs)).toBe(true)
  })

  it('refuses a path whose checkpoint value differs from the chain by one unit', () => {
    const r = structuredClone(record)
    r.paths[0].prices_u64[0] += 1
    const out = attachDisplayData(paths, r, startTimeMs)
    expect(out[0].displayData).toBeUndefined()
    expect(out[1].displayData).toBeDefined() // others unaffected
  })

  it('ignores a difference between checkpoints, which the chain does not hold', () => {
    const r = structuredClone(record)
    r.paths[0].prices_u64[1] += 1
    expect(attachDisplayData(paths, r, startTimeMs)[0].displayData).toBeDefined()
  })

  it('attaches only to indices present on both sides', () => {
    const r = structuredClone(record)
    r.paths.push({ ...structuredClone(r.paths[0]), path_index: 9 })
    const chain = paths.filter((p) => p.pathIndex !== 4)
    const out = attachDisplayData(chain, r, startTimeMs)
    expect(out).toHaveLength(4)
    expect(out.map((p) => p.pathIndex)).toEqual([0, 1, 2, 3])
    expect(out.every((p) => p.displayData !== undefined)).toBe(true)

    // A chain path with no record entry is left without a dense series.
    const partial = structuredClone(record)
    partial.paths = partial.paths.filter((p) => p.path_index !== 2)
    const out2 = attachDisplayData(paths, partial, startTimeMs)
    expect(out2[2].displayData).toBeUndefined()
    expect(out2[3].displayData).toBeDefined()
  })

  it('matches record paths by path_index, not by position', () => {
    const r = structuredClone(record)
    r.paths.reverse()
    const out = attachDisplayData(paths, r, startTimeMs)
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
      const out = attachDisplayData(paths, bad as typeof record, startTimeMs)
      expect(out.every((p) => p.displayData === undefined)).toBe(true)
    }
  })

  it('returns the paths unchanged when there is no record', () => {
    const out = attachDisplayData(paths, null, startTimeMs)
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
