import { describe, it, expect } from 'vitest'

import {
  ERROR_MAP,
  PREFLIGHT_CODES,
  formatDecoded,
  lookupError,
} from '@/lib/solana/errorMap'

describe('lookupError', () => {
  it('resolves the most-likely user-hit Anchor errors', () => {
    const expected = [
      'WagersNotAccepted',
      'TradingCutoffReached',
      'WagerTooSmall',
      'InvalidPathIndex',
      'PathDissolved',
      'FeeExceedsCap',
      'MarketNotSettled',
      'AlreadyClaimed',
      'MarketDisputed',
      'MaturityNotElapsed',
      'SlippageExceeded',
      'Unauthorized',
    ]
    for (const name of expected) {
      const decoded = lookupError(name)
      expect(decoded, `${name} should be in ERROR_MAP`).toBeDefined()
      expect(decoded!.userMessage).toMatch(/\S/) // non-empty, has content
    }
  })

  it('resolves preflight codes for FE-side guards', () => {
    expect(lookupError(PREFLIGHT_CODES.ATA_NOT_FOUND)?.userMessage).toMatch(/USDC token account/i)
    expect(lookupError(PREFLIGHT_CODES.INSUFFICIENT_USDC)?.userMessage).toMatch(/Insufficient USDC/i)
  })

  it('returns undefined for unknown codes (fall-through to raw .message in callers)', () => {
    expect(lookupError('TotallyMadeUpError')).toBeUndefined()
    expect(lookupError(undefined)).toBeUndefined()
    expect(lookupError('')).toBeUndefined()
  })
})

describe('formatDecoded', () => {
  it('joins userMessage + hint with a space when both present', () => {
    const out = formatDecoded(ERROR_MAP.SlippageExceeded)
    expect(out).toMatch(/Slippage exceeded/)
    expect(out).toMatch(/Increase slippage/)
  })

  it('returns userMessage alone when no hint', () => {
    expect(formatDecoded(ERROR_MAP.AlreadyClaimed)).toBe(
      ERROR_MAP.AlreadyClaimed.userMessage,
    )
  })
})

describe('SlippageExceeded backward-compat', () => {
  // PR1 wired SlippageExceeded directly in transactions.ts; PR4 routes
  // through ERROR_MAP. Make sure the toast text didn't regress in shape.
  it('still mentions slippage and offers a next step', () => {
    const decoded = lookupError('SlippageExceeded')!
    expect(decoded.userMessage.toLowerCase()).toMatch(/slippage/)
    expect(decoded.hint).toBeDefined()
    expect(decoded.hint!.toLowerCase()).toMatch(/slippage|refresh/)
  })
})
