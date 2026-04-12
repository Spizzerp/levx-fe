/** Pyth Hermes feed IDs for the pairs Phase 1 supports.
 *  Source: https://pyth.network/developers/price-feed-ids
 */
export const PYTH_FEED_IDS = {
  'SOL/USDC': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'BTC/USDC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USDC': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
} as const

/** Pyth Benchmarks TradingView-shim symbols for the same pairs.
 *  Benchmarks indexes feeds by string symbol (e.g. "Crypto.BTC/USD"), NOT by
 *  hex feed ID. We quote /USD here because Pyth does not publish /USDC history
 *  for these majors — USDC is effectively pegged, so SOL/USD is the right proxy.
 *  Verified against https://benchmarks.pyth.network/v1/shims/tradingview/history
 */
export const PYTH_BENCHMARK_SYMBOLS = {
  'SOL/USDC': 'Crypto.SOL/USD',
  'BTC/USDC': 'Crypto.BTC/USD',
  'ETH/USDC': 'Crypto.ETH/USD',
} as const

export type SupportedPair = keyof typeof PYTH_FEED_IDS

export function feedIdForPair(pair: string): string | null {
  return PYTH_FEED_IDS[pair as SupportedPair] ?? null
}

export function benchmarkSymbolForPair(pair: string): string | null {
  return PYTH_BENCHMARK_SYMBOLS[pair as SupportedPair] ?? null
}
