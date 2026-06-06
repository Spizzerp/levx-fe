/**
 * Map from on-chain event name → the React-Query keys that should be
 * invalidated when that event lands. Keeps the FE's reads in sync with
 * the program without a polling-only floor.
 *
 * Event names match the IDL (PascalCase). **Field names on the payload
 * are snake_case** — Anchor's `BorshEventCoder` returns IDL field names
 * verbatim (unlike the account decoder, which camelCases). Verified
 * directly: `coder.decode(...).data` for `WagerPlaced` yields
 * `{ market_id, user, path_index, collateral, shares }`.
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
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { toNumber?: unknown }).toNumber === 'function'
  )
}

/**
 * Read a payload field by its IDL (snake_case) name with a camelCase
 * fallback. Defensive against future Anchor versions that flip the
 * convention or against mixed-shape payloads from custom decoders.
 */
export function readField(data: AnyData, snakeName: string): unknown {
  if (snakeName in data) return data[snakeName]
  const camel = snakeName.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  return data[camel]
}

/**
 * Normalize an Anchor-decoded marketId (BN | number | string) to the
 * string form used by React Query keys (e.g. `['market', '7']`).
 * Returns empty string for missing/unrecognized inputs so we don't
 * accidentally produce `['market', '']` and silently miss real keys —
 * callers should guard against this when extracting from event data.
 */
export function marketKey(marketId: unknown): string {
  if (typeof marketId === 'number') return String(marketId)
  if (typeof marketId === 'string') return marketId
  if (isBNLike(marketId)) return String(marketId.toNumber())
  return ''
}

/**
 * Pull `market_id` (or `marketId` fallback) off a decoded payload and
 * normalize to a query-key-friendly string. Returns null when no
 * recognizable id is present so callers can early-exit instead of
 * invalidating `['market', '']`.
 */
function eventMarketKey(data: AnyData): string | null {
  const raw = readField(data, 'market_id')
  if (raw === undefined || raw === null) return null
  const key = marketKey(raw)
  return key === '' ? null : key
}

type InvalidationFactory = (data: AnyData) => QueryKey[]

/**
 * Per-event invalidation. Events not listed are observed but no cache
 * action is taken (e.g. admin-only events like `DisputeConfigUpdated`
 * or rent-reclaim notifications like `PathOutcomeClosed` —
 * `getUserPositions` already gracefully handles closed paths).
 */
/**
 * Wrap a factory so events with no resolvable `market_id` short-circuit
 * to a markets-only invalidation instead of producing `['market', '']`.
 */
function withMarket(fn: (mk: string) => QueryKey[]): InvalidationFactory {
  return (data) => {
    const mk = eventMarketKey(data)
    if (mk === null) return [['markets']]
    return fn(mk)
  }
}

export const EVENT_INVALIDATION_MAP: Readonly<Record<string, InvalidationFactory>> = {
  // ── Market lifecycle ──────────────────────────────────────────────
  MarketCreated: () => [['markets']],
  MarketActivated: withMarket((mk) => [['market', mk], ['markets']]),
  MarketSettled: withMarket((mk) => [['market', mk], ['markets'], ['userPositions']]),
  MarketFinalized: withMarket((mk) => [['market', mk], ['markets'], ['userPositions']]),
  MarketVoided: withMarket((mk) => [['market', mk], ['markets'], ['userPositions']]),
  MarketClosed: withMarket((mk) => [['market', mk], ['markets'], ['userPositions']]),
  DisputedMarketFinalized: withMarket((mk) => [['market', mk], ['markets'], ['userPositions']]),

  // ── Market group sidecars ────────────────────────────────────────
  MarketGroupCreated: () => [['markets']],
  MarketGroupStatusUpdated: () => [['markets']],
  MarketGroupClosed: () => [['markets']],
  MarketLinkedToGroup: withMarket((mk) => [['market', mk], ['markets']]),
  MarketUnlinkedFromGroup: withMarket((mk) => [['market', mk], ['markets']]),

  // ── User-driven (wager / exit / claim) ────────────────────────────
  WagerPlaced: withMarket((mk) => [
    ['market', mk],
    ['userPosition', mk],
    ['userPositions'],
    ['markets'],
  ]),
  PositionExited: withMarket((mk) => [
    ['market', mk],
    ['userPosition', mk],
    ['userPositions'],
    ['markets'],
  ]),
  ClaimPaid: withMarket((mk) => [['market', mk], ['userPosition', mk], ['userPositions']]),

  // ── Path lifecycle ────────────────────────────────────────────────
  PathAdded: withMarket((mk) => [['market', mk], ['markets']]),
  PathScored: withMarket((mk) => [['market', mk]]),
  PathDissolved: withMarket((mk) => [['market', mk], ['userPositions']]),

  // ── Sampling progress ─────────────────────────────────────────────
  CheckpointSampled: withMarket((mk) => [['market', mk]]),

  // ── Disputes ──────────────────────────────────────────────────────
  DisputeRaised: withMarket((mk) => [['market', mk], ['markets']]),
  DisputeResolved: withMarket((mk) => [['market', mk], ['markets'], ['userPositions']]),
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
