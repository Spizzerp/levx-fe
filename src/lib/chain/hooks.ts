/**
 * Phase 2: re-export the mock-backed hooks unchanged.
 * Phase 3: replace these re-exports with Anchor account reads. Signature is frozen.
 * Rule: page-level code imports from '@/lib/chain', never from '@/lib/api/hooks' directly.
 */
export { useMarkets, useMarket, useUserPosition, useUserPositions } from '@/lib/api/hooks'
