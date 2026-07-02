/**
 * Mock API — stands in for the real indexer/RPC backend until it exists.
 *
 * Provides market metadata only. Historical prices come from Pyth Benchmarks
 * (useBenchmarksHistory) and live prices from Pyth Hermes SSE (usePythFeed).
 *
 * When the real backend lands, replace these functions with `fetch` calls.
 * Types stay the same; the hooks in ./hooks.ts don't need to change.
 */

import type {
  CurrentPrice,
  Market,
  MarketGroup,
  MarketGroupLink,
  Mode2Readiness,
  PathTone,
  PredictionPath,
  PricePoint,
  UserPosition,
} from '@/types/market'
import { formatAiPathLabel } from '@/lib/pathLabels'

/* ── Fixture data ───────────────────────────────────────────── */

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000
const MOCK_USDC_MINT = '6xz4EVw6rYFnfJwgumXsBt28xgjvKjpAWpwzdvPUJkhz'
const MOCK_BASE_MINTS: Readonly<Record<string, string>> = {
  BTC: '3BZPwbcqB5kKScF3TEXxwNfx5ipV13kbRVDvfVp5c6fv',
  ETH: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  SOL: 'So11111111111111111111111111111111111111112',
}

/** Sensible defaults for on-chain fields not yet populated in mock layer. */
const ON_CHAIN_DEFAULTS: Pick<
  Market,
  | 'numPaths'
  | 'targetNumPaths'
  | 'amplitudes'
  | 'lmsrShareQuantities'
  | 'pricingActiveMask'
  | 'lmsrAlpha'
  | 'lambda'
  | 'decoherenceRate'
  | 'minimumProbability'
  | 'nudgeRate'
  | 'pathMaxAge'
  | 'pathsScored'
  | 'pathsDissolved'
> = {
  numPaths: 0,
  targetNumPaths: 3,
  amplitudes: [],
  lmsrShareQuantities: [],
  pricingActiveMask: 0,
  lmsrAlpha: 100_000,
  lambda: 0,
  decoherenceRate: 500_000,
  minimumProbability: 10_000,
  nudgeRate: 50_000,
  pathMaxAge: 3600,
  pathsScored: 0,
  pathsDissolved: 0,
}

/** Factory to keep fixture rows terse — override per-state fields as needed. */
function makeMarket(
  overrides: Partial<Market> &
    Pick<Market, 'id' | 'marketId' | 'pair' | 'base' | 'quote' | 'state'>,
): Market {
  const now = Date.now()
  const baseMint = overrides.baseMint ?? MOCK_BASE_MINTS[overrides.base] ?? `${overrides.base}-mint`
  const quoteMint =
    overrides.quoteMint ?? (overrides.quote === 'USDC' ? MOCK_USDC_MINT : `${overrides.quote}-mint`)
  return {
    pool: 100_000,
    traders: 500,
    vault: '',
    baseMint,
    quoteMint,
    startTime: now - 7 * DAY,
    endTime: now + 7 * DAY,
    checkpointInterval: 3600,
    completedCheckpoints: 0,
    totalCheckpoints: 336,
    leverageEnabled: false,
    maxLeverage: 1,
    entryFeeBps: 150,
    history: [],
    paths: [],
    ...ON_CHAIN_DEFAULTS,
    ...overrides,
  }
}

function generateHistory(start: number, count: number, price: number): PricePoint[] {
  return Array.from({ length: count }, (_, i) => ({
    time: start + i * HOUR,
    value: price + Math.sin(i / 10) * (price * 0.05) + (Math.random() - 0.5) * (price * 0.02),
  }))
}

function generatePaths(start: number, price: number): PredictionPath[] {
  const tones: PathTone[] = ['ultra-bull', 'bull', 'neutral', 'bear', 'ultra-bear']
  return tones.map((tone, i) => ({
    id: `path-${tone}`,
    label: formatAiPathLabel(tone),
    tone,
    origin: 'ai',
    multiplier: 1.5 + Math.random(),
    data: Array.from({ length: 24 }, (_, j) => ({
      time: start + (j + 1) * HOUR,
      value: price * (1 + (i - 2) * 0.05 + Math.sin(j / 5) * 0.02),
    })),
    pathIndex: i,
    predictedPrices: [],
    numCheckpoints: 24,
    generationTimestamp: start,
    creator: 'mock',
    cumulativeAction: 0,
    compositeScore: 80,
    peakAmplitude: 1_000_000,
    amplitudeAtDecoherence: 0,
    dissolved: false,
    dissolvedAtCheckpoint: 0,
    checkpointsProcessed: 24,
    createdAtCheckpoint: 0,
    firstActiveCheckpoint: 0,
    totalWagered: 1000,
    totalLeveragedExposure: 1000,
    lmsrSharesOutstanding: 1000,
    totalTimeWeightedExposure: 1000,
    currentImpliedProbability: 2000,
    initialAmplitude: 1_000_000,
  }))
}

