import { describe, it, expect, vi } from 'vitest'

import { env } from '@/env/env.config'
import { priceSource } from '@/lib/price/source'

// Partial mock, as in the other test files that mock the env: APP_PRICE_SOURCE is absent.
vi.mock('@/env/env.config', () => ({ env: {} }))

const mutableEnv = env as { APP_PRICE_SOURCE?: string }

describe('priceSource', () => {
  it('priceSource is free when env.APP_PRICE_SOURCE is undefined', () => {
    expect(mutableEnv.APP_PRICE_SOURCE).toBeUndefined()
    expect(priceSource()).toBe('free')
  })

  it('reads env.APP_PRICE_SOURCE at call time and is pyth only for exactly "pyth"', () => {
    mutableEnv.APP_PRICE_SOURCE = 'pyth'
    expect(priceSource()).toBe('pyth')
    mutableEnv.APP_PRICE_SOURCE = 'PYTH'
    expect(priceSource()).toBe('free')
    delete mutableEnv.APP_PRICE_SOURCE
  })
})
