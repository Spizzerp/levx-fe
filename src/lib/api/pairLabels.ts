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

import { PYTH_FEED_IDS } from '@/lib/pyth/feedIds'

export interface PairLabel {
  pair: string
  base: string
  quote: string
}

/**
 * Reverse-lookup a Pyth feed id (no `0x` prefix, lowercase or not) to
 * the matching `PYTH_FEED_IDS` entry's pair label. Used as a label
 * source when the on-chain base mint isn't in `KNOWN_DEVNET_MINTS` but
 * the registered feed *is* a known major (e.g. devnet test markets that
 * use random base mints alongside the canonical SOL/USD feed).
 *
 * Returning the same `{pair, base, quote}` shape as `resolveBaseMintLabel`
 * means callers can compose the two without branching.
 */
function resolveByFeedId(feedHex: string): PairLabel | null {
  const want = feedHex.replace(/^0x/i, '').toLowerCase()
  for (const [pair, hex] of Object.entries(PYTH_FEED_IDS)) {
    if (hex.replace(/^0x/i, '').toLowerCase() === want) {
      const [base, quote] = pair.split('/')
      return { pair, base, quote }
    }
  }
  return null
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
 * Resolve a base-mint pubkey (and optional Pyth feed id) to a friendly
 * pair label. Resolution order:
 *
 *   1. `KNOWN_DEVNET_MINTS[baseMint]` — the canonical devnet table.
 *   2. `PYTH_FEED_IDS` reverse-lookup on `feedIdHex` — useful when the
 *      market was registered with a random/test base mint but a real
 *      Pyth feed (e.g. SOL/USD `ef0d…`). The chart's benchmarks history
 *      is keyed off this label, so a recognized label keeps the chart
 *      live even when the mint is unknown.
 *   3. Truncated `<short>…/USDC` fallback so the UI degrades gracefully.
 */
export function resolveBaseMintLabel(
  baseMint: PublicKey | string,
  feedIdHex?: string | null,
): PairLabel {
  const key = typeof baseMint === 'string' ? baseMint : baseMint.toBase58()
  const known = KNOWN_DEVNET_MINTS[key]
  if (known) return known
  if (feedIdHex) {
    const byFeed = resolveByFeedId(feedIdHex)
    if (byFeed) return byFeed
  }
  const short = key.slice(0, 4)
  return { pair: `${short}…/USDC`, base: short, quote: 'USDC' }
}
