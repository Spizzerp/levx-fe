/**
 * Mock API — stands in for the real indexer/RPC backend until it exists.
 *
 * All functions return promises with a small artificial delay so hooks
 * exercise their loading states realistically. Data is deterministic
 * (seeded PRNG) so reloads don't thrash the UI.
 *
 * When the real backend lands, replace these functions with `fetch` calls.
 * Types stay the same; the hooks in ./hooks.ts don't need to change.
 */

import type {
  CurrentPrice,
  Market,
  MarketState,
  PathTone,
  PredictionPath,
  PricePoint,
} from '@/types/market'

/* ── Seeded PRNG + helpers ──────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function walk(
  start: number,
  end: number,
  startVal: number,
  endVal: number,
  volatility: number,
  stepMs: number,
  seed: number,
): PricePoint[] {
  const rand = mulberry32(seed)
  const points: PricePoint[] = []
  const steps = Math.max(1, Math.floor((end - start) / stepMs))
  for (let i = 0; i <= steps; i++) {
    const t = start + i * stepMs
    const progress = i / steps
    const trend = startVal + (endVal - startVal) * progress
    const noise = (rand() - 0.5) * volatility * trend
    points.push({ time: t, value: Math.max(1, trend + noise) })
  }
  return points
}

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/* ── Fixture data ───────────────────────────────────────────── */

/** Anchor "now" — in a real backend this would be Date.now() */
const NOW = new Date('2027-02-10T14:30:00Z').getTime()

interface MarketFixture {
  id: string
  pair: string
  base: string
  quote: string
  state: MarketState
  durationDays: number
  progressPct: number
  startPrice: number
  endpoints: [number, number, number, number, number] // ultra-bull, bull, neutral, bear, ultra-bear
  pool: number
  traders: number
  pathMultipliers: [number, number, number, number, number]
  leverageEnabled: boolean
  maxLeverage: number
  historyVol: number
  seedBase: number
}

const fixtures: MarketFixture[] = [
  {
    id: '1',
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'sampling',
    durationDays: 7,
    progressPct: 0.15,
    startPrice: 40000,
    endpoints: [108000, 82000, 71000, 52000, 28000],
    pool: 248_901,
    traders: 1204,
    pathMultipliers: [0.47, 0.62, 1.0, 1.84, 3.21],
    leverageEnabled: true,
    maxLeverage: 20,
    historyVol: 0.12,
    seedBase: 1000,
  },
  {
    id: '2',
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    state: 'active',
    durationDays: 3,
    progressPct: 0.05,
    startPrice: 180,
    endpoints: [340, 260, 210, 150, 80],
    pool: 89_410,
    traders: 412,
    pathMultipliers: [0.92, 0.74, 1.0, 1.38, 2.65],
    leverageEnabled: true,
    maxLeverage: 30,
    historyVol: 0.18,
    seedBase: 2000,
  },
  {
    id: '3',
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    state: 'pending',
    durationDays: 30,
    progressPct: -0.02, // starts in the near future
    startPrice: 3800,
    endpoints: [6200, 5100, 4400, 3200, 2100],
    pool: 0,
    traders: 0,
    pathMultipliers: [1.0, 1.0, 1.0, 1.0, 1.0], // no trades yet
    leverageEnabled: true,
    maxLeverage: 10,
    historyVol: 0.14,
    seedBase: 3000,
  },
  {
    id: '4',
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'settling',
    durationDays: 1,
    progressPct: 1.0,
    startPrice: 68000,
    endpoints: [78000, 74000, 71000, 68000, 62000],
    pool: 56_240,
    traders: 287,
    pathMultipliers: [0.38, 0.81, 1.0, 2.14, 4.12],
    leverageEnabled: true,
    maxLeverage: 50,
    historyVol: 0.06,
    seedBase: 4000,
  },
  {
    id: '5',
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    state: 'settled',
    durationDays: 7,
    progressPct: 1.0,
    startPrice: 160,
    endpoints: [260, 220, 190, 150, 100],
    pool: 31_820,
    traders: 156,
    pathMultipliers: [0.52, 0.88, 1.0, 1.64, 3.44],
    leverageEnabled: true,
    maxLeverage: 20,
    historyVol: 0.15,
    seedBase: 5000,
  },
]

const TONE_ORDER: PathTone[] = ['ultra-bull', 'bull', 'neutral', 'bear', 'ultra-bear']
const LABELS = ['Ultra-Bullish', 'Bullish', 'Neutral', 'Bearish', 'Ultra-Bearish']

function buildMarket(f: MarketFixture): Market {
  const totalMs = f.durationDays * DAY
  // Negative progress → market starts in the future (pending state)
  const elapsedMs = f.progressPct * totalMs

  // Place the market so that "now" sits at the current progress point
  const startTime = NOW - elapsedMs
  const endTime = startTime + totalMs

  // History = from start (or a bit before for pending) up to "now"
  const historyStart = f.state === 'pending' ? NOW - 14 * DAY : startTime
  const historyEnd = f.state === 'settled' ? endTime : Math.min(NOW, endTime)

  // Use finer step for shorter markets
  const historyStep = f.durationDays <= 1 ? HOUR : f.durationDays <= 7 ? 4 * HOUR : DAY
  const history = walk(
    historyStart,
    historyEnd,
    f.startPrice,
    f.startPrice * (1 + (f.endpoints[2] / f.startPrice - 1) * f.progressPct),
    f.historyVol,
    historyStep,
    f.seedBase,
  )

  const lastHistoryValue = history[history.length - 1]?.value ?? f.startPrice

  const predStart =
    f.state === 'pending' ? startTime : (history[history.length - 1]?.time ?? startTime)
  const predStep = f.durationDays <= 1 ? HOUR : f.durationDays <= 7 ? 6 * HOUR : 2 * DAY

  const paths: PredictionPath[] = TONE_ORDER.map((tone, idx) => ({
    id: `${f.id}-${tone}`,
    label: LABELS[idx],
    tone,
    origin: 'ai',
    multiplier: f.pathMultipliers[idx],
    data: walk(
      predStart,
      endTime,
      lastHistoryValue,
      f.endpoints[idx],
      0.05 + idx * 0.01,
      predStep,
      f.seedBase + 100 + idx,
    ),
  }))

  const checkpointIntervalSec =
    f.durationDays <= 1 ? 15 * 60 : f.durationDays <= 7 ? 60 * 60 : 4 * 60 * 60
  const totalCheckpoints = Math.floor(totalMs / 1000 / checkpointIntervalSec)
  const completedCheckpoints = Math.floor(Math.max(0, f.progressPct) * totalCheckpoints)

  return {
    id: f.id,
    pair: f.pair,
    base: f.base,
    quote: f.quote,
    state: f.state,
    pool: f.pool,
    traders: f.traders,
    startTime,
    endTime,
    checkpointInterval: checkpointIntervalSec,
    completedCheckpoints,
    totalCheckpoints,
    leverageEnabled: f.leverageEnabled,
    maxLeverage: f.maxLeverage,
    entryFeeBps: 150,
    history,
    paths,
  }
}

const MARKETS: Market[] = fixtures.map(buildMarket)

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
  const market = MARKETS.find((m) => m.pair === pair)
  const last = market?.history[market.history.length - 1]
  return delay({
    pair,
    value: last?.value ?? 0,
    delta24hBps: Math.floor(Math.sin(NOW / 1e7 + pair.length) * 500 + 352),
    timestamp: NOW,
  })
}

/** Anchor "now" exported for chart time domains. Real backend: Date.now(). */
export function getNow(): number {
  return NOW
}
