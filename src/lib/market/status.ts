import type { Market, MarketState } from '@/types/market'

type MarketWageringState = Pick<Market, 'state' | 'completedCheckpoints' | 'totalCheckpoints'>

const WAGERING_CUTOFF_NUMERATOR = 4
const WAGERING_CUTOFF_DENOMINATOR = 5

const WAGERING_STATES: ReadonlySet<MarketState> = new Set(['active', 'sampling'])

export function getWageringCutoffCheckpoint(totalCheckpoints: number): number {
  if (!Number.isFinite(totalCheckpoints) || totalCheckpoints <= 0) return 0
  return Math.ceil((totalCheckpoints * WAGERING_CUTOFF_NUMERATOR) / WAGERING_CUTOFF_DENOMINATOR)
}

export function isMarketWageringOpen(market: MarketWageringState): boolean {
  if (!WAGERING_STATES.has(market.state)) return false
  const cutoff = getWageringCutoffCheckpoint(market.totalCheckpoints)
  if (cutoff <= 0) return false
  return market.completedCheckpoints < cutoff
}

export function getMarketDisplayState(market: MarketWageringState): MarketState {
  if (!WAGERING_STATES.has(market.state)) return market.state
  const cutoff = getWageringCutoffCheckpoint(market.totalCheckpoints)
  if (cutoff <= 0) return market.state
  return market.completedCheckpoints < cutoff ? 'active' : 'sampling'
}