const NOW = Date.now()

const MOCK_SEASON_GROUP: MarketGroup = {
  address: 'mock-season-group',
  authority: 'mock-admin',
  groupKeyHash: 'ab'.repeat(32),
  parentGroup: null,
  kind: 'season',
  status: 'active',
  baseMint: 'mock-btc',
  quoteMint: 'mock-usdc',
  pythFeedId: '00'.repeat(32),
  constraintFlags: 0,
  startTime: NOW - 30 * DAY,
  endTime: NOW + 365 * DAY,
  allowedTimeframesMask: 0,
  metadataHash: 'cd'.repeat(32),
  childMarketCount: 2,
}

const MOCK_SEASON_LINK: MarketGroupLink = {
  address: 'mock-season-link',
  group: MOCK_SEASON_GROUP.address,
  market: 'mock-btc-market',
  marketId: 0,
  timeframeSeconds: (14 * DAY) / 1000,
  linkedAt: NOW,
  groupKind: MOCK_SEASON_GROUP.kind,
}

const MARKETS: Market[] = [
  // ── Active ────────────────────────────────────────────────
  makeMarket({
    id: 'btc',
    marketId: 0,
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'active',
    pool: 248_901,
    traders: 1204,
    startTime: NOW - 7 * DAY,
    endTime: NOW + 7 * DAY,
    completedCheckpoints: 168,
    history: generateHistory(NOW - 7 * DAY, 168, 65000),
    paths: generatePaths(NOW, 67000),
    group: MOCK_SEASON_GROUP,
    groupLink: MOCK_SEASON_LINK,
    groupKeyHash: MOCK_SEASON_GROUP.groupKeyHash,
    groupKind: MOCK_SEASON_GROUP.kind,
    timeframeSeconds: MOCK_SEASON_LINK.timeframeSeconds,
    seasonKey: `season:${MOCK_SEASON_GROUP.groupKeyHash}:${MOCK_SEASON_LINK.timeframeSeconds}`,
  }),
  // ── Sampling (wagers still accepted, checkpoints processing) ──
  makeMarket({
    id: 'eth',
    marketId: 1,
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    state: 'sampling',
    pool: 142_560,
    traders: 876,
    startTime: NOW - 4 * DAY,
    endTime: NOW + 3 * DAY,
    completedCheckpoints: 96,
    history: generateHistory(NOW - 4 * DAY, 96, 3500),
    paths: generatePaths(NOW, 3600),
  }),
  // ── Pending (paths locking, wagers not yet open) ──────────
  makeMarket({
    id: 'sol',
    marketId: 2,
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    state: 'pending',
    pool: 0,
    traders: 0,
    startTime: NOW + 6 * HOUR,
    endTime: NOW + 7 * DAY + 6 * HOUR,
    completedCheckpoints: 0,
    history: generateHistory(NOW - 1 * DAY, 24, 145),
    paths: [],
  }),
  // ── Settling (all checkpoints done, scoring paths) ────────
  makeMarket({
    id: 'btc-settling',
    marketId: 3,
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'settling',
    pool: 62_180,
    traders: 311,
    startTime: NOW - 7 * DAY,
    endTime: NOW - 30 * MINUTE,
    completedCheckpoints: 168,
    totalCheckpoints: 168,
    pathsScored: 3,
    history: generateHistory(NOW - 7 * DAY, 168, 64000),
    paths: generatePaths(NOW - 30 * MINUTE, 64500),
  }),
  // ── Maturing (dispute window open) ────────────────────────
  makeMarket({
    id: 'eth-maturing',
    marketId: 4,
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    state: 'maturing',
    pool: 38_420,
    traders: 184,
    startTime: NOW - 7 * DAY,
    endTime: NOW - 2 * HOUR,
    completedCheckpoints: 168,
    totalCheckpoints: 168,
    pathsScored: 5,
    history: generateHistory(NOW - 7 * DAY, 168, 3400),
    paths: generatePaths(NOW - 2 * HOUR, 3450),
  }),
  // ── Settled (claims open) ─────────────────────────────────
  makeMarket({
    id: 'sol-settled',
    marketId: 5,
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    state: 'settled',
    pool: 51_700,
    traders: 247,
    startTime: NOW - 14 * DAY,
    endTime: NOW - 7 * DAY,
    completedCheckpoints: 168,
    totalCheckpoints: 168,
    pathsScored: 5,
    history: generateHistory(NOW - 14 * DAY, 168, 140),
    paths: generatePaths(NOW - 7 * DAY, 145),
  }),
  // ── Void (emergency refund) ───────────────────────────────
  makeMarket({
    id: 'btc-void',
    marketId: 6,
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'void',
    pool: 12_340,
    traders: 58,
    startTime: NOW - 3 * DAY,
    endTime: NOW - 1 * DAY,
    completedCheckpoints: 42,
    totalCheckpoints: 168,
    pathsDissolved: 4,
    history: generateHistory(NOW - 3 * DAY, 42, 63000),
    paths: [],
  }),
  // ── Additional markets for pagination ────────────────────
  makeMarket({
    id: 'eth-active-2',
    marketId: 7,
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    state: 'active',
    pool: 89_200,
    traders: 421,
    startTime: NOW - 5 * DAY,
    endTime: NOW + 2 * DAY,
    completedCheckpoints: 120,
    history: generateHistory(NOW - 5 * DAY, 120, 3550),
    paths: generatePaths(NOW, 3600),
  }),
  makeMarket({
    id: 'sol-active',
    marketId: 8,
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    state: 'active',
    pool: 176_400,
    traders: 932,
    startTime: NOW - 3 * DAY,
    endTime: NOW + 4 * DAY,
    completedCheckpoints: 72,
    history: generateHistory(NOW - 3 * DAY, 72, 148),
    paths: generatePaths(NOW, 150),
  }),
  makeMarket({
    id: 'btc-sampling-2',
    marketId: 9,
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'sampling',
    pool: 310_000,
    traders: 1580,
    startTime: NOW - 6 * DAY,
    endTime: NOW + 1 * DAY,
    completedCheckpoints: 144,
    history: generateHistory(NOW - 6 * DAY, 144, 66000),
    paths: generatePaths(NOW, 66500),
  }),
  makeMarket({
    id: 'eth-pending',
    marketId: 10,
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    state: 'pending',
    pool: 0,
    traders: 0,
    startTime: NOW + 12 * HOUR,
    endTime: NOW + 7 * DAY + 12 * HOUR,
    completedCheckpoints: 0,
    history: generateHistory(NOW - 1 * DAY, 24, 3480),
    paths: [],
  }),
  makeMarket({
    id: 'sol-settling',
    marketId: 11,
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    state: 'settling',
    pool: 95_600,
    traders: 467,
    startTime: NOW - 7 * DAY,
    endTime: NOW - 1 * HOUR,
    completedCheckpoints: 168,
    totalCheckpoints: 168,
    pathsScored: 4,
    history: generateHistory(NOW - 7 * DAY, 168, 142),
    paths: generatePaths(NOW - 1 * HOUR, 144),
  }),
  makeMarket({
    id: 'btc-settled-2',
    marketId: 12,
    pair: 'BTC/USDC',
    base: 'BTC',
    quote: 'USDC',
    state: 'settled',
    pool: 220_100,
    traders: 1102,
    startTime: NOW - 14 * DAY,
    endTime: NOW - 7 * DAY,
    completedCheckpoints: 168,
    totalCheckpoints: 168,
    pathsScored: 5,
    history: generateHistory(NOW - 14 * DAY, 168, 62000),
    paths: generatePaths(NOW - 7 * DAY, 62500),
  }),
  makeMarket({
    id: 'eth-active-3',
    marketId: 13,
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    state: 'active',
    pool: 64_300,
    traders: 298,
    startTime: NOW - 2 * DAY,
    endTime: NOW + 5 * DAY,
    completedCheckpoints: 48,
    history: generateHistory(NOW - 2 * DAY, 48, 3620),
    paths: generatePaths(NOW, 3650),
  }),
  makeMarket({
    id: 'sol-maturing-2',
    marketId: 14,
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    state: 'maturing',
    pool: 47_800,
    traders: 215,
    startTime: NOW - 7 * DAY,
    endTime: NOW - 3 * HOUR,
    completedCheckpoints: 168,
    totalCheckpoints: 168,
    pathsScored: 5,
    history: generateHistory(NOW - 7 * DAY, 168, 146),
    paths: generatePaths(NOW - 3 * HOUR, 148),
  }),
]

