import { env } from '@/env/env.config'

export type PriceSource = 'free' | 'pyth'

/**
 * The live price source, read at call time. Anything but exactly 'pyth' is 'free', so a partial
 * mock of the env (no APP_PRICE_SOURCE) gets the default.
 */
export function priceSource(): PriceSource {
  return env.APP_PRICE_SOURCE === 'pyth' ? 'pyth' : 'free'
}
