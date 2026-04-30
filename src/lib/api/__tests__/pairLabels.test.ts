import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'

import { KNOWN_DEVNET_MINTS, resolveBaseMintLabel } from '@/lib/api/pairLabels'

describe('resolveBaseMintLabel', () => {
  it('resolves the canonical wrapped-SOL mint to SOL/USDC', () => {
    const label = resolveBaseMintLabel(new PublicKey('So11111111111111111111111111111111111111112'))
    expect(label).toEqual({ pair: 'SOL/USDC', base: 'SOL', quote: 'USDC' })
  })

  it('resolves the devnet wrapped-BTC mint to BTC/USDC', () => {
    const label = resolveBaseMintLabel(new PublicKey('3BZPwbcqB5kKScF3TEXxwNfx5ipV13kbRVDvfVp5c6fv'))
    expect(label.pair).toBe('BTC/USDC')
    expect(label.base).toBe('BTC')
  })

  it('falls back to a truncated label for unknown mints', () => {
    const label = resolveBaseMintLabel(new PublicKey('11111111111111111111111111111111'))
    expect(label.pair).toBe('1111…/USDC')
    expect(label.base).toBe('1111')
    expect(label.quote).toBe('USDC')
  })

  it('accepts a base58 string input as well as a PublicKey', () => {
    const a = resolveBaseMintLabel('So11111111111111111111111111111111111111112')
    const b = resolveBaseMintLabel(new PublicKey('So11111111111111111111111111111111111111112'))
    expect(a).toEqual(b)
  })

  it('exposes the lookup table so other surfaces can iterate known pairs', () => {
    expect(Object.keys(KNOWN_DEVNET_MINTS).length).toBeGreaterThanOrEqual(3)
    expect(KNOWN_DEVNET_MINTS['So11111111111111111111111111111111111111112'].base).toBe('SOL')
  })
})
