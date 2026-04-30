/**
 * Map from on-chain event name → the React-Query keys that should be
 * invalidated when that event lands. Keeps the FE's reads in sync with
 * the program without a polling-only floor.
 *
 * Event names match the IDL (PascalCase). Field names on the payload
 * follow Anchor's camelCase convention.
 *
 * Keys here mirror the conventions used by the read hooks in
 * `src/lib/api/hooks.ts`. `['userPositions']` is a prefix that matches
 * `['userPositions', walletKey]` via React Query's prefix-match
 * semantics, so a single key here invalidates all walletKey variants.
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query'

type AnyData = Record<string, unknown>

interface BNLike {
  toNumber(): number
}

function isBNLike(v: unknown): v is BNLike {
  return typeof v === 'object' && v !== null && typeof (v as { toNumber?: unknown }).toNumber === 'function'
}

/**
 * Normalize an Anchor-decoded marketId (BN | number | string) to the
 * string form used by React Query keys (e.g. `['market', '7']`).
 */
export function marketKey(marketId: unknown): string {
  if (typeof marketId === 'number') return String(marketId)
  if (typeof marketId === 'string') return marketId
  if (isBNLike(marketId)) return String(marketId.toNumber())
  return ''
}

type InvalidationFactory = (data: AnyData) => QueryKey[]

/**
 * Per-event invalidation. Events not listed are observed but no cache
 * action is taken (e.g. admin-only events like `DisputeConfigUpdated`
 * or rent-reclaim notifications like `PathOutcomeClosed` —
 * `getUserPositions` already gracefully handles closed paths).
 */
export const EVENT_INVALIDATION_MAP: Readonly<Record<string, InvalidationFactory>> = {
  // ── Market lifecycle ──────────────────────────────────────────────
  MarketCreated: () => [['markets']],
  MarketActivated: (d) => [['market', marketKey(d.marketId)], ['markets']],
  MarketSettled: (d) => [['market', marketKey(d.marketId)], ['markets'], ['userPositions']],
  MarketFinalized: (d) => [['market', marketKey(d.marketId)], ['markets'], ['userPositions']],
  MarketVoided: (d) => [['market', marketKey(d.marketId)], ['markets'], ['userPositions']],
  DisputedMarketFinalized: (d) => [
    ['market', marketKey(d.marketId)],
    ['markets'],
    ['userPositions'],
  ],

  // ── User-driven (wager / exit / claim) ────────────────────────────
  WagerPlaced: (d) => [
    ['market', marketKey(d.marketId)],
    ['userPosition', marketKey(d.marketId)],
    ['userPositions'],
    ['markets'],
  ],
  PositionExited: (d) => [
    ['market', marketKey(d.marketId)],
    ['userPosition', marketKey(d.marketId)],
    ['userPositions'],
    ['markets'],
  ],
  ClaimPaid: (d) => [
    ['market', marketKey(d.marketId)],
    ['userPosition', marketKey(d.marketId)],
    ['userPositions'],
  ],

  // ── Path lifecycle ────────────────────────────────────────────────
  PathAdded: (d) => [['market', marketKey(d.marketId)], ['markets']],
  PathScored: (d) => [['market', marketKey(d.marketId)]],
  PathDissolved: (d) => [['market', marketKey(d.marketId)], ['userPositions']],

  // ── Sampling progress ─────────────────────────────────────────────
  CheckpointSampled: (d) => [['market', marketKey(d.marketId)]],

  // ── Disputes ──────────────────────────────────────────────────────
  DisputeRaised: (d) => [['market', marketKey(d.marketId)], ['markets']],
  DisputeResolved: (d) => [['market', marketKey(d.marketId)], ['markets'], ['userPositions']],
}

/**
 * Look up the invalidation factory for an event and call
 * `queryClient.invalidateQueries` for each key it returns. Unknown
 * events are no-ops.
 */
export function dispatchEventInvalidation(
  queryClient: QueryClient,
  event: { name: string; data: unknown },
): void {
  const factory = EVENT_INVALIDATION_MAP[event.name]
  if (!factory) return
  const data = (event.data as AnyData) ?? {}
  for (const queryKey of factory(data)) {
    queryClient.invalidateQueries({ queryKey })
  }
}
