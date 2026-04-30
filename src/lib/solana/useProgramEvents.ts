/**
 * Component-level subscription hook for on-chain events. Filters by
 * event name and (optionally) marketId so a page can react to "the
 * user just placed a wager on THIS market" without seeing every
 * unrelated event the program emits.
 *
 * The default React-Query invalidation listener is wired separately in
 * `EventStreamProvider` — most components don't need this hook; reach
 * for it when you want to imperatively respond to an event (e.g.
 * trigger a confetti animation on `ClaimPaid`).
 */

import { useEffect } from 'react'

import { readField } from '@/lib/api/eventInvalidation'
import { useEventStream } from './eventStreamContext'
import type { ProgramEvent } from './events'

interface UseProgramEventsOptions {
  /**
   * Filter to events matching this PascalCase name (matches IDL).
   * Omit to receive every event.
   */
  name?: string
  /**
   * Filter to events whose payload has matching `marketId` (numeric).
   * Omit to receive across all markets. Events without a `marketId`
   * field are excluded when this is set.
   */
  marketId?: number
  /** Callback. Memoize via `useCallback` to avoid re-subscribing on every render. */
  onEvent: (event: ProgramEvent) => void
}

interface BNLike {
  toNumber(): number
}

function asNumeric(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v !== null) {
    const maybeBn = v as Partial<BNLike>
    if (typeof maybeBn.toNumber === 'function') return maybeBn.toNumber()
  }
  return null
}

export function useProgramEvents({ name, marketId, onEvent }: UseProgramEventsOptions): void {
  const stream = useEventStream()

  useEffect(() => {
    if (!stream) return
    const unregister = stream.addListener((event) => {
      if (name !== undefined && event.name !== name) return
      if (marketId !== undefined) {
        // BorshEventCoder returns IDL field names verbatim (snake_case).
        // readField checks both shapes so this stays correct if Anchor
        // ever flips its convention.
        const eventMarketId = asNumeric(readField((event.data as Record<string, unknown>) ?? {}, 'market_id'))
        if (eventMarketId !== marketId) return
      }
      onEvent(event)
    })
    return unregister
  }, [stream, name, marketId, onEvent])
}
