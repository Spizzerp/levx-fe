import type { PricePoint } from '@/types/market'

const NO_CHANGE = { value: 0, isPositive: true }

/**
 * The percentage change from the market's start to `current`. The baseline is checkpoint 0's
 * settled price when it exists, else the history point nearest the market's start.
 */
export function changeSinceStart(args: {
  history: PricePoint[]
  marketStart: number
  checkpoint0Price?: number
  current: number
}): { value: number; isPositive: boolean } {
  const { history, marketStart, checkpoint0Price, current } = args
  let baseline = checkpoint0Price
  if (baseline === undefined) {
    if (history.length === 0) return NO_CHANGE
    baseline = history.reduce((prev, curr) =>
      Math.abs(curr.time - marketStart) < Math.abs(prev.time - marketStart) ? curr : prev,
    ).value
  }
  if (baseline === 0) return NO_CHANGE

  const diff = ((current - baseline) / baseline) * 100
  return { value: Math.abs(diff), isPositive: diff >= 0 }
}
