import { describe, expect, it } from 'vitest'

import {
  getMarketDisplayState,
  getWageringCutoffCheckpoint,
  isMarketWageringOpen,
} from '@/lib/market/status'

const base = {
  completedCheckpoints: 0,
  totalCheckpoints: 42,
}

describe('market status helpers', () => {
  it('mirrors the on-chain 4/5 checkpoint wagering cutoff', () => {
    expect(getWageringCutoffCheckpoint(42)).toBe(33)
    expect(getWageringCutoffCheckpoint(336)).toBe(268)
  })

  it('treats active and sampling markets as wager-open before the cutoff', () => {
    expect(isMarketWageringOpen({ ...base, state: 'active' })).toBe(true)
    expect(isMarketWageringOpen({ ...base, state: 'sampling' })).toBe(true)
  })

  it('closes wagering at the cutoff checkpoint', () => {
    expect(
      isMarketWageringOpen({
        ...base,
        state: 'sampling',
        completedCheckpoints: 33,
      }),
    ).toBe(false)
  })

  it('shows Active while wagers are open and Sampling after the cutoff', () => {
    expect(getMarketDisplayState({ ...base, state: 'sampling' })).toBe('active')
    expect(
      getMarketDisplayState({
        ...base,
        state: 'active',
        completedCheckpoints: 33,
      }),
    ).toBe('sampling')
  })
})
