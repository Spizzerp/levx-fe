import { describe, it, expect, afterEach, vi } from 'vitest'

describe('env.config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults APP_PRICE_SOURCE to free and does not require APP_HERMES_URL', async () => {
    vi.stubEnv('APP_PRICE_SOURCE', undefined)
    vi.stubEnv('APP_HERMES_URL', undefined)
    vi.stubEnv('APP_RPC_URL', 'https://api.devnet.solana.com')
    vi.stubEnv('APP_NETWORK', 'devnet')

    const module = await import('@/env/env.config')
    expect(module.env.APP_PRICE_SOURCE).toBe('free')
    expect(module.env.APP_HERMES_URL).toBe('')
  })

  it('requires APP_HERMES_URL when APP_PRICE_SOURCE is pyth', async () => {
    vi.stubEnv('APP_PRICE_SOURCE', 'pyth')
    vi.stubEnv('APP_HERMES_URL', '')
    vi.stubEnv('APP_RPC_URL', 'https://api.devnet.solana.com')
    vi.stubEnv('APP_NETWORK', 'devnet')
    await expect(import('@/env/env.config')).rejects.toThrow(
      /APP_HERMES_URL is missing \(APP_PRICE_SOURCE=pyth\)/,
    )
  })

  it('rejects an unknown APP_PRICE_SOURCE', async () => {
    vi.stubEnv('APP_PRICE_SOURCE', 'hermes')
    vi.stubEnv('APP_HERMES_URL', 'https://hermes.pyth.network')
    vi.stubEnv('APP_RPC_URL', 'https://api.devnet.solana.com')
    vi.stubEnv('APP_NETWORK', 'devnet')
    await expect(import('@/env/env.config')).rejects.toThrow(/must be "free" or "pyth"/)
  })

  it('throws when APP_RPC_URL is missing', async () => {
    vi.resetModules()
    vi.stubEnv('APP_HERMES_URL', 'https://hermes.pyth.network')
    vi.stubEnv('APP_RPC_URL', '')
    vi.stubEnv('APP_NETWORK', 'devnet')
    await expect(import('@/env/env.config')).rejects.toThrow(/APP_RPC_URL/)
  })

  it('throws when APP_NETWORK is missing', async () => {
    vi.resetModules()
    vi.stubEnv('APP_HERMES_URL', 'https://hermes.pyth.network')
    vi.stubEnv('APP_RPC_URL', 'https://api.devnet.solana.com')
    vi.stubEnv('APP_NETWORK', '')
    await expect(import('@/env/env.config')).rejects.toThrow(/APP_NETWORK/)
  })

  it('returns typed env object when all required values present', async () => {
    vi.resetModules()
    vi.stubEnv('APP_PRICE_SOURCE', 'pyth')
    vi.stubEnv('APP_HERMES_URL', 'https://hermes.pyth.network')
    vi.stubEnv('APP_RPC_URL', 'https://api.devnet.solana.com')
    vi.stubEnv('APP_NETWORK', 'devnet')

    const module = await import('@/env/env.config')
    expect(module.env.APP_PRICE_SOURCE).toBe('pyth')
    expect(module.env.APP_HERMES_URL).toBe('https://hermes.pyth.network')
    expect(module.env.APP_RPC_URL).toBe('https://api.devnet.solana.com')
    expect(module.env.APP_NETWORK).toBe('devnet')
  })
})
