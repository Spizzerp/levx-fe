/**
 * Mint → human-readable pair label resolution.
 *
 * On-chain `ProtocolState.supportedPairs[]` carries `{ baseMint, quoteMint,
 * pythFeedId, active }` — no symbolic name. Devnet test mints have no SPL
 * Token Metadata account either. So mapping a base mint to "BTC/USDC" needs
 * a hand-curated table per cluster.
 *
 * The mapping below tracks the canonical devnet test mints currently in
 * use (mirrors `PAIRS` in AdminPage.tsx — single source kept here so other
 * surfaces can reuse without importing from a route module). Quote is
 * always USDC in Mode 1; if/when that changes, lift `quote` per row.
 *
 * Unknown mints get a graceful truncated fallback (`So11…/USDC`) instead
 * of crashing or rendering empty strings.
 */

import { PublicKey } from '@solana/web3.js'

export interface PairLabel {
  pair: string
  base: string
  quote: string
}

/**
 * Known devnet test mints. Keep in sync with AdminPage's `PAIRS` array.
 * Adding a row here makes the corresponding market render with a nice label
 * instantly without needing on-chain metadata.
 */
export const KNOWN_DEVNET_MINTS: Readonly<Record<string, PairLabel>> = {
  // SOL → wrapped SOL
  So11111111111111111111111111111111111111112: { pair: 'SOL/USDC', base: 'SOL', quote: 'USDC' },
  // Devnet wrapped BTC
  '3BZPwbcqB5kKScF3TEXxwNfx5ipV13kbRVDvfVp5c6fv': { pair: 'BTC/USDC', base: 'BTC', quote: 'USDC' },
  // Devnet wrapped ETH
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { pair: 'ETH/USDC', base: 'ETH', quote: 'USDC' },
}

/**
 * Resolve a base-mint pubkey to a friendly pair label. Falls back to a
 * truncated render so the UI degrades gracefully when an unrecognized
 * mint shows up (e.g. a freshly added pair where this table hasn't been
 * updated yet).
 */
export function resolveBaseMintLabel(baseMint: PublicKey | string): PairLabel {
  const key = typeof baseMint === 'string' ? baseMint : baseMint.toBase58()
  const known = KNOWN_DEVNET_MINTS[key]
  if (known) return known
  const short = key.slice(0, 4)
  return { pair: `${short}…/USDC`, base: short, quote: 'USDC' }
}