/* ── Mock user positions ─────────────────────────────────────
 * Seeded on a few markets so the non-Active rail has something to render
 * until wallet + indexer integration lands. Path IDs come from
 * buildAiPathFixture (ai-ultra-bull, ai-bull, ai-neutral, ai-bear, ai-ultra-bear).
 * ───────────────────────────────────────────────────────────── */

// Position fixtures must reference real entries in MARKETS above. Use the
// route-slug for `marketId` (consumed by `getUserPosition(marketId)` to
// match against the URL param) and the on-chain numeric id for
// `marketIdNum` (consumed by transaction hooks to derive PDAs).
const USER_POSITIONS: UserPosition[] = [
  {
    id: '1-1',
    marketId: 'eth', // matches MARKETS[1] (id: 'eth', marketId: 1, state: sampling)
    marketIdNum: 1,
    marketState: 'sampling',
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    pathId: 'ai-bull',
    pathIndex: 1,
    pathLabel: formatAiPathLabel('bull'),
    pathTone: 'bull',
    collateral: 250,
    leverage: 1,
    exposure: 250,
    entryMultiplier: 1.85,
    entryTime: NOW - 2 * DAY,
    estimatedPayout: 462.5,
    dissolved: false,
    claimed: false,
  },
  {
    id: '4-2',
    marketId: 'eth-maturing', // matches MARKETS[4] (state: maturing)
    marketIdNum: 4,
    marketState: 'maturing',
    pair: 'ETH/USDC',
    base: 'ETH',
    quote: 'USDC',
    pathId: 'ai-neutral',
    pathIndex: 2,
    pathLabel: formatAiPathLabel('neutral'),
    pathTone: 'neutral',
    collateral: 100,
    leverage: 1,
    exposure: 100,
    entryMultiplier: 1.65,
    entryTime: NOW - 6 * DAY,
    estimatedPayout: 165,
    dissolved: false,
    claimed: false,
  },
  {
    id: '5-0',
    marketId: 'sol-settled', // matches MARKETS[5] (id: 'sol-settled', marketId: 5, state: settled)
    marketIdNum: 5,
    marketState: 'settled',
    pair: 'SOL/USDC',
    base: 'SOL',
    quote: 'USDC',
    pathId: 'ai-ultra-bull',
    pathIndex: 0,
    pathLabel: formatAiPathLabel('ultra-bull'),
    pathTone: 'ultra-bull',
    collateral: 50,
    leverage: 1,
    exposure: 50,
    entryMultiplier: 2.15,
    entryTime: NOW - 13 * DAY,
    estimatedPayout: 107.5,
    dissolved: false,
    claimed: false,
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

export async function getMarketPathPreviews(
  marketIds: readonly string[],
): Promise<Record<string, PredictionPath[]>> {
  const previews = Object.fromEntries(
    marketIds.map((id) => [id, MARKETS.find((m) => m.id === id)?.paths ?? []]),
  )
  return delay(previews)
}

export async function getMode2Readiness(): Promise<Mode2Readiness> {
  return delay({
    leverageEnabled: false,
    leverageConfig: null,
    pairRiskStates: [],
  })
}

export async function getUserPosition(
  marketId: string,
  // wallet pubkey is unused in mock mode; kept for signature parity with onchain.ts
  _wallet?: unknown,
): Promise<UserPosition | null> {
  return delay(USER_POSITIONS.find((p) => p.marketId === marketId) ?? null)
}

export async function getUserPositions(_wallet?: unknown): Promise<UserPosition[]> {
  return delay(USER_POSITIONS)
}

export async function getCurrentPrice(pair: string): Promise<CurrentPrice> {
  return delay({
    pair,
    value: 0,
    delta24hBps: 0,
    timestamp: Date.now(),
  })
}
