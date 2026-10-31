import { describe, it, expect } from 'vitest'

import { COINBASE_PRODUCTS, pairForFeedId } from '@/lib/price/pairs'
import { PYTH_FEED_IDS } from '@/lib/pyth/feedIds'

describe('pairs', () => {
  it('maps feed ids to pairs with or without 0x, in any case', () => {
    const sol = PYTH_FEED_IDS['SOL/USDC']
    expect(pairForFeedId(sol)).toBe('SOL/USDC')
    expect(pairForFeedId(sol.slice(2))).toBe('SOL/USDC')
    expect(pairForFeedId(sol.toUpperCase())).toBe('SOL/USDC')
    expect(pairForFeedId(sol.slice(2).toUpperCase())).toBe('SOL/USDC')
    expect(pairForFeedId(PYTH_FEED_IDS['BTC/USDC'])).toBe('BTC/USDC')
    expect(pairForFeedId(PYTH_FEED_IDS['ETH/USDC'])).toBe('ETH/USDC')
    expect(pairForFeedId('0x' + 'ab'.repeat(32))).toBeNull()
    expect(pairForFeedId('')).toBeNull()

    expect(COINBASE_PRODUCTS).toEqual({
      'SOL/USDC': 'SOL-USD',
      'BTC/USDC': 'BTC-USD',
      'ETH/USDC': 'ETH-USD',
    })
  })
})
