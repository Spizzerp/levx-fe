import { describe, it, expect, vi } from 'vitest'

// Mock env to prevent loud-failure throws when importing pyth modules
vi.mock('@/env/env.config', () => ({
  env: {
    APP_HERMES_URL: 'https://hermes.pyth.network',
    APP_RPC_URL: 'https://api.devnet.solana.com',
    APP_NETWORK: 'devnet',
    APP_ENV: 'test',
    APP_API_BASE_URL: '',
  },
}))

vi.mock('@pythnetwork/hermes-client', () => ({
  HermesClient: vi.fn().mockImplementation(() => ({
    getStreamingPriceUpdates: vi.fn(),
  })),
}))

describe('lib modules smoke test', () => {
  it('src/lib/pyth/hooks exports usePythFeed and useLatestPrice', async () => {
    const pyth = await import('@/lib/pyth/hooks')
    expect(typeof pyth.usePythFeed).toBe('function')
    expect(typeof pyth.useLatestPrice).toBe('function')
  })

  it('src/lib/pyth/client exports getPythClient', async () => {
    const client = await import('@/lib/pyth/client')
    expect(typeof client.getPythClient).toBe('function')
  })

  it('src/lib/pyth/feedIds exports PYTH_FEED_IDS and feedIdForPair', async () => {
    const feeds = await import('@/lib/pyth/feedIds')
    expect(typeof feeds.PYTH_FEED_IDS).toBe('object')
    expect(feeds.PYTH_FEED_IDS).toHaveProperty('SOL/USDC')
    expect(feeds.PYTH_FEED_IDS).toHaveProperty('BTC/USDC')
    expect(feeds.PYTH_FEED_IDS).toHaveProperty('ETH/USDC')
    expect(typeof feeds.feedIdForPair).toBe('function')
  })

  it('src/lib/drawing exports crossingDetector, drawingStore, geometry, hooks, types', async () => {
    const crossingMod = await import('@/lib/drawing/crossingDetector')
    expect(typeof crossingMod.crossingDetector).toBe('function')

    const geoMod = await import('@/lib/drawing/geometry')
    expect(typeof geoMod.buildCheckpointXs).toBe('function')
    expect(typeof geoMod.checkpointIndexAtX).toBe('function')

    const storeMod = await import('@/stores/drawingStore')
    expect(typeof storeMod.useDrawingStore).toBe('function')

    const hooksMod = await import('@/lib/drawing/hooks')
    expect(typeof hooksMod.useYAxisFreeze).toBe('function')
    expect(typeof hooksMod.useDrawingPhase).toBe('function')
    expect(typeof hooksMod.useCheckpointValues).toBe('function')
  })
})
