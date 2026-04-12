/**
 * Mock API — stands in for the real indexer/RPC backend until it exists.
 *
 * Provides market metadata only. Historical prices come from Pyth Benchmarks
 * (useBenchmarksHistory) and live prices from Pyth Hermes SSE (usePythFeed).
 *
 * When the real backend lands, replace these functions with `fetch` calls.
 * Types stay the same; the hooks in ./hooks.ts don't need to change.
 */

import type { CurrentPrice, Market } from '@/types/market'

/* ── Fixture data ───────────────────────────────────────────── */

const DAY = 24 * 60 * 60 * 1000

const MARKETS: Market[] = [
  {
    id: 'btc',
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'active',
    pool: 248_901,
    traders: 1204,
    startTime: Date.now() - 7 * DAY,
    endTime: Date.now() + 7 * DAY,
    checkpointInterval: 3600,
    completedCheckpoints: 168,
    totalCheckpoints: 336,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 150,
    history: [],
    paths: [],
  },
  {
    id: 'eth',
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    state: 'active',
    pool: 142_560,
    traders: 876,
    startTime: Date.now() - 7 * DAY,
    endTime: Date.now() + 7 * DAY,
    checkpointInterval: 3600,
    completedCheckpoints: 168,
    totalCheckpoints: 336,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 150,
    history: [],
    paths: [],
  },
  {
    id: 'sol',
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    state: 'active',
    pool: 89_410,
    traders: 412,
    startTime: Date.now() - 7 * DAY,
    endTime: Date.now() + 7 * DAY,
    checkpointInterval: 3600,
    completedCheckpoints: 168,
    totalCheckpoints: 336,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 150,
    history: [],
    paths: [],
  },
]

/* ── Fake network latency ───────────────────────────────────── */

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/* ── Exported API ───────────────────────────────────────────── */

export async function getMarkets(): Promise<Market[]> {
  return delay(MARKETS)
}

export async function getMarket(id: string): Promise<Market> {
  const match = MARKETS.find((m) => m.id === id)
  if (!match) throw new Error(`Market not found: ${id}`)
  return delay(match)
}

export async function getCurrentPrice(pair: string): Promise<CurrentPrice> {
  return delay({
    pair,
    value: 0,
    delta24hBps: 0,
    timestamp: Date.now(),
  })
}
