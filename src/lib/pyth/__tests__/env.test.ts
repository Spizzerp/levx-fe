import { describe, it, expect, afterEach, vi } from 'vitest'

describe('env.config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('throws when APP_HERMES_URL is missing', async () => {
    vi.stubEnv('APP_HERMES_URL', '')
    vi.stubEnv('APP_RPC_URL', 'https://api.devnet.solana.com')
    vi.stubEnv('APP_NETWORK', 'devnet')
    await expect(import('@/env/env.config')).rejects.toThrow(/APP_HERMES_URL/)
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
    vi.stubEnv('APP_HERMES_URL', 'https://hermes.pyth.network')
    vi.stubEnv('APP_RPC_URL', 'https://api.devnet.solana.com')
    vi.stubEnv('APP_NETWORK', 'devnet')

    const module = await import('@/env/env.config')
    expect(module.env.APP_HERMES_URL).toBe('https://hermes.pyth.network')
    expect(module.env.APP_RPC_URL).toBe('https://api.devnet.solana.com')
    expect(module.env.APP_NETWORK).toBe('devnet')
  })
})
