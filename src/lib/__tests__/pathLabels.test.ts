import { describe, expect, it } from 'vitest'

import { formatAiPathLabel } from '@/lib/pathLabels'

describe('formatAiPathLabel', () => {
  it('renders branded scenario labels for AI paths', () => {
    expect(formatAiPathLabel('ultra-bull')).toBe('LevX AI - Giga Bull')
    expect(formatAiPathLabel('bull')).toBe('LevX AI - Bull')
    expect(formatAiPathLabel('neutral')).toBe('LevX AI - Mild')
    expect(formatAiPathLabel('bear')).toBe('LevX AI - Bear')
    expect(formatAiPathLabel('ultra-bear')).toBe('LevX AI - Mega Bear')
  })
})
