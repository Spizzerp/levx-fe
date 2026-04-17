import type { Connection } from '@solana/web3.js'

/** Floor fee so we never submit a tx with zero priority under congestion. */
const FALLBACK_MICROLAMPORTS = 10_000

/** How long to cache a fetched fee across mutations. */
const CACHE_MS = 5_000

let cached: { value: number; at: number } | null = null

/**
 * Returns the 75th-percentile of the last ~150 recent prioritization fees
 * in microlamports per CU. Cached briefly across callers so back-to-back
 * mutations share a single RPC hop. Falls back to FALLBACK_MICROLAMPORTS
 * when the RPC is empty or unavailable.
 */
export async function getPriorityFee(connection: Connection): Promise<number> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  try {
    const samples = await connection.getRecentPrioritizationFees()
    if (samples.length === 0) {
      const value = FALLBACK_MICROLAMPORTS
      cached = { value, at: Date.now() }
      return value
    }
    const fees = samples.map((s) => s.prioritizationFee).sort((a, b) => a - b)
    const p75 = fees[Math.floor(fees.length * 0.75)] ?? FALLBACK_MICROLAMPORTS
    const value = Math.max(p75, FALLBACK_MICROLAMPORTS)
    cached = { value, at: Date.now() }
    return value
  } catch {
    return FALLBACK_MICROLAMPORTS
  }
}

/** Test-only: reset the module-level cache between cases. */
export function __resetPriorityFeeCacheForTest(): void {
  cached = null
}
