// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { Address } from '@solana/kit'
import { cohortPda, epochPda, groupPda, mode1MarketPda } from '@spizzerp/levx-mode2-client'

// Expected addresses were read from devnet on 2026-11-01.
describe('custody client install', () => {
  it('derives the market 142 accounts', () => {
    const market = mode1MarketPda(142n)
    expect(market).toBe('CiAyUNKxoSHZXDBZfsMR7CurJaCqAo4cZhUyhASvbDpD')
    expect(cohortPda(market)).toBe('F6xAsG4C9hY29fST9ieisYojjFp9DN81oxmYUufEcNVA')
    expect(epochPda(61n)).toBe('9Loa8VpSkJdm55EhmsbrHHR33H1LZ3DhJ2B3HbaRuK4S')
  })

  it('derives group 0 of the market 142 cohort', () => {
    expect(groupPda('F6xAsG4C9hY29fST9ieisYojjFp9DN81oxmYUufEcNVA' as Address, 0)).toBe(
      '9g2gbU2QWmG42Sn8dZ2zFN6bVuZNpmoBjGBAWPw3SUmn',
    )
  })
})
