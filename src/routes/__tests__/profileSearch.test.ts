import { describe, expect, it } from 'vitest'

import { validateProfileSearch } from '@/routes/profileSearch'

describe('validateProfileSearch', () => {
  it('keeps plausible base58 wallet search params', () => {
    expect(validateProfileSearch({ wallet: ' 11111111111111111111111111111111 ' })).toEqual({
      wallet: '11111111111111111111111111111111',
    })
  })

  it('drops malformed wallet search params', () => {
    expect(validateProfileSearch({ wallet: 'foo' })).toEqual({ wallet: undefined })
    expect(validateProfileSearch({ wallet: '0OIl1111111111111111111111111111' })).toEqual({
      wallet: undefined,
    })
    expect(validateProfileSearch({ wallet: 123 })).toEqual({ wallet: undefined })
  })
})
