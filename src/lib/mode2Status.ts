import type { PairRiskStatus } from '@/types/market'

export type Mode2StatusTone = 'safe' | 'warning' | 'neutral' | 'muted'

export function toneForPairRiskStatus(status: PairRiskStatus): Mode2StatusTone {
  if (status === 'active') return 'safe'
  if (status === 'drainOnly') return 'neutral'
  return 'warning'
}
