// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { parseScaledDecimalBn } from '@/lib/fixedPoint'

describe('parseScaledDecimalBn', () => {
  it('parses integer and decimal values exactly', () => {
    expect(parseScaledDecimalBn('Pair max OI', '100000', 6).toString()).toBe('100000000000')
    expect(parseScaledDecimalBn('Pair max OI', '12.34', 6).toString()).toBe('12340000')
    expect(parseScaledDecimalBn('Pair max OI', '1.', 6).toString()).toBe('1000000')
  })

  it('rejects inputs with more precision than the fixed-point scale', () => {
    expect(() => parseScaledDecimalBn('Pair max OI', '0.0000004', 6)).toThrow(
      'Pair max OI supports at most 6 decimal places',
    )
  })

  it('preserves values above the JavaScript safe integer range', () => {
    expect(parseScaledDecimalBn('Pair max OI', '9007199254740.993', 6).toString()).toBe(
      '9007199254740993000',
    )
  })
})
