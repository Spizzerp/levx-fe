import { describe, expect, it } from 'vitest'

import { buildCryptoGroupPreview } from '../productMetadata'

describe('productMetadata', () => {
  it('previews operator-facing crypto metadata without fabricated hashes', () => {
    const preview = buildCryptoGroupPreview({
      pair: 'SOL/USDC',
      productSeason: '2026',
      horizon: '1d',
    })

    expect(preview).toEqual({
      slug: 'sol-usdc-2026-1d-season',
      seasonKey: 'SOL/USDC:2026:1d',
    })
    expect('groupKeyHash' in preview).toBe(false)
    expect('metadataHash' in preview).toBe(false)
  })
})
