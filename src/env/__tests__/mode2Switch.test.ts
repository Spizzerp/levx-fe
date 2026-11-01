import { describe, it, expect, afterEach, vi } from 'vitest'

async function loadEnv() {
  vi.resetModules()
  const module = await import('@/env/env.config')
  return module.env
}

describe('APP_MODE2_TRADING switch', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is off when APP_MODE2_TRADING is unset', async () => {
    vi.stubEnv('APP_MODE2_TRADING', undefined)
    const env = await loadEnv()
    expect(env.APP_MODE2_TRADING).toBe(false)
  })

  it('is on only for the string true', async () => {
    vi.stubEnv('APP_MODE2_TRADING', 'true')
    expect((await loadEnv()).APP_MODE2_TRADING).toBe(true)

    vi.stubEnv('APP_MODE2_TRADING', '1')
    expect((await loadEnv()).APP_MODE2_TRADING).toBe(false)

    vi.stubEnv('APP_MODE2_TRADING', 'TRUE')
    expect((await loadEnv()).APP_MODE2_TRADING).toBe(false)
  })
})
