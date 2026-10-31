# Free price display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every price display in levx-fe works again without a Pyth key: a live line that advances every second from Coinbase trades kept on Pyth's level, chart history from the pipeline's candles endpoint, settled checkpoint dots and faded dissolved paths, a quiet Live/Delayed dot, and one switch (`APP_PRICE_SOURCE`) back to Pyth's own stream.

**Architecture:** A new source-neutral price layer in `src/lib/price/` owns one store (`src/stores/priceStore.ts`) and exposes `usePriceFeed`, `useLatestPrice`, `useFeedState` and `usePriceHistory`; the provider behind `usePriceFeed` is chosen once from `APP_PRICE_SOURCE`. The free provider combines a shared Coinbase websocket (trades and heartbeats) with a Solana account subscription to Pyth's sponsored push feed and multiplies the Coinbase price by a level factor measured at Pyth's publish time. History comes from the pipeline in both modes. Components never branch on the source.

**Tech Stack:** React 19, TypeScript (strict, `verbatimModuleSyntax`), Vite (`envPrefix: 'APP_'`), TanStack Query, Zustand, visx (the chart), `@solana/web3.js` `Connection` and Anchor 0.31 (`getReadOnlyProgram`), Vitest with jsdom and Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-31-free-price-display-design.md` (this branch, commit 3de00c0). The pipeline side is levx-infra plan `docs/superpowers/plans/2026-10-31-pipeline-candles-endpoint.md`; its route contract (Task 4 there) is consumed here verbatim.

## Global Constraints

- Order: this branch merges only after the pipeline's candles endpoint is deployed and answering (levx-infra plan), and with `APP_API_BASE_URL` set to the pipeline's public URL on the deployed frontend.
- Finalized markets show no checkpoint dots in this work: their sample accounts are closed at finalize and no other cheap source exists (spec §5.3, desirable only).
- No secret in the bundle: only `APP_` variables, all public.
- `APP_PRICE_SOURCE = free | pyth`, optional, default `free`; any other value throws at boot: `[env] APP_PRICE_SOURCE must be "free" or "pyth"`. `APP_HERMES_URL` becomes optional and is required only when the source is `pyth`: `[env] Required variable APP_HERMES_URL is missing (APP_PRICE_SOURCE=pyth)`.
- Modules must tolerate `env.APP_PRICE_SOURCE` being `undefined` (twelve test files mock `@/env/env.config` partially): read it through `priceSource()` (Task 1), which returns `'free'` unless the value is exactly `'pyth'`.
- No new dependencies. Use the browser's `WebSocket`, `Connection.onAccountChange` from the app's existing `@solana/web3.js`, and `apiFetch` (`src/api/client.ts`).
- Coinbase: `wss://ws-feed.exchange.coinbase.com`, subscribe `{"type":"subscribe","product_ids":[...],"channels":["matches","heartbeat"]}`. Trades arrive as `type` `"match"` (and one `"last_match"` right after subscribing) with string `price` and ISO `time`; `"heartbeat"` arrives about once a second per product even when nothing trades. Products: `SOL/USDC` → `SOL-USD`, `BTC/USDC` → `BTC-USD`, `ETH/USDC` → `ETH-USD`.
- Measured on 2026-10-31 (a Saturday): SOL-USD traded in 11 of 30 seconds. The line therefore **advances every second** with the latest price and changes level when trades happen; a quiet second is not "Delayed".
- Pyth's sponsored account: PDA of `[u16 LE shard 0, 32-byte feed id]` under `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`, owner `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`; accept only Full verification and the expected feed id. Decoder and address derivation are copied from levx-infra `keeper/src/sponsored-feed.ts` (lines 15-90), adapted to return numbers for the price.
- Thresholds (constants in `src/lib/price/leveling.ts`): `COINBASE_SILENT_MS = 5000`, `LEVEL_STALE_SEC = 180`, `TRADE_BUFFER_MS = 300_000`.
- Checkpoint convention (verified in LevXv2 `sample_and_dissolve.rs:128,361`): `completed_checkpoints` is incremented before a dissolve, so `path.dissolvedAtCheckpoint` is the dissolving checkpoint's 0-based index **plus one**; checkpoint `i` is due at `startTime + i × checkpointInterval × 1000`. Place dots at `PriceSample.timestamp × 1000`.
- History pages: `BARS_PER_PAGE = 500` (the endpoint's limit is 1000). Interval → resolution: `1m→'1'`, `5m→'5'`, `15m→'15'`, `1h→'60'`, `1d→'D'`.
- Hover copy (exact): live, leveled and fresh: `Live price from Coinbase trades, kept on Pyth's level. Markets settle on Pyth.` · level older than `LEVEL_STALE_SEC`: `Live price from Coinbase trades. Pyth's level last updated {n} min ago. Markets settle on Pyth.` · unleveled: `Live price from Coinbase trades. Pyth's level isn't available for this pair.` · pyth mode: `Live price from Pyth.` · delayed: `Price delayed: the live price stream isn't updating.`
- Conventions from `AGENTS.md`: `cn(...)` from `@/lib/cn` for 8+ utilities in the documented order; `@/` imports; tests in `__tests__/` beside the code; Prettier (no semicolons, single quotes, width 100).
- Commands (from the worktree root), with the CI's dummy env: `APP_HERMES_URL=https://hermes.invalid APP_RPC_URL=http://127.0.0.1:9 APP_NETWORK=devnet APP_PROGRAM_ID=LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV APP_SUPABASE_URL=http://127.0.0.1:9 APP_SUPABASE_ANON_KEY=x APP_USE_MOCK=true`. One file: `pnpm vitest run <path>`. All: `pnpm test:run`. Types: `pnpm types`. Lint: `pnpm lint`. Never run `pnpm install`; `node_modules` is linked from the main checkout by the controller.

## Review Focus

1. **A quiet market with a live stream:** heartbeats keep arriving, no trade for 20 seconds. The line keeps advancing each second at the last trade × k and the dot stays Live. Test in Task 3: `quiet market keeps advancing and stays live while heartbeats arrive`.
2. **A Pyth update before any trade is buffered** (page just opened): k comes from the 1-minute candle containing the publish time; if that fetch fails, k stays unset (unleveled) and is retried on the next Pyth update. Test in Task 3: `first level factor falls back to the minute candle, then to unleveled`.
3. **Many components on one feed** (the grid's cards plus a page): one Coinbase subscription per product and one account subscription per feed, released when the last user unmounts. Tests in Tasks 2 and 3: `refcounts subscriptions per product`, `one account subscription per feed across mounts`.
4. **A feed id with no Coinbase product** (the admin page's on-chain pair outside the three): no live price, no throw, no subscription. Test in Task 3: `unknown feed id subscribes to nothing`.
5. **History beyond the pipeline's cached window:** paging stops instead of looping. Test in Task 4: `stops paging at the cache window`.

---

### Task 1: Price store, types, source switch, env

**Files:**
- Create: `src/lib/price/types.ts`, `src/lib/price/source.ts`, `src/stores/priceStore.ts`
- Modify: `src/env/env.config.ts`, `src/stores/index.ts`, `.env.example` (the old `pythStore.ts` stays until Task 3 moves its last users)
- Test: `src/stores/__tests__/priceStore.test.ts`, `src/lib/pyth/__tests__/env.test.ts` (extend)

**Interfaces:**
- Produces:
  - `type PriceSource = 'free' | 'pyth'`; `function priceSource(): PriceSource` (in `source.ts`, reads `env.APP_PRICE_SOURCE` at call time).
  - `interface PriceTick { time: number /* ms */; value: number; publishTime: number /* s, dedup key */ }`
  - `interface FeedState { status: 'live' | 'delayed'; leveled: boolean; levelAgeSec: number | null }`
  - `usePriceStore` (zustand): `{ ticks: Record<string, PriceTick | undefined>; feeds: Record<string, FeedState | undefined>; levels: Record<string, number | undefined>; setTick(feedId: string, tick: PriceTick): void; setFeedState(feedId: string, s: FeedState): void; setLevel(feedId: string, k: number): void; getLatestTick(feedId: string): PriceTick | null }`. `setTick` drops a tick whose `publishTime` is not greater than the stored one (as `pythStore` does today).
  - `env.APP_PRICE_SOURCE: 'free' | 'pyth'`, `env.APP_HERMES_URL: string` (empty when unset in free mode).

- [ ] **Step 1: Write the failing tests**

```ts
// priceStore.test.ts
it('drops a tick that is not newer than the stored one')         // setTick twice with publishTime 10 then 10 → value of the first kept
it('stores feed state and level per feed id')
// env.test.ts (existing vi.stubEnv / vi.resetModules / dynamic import pattern)
it('defaults APP_PRICE_SOURCE to free and does not require APP_HERMES_URL')
it('requires APP_HERMES_URL when APP_PRICE_SOURCE is pyth')      // rejects.toThrow(/APP_HERMES_URL is missing \(APP_PRICE_SOURCE=pyth\)/)
it('rejects an unknown APP_PRICE_SOURCE')                        // rejects.toThrow(/must be "free" or "pyth"/)
// source.test.ts
it('priceSource is free when env.APP_PRICE_SOURCE is undefined')
```

- [ ] **Step 2: Run them to verify they fail.** `pnpm vitest run src/stores/__tests__/priceStore.test.ts src/lib/pyth/__tests__/env.test.ts src/lib/price/__tests__/source.test.ts`. Expected: FAIL (modules missing; env does not know the variable).
- [ ] **Step 3: Implement** the types, `priceSource()`, the store, the env changes (move `APP_HERMES_URL` off `requireEnv` and check it after reading `APP_PRICE_SOURCE`), the `stores/index.ts` re-export, and `.env.example` (`APP_PRICE_SOURCE=free` with a one-line comment; `APP_HERMES_URL` moved to the optional block).
- [ ] **Step 4: Run them, then the whole suite and the types.** `pnpm vitest run <the three files>` → PASS; `pnpm test:run` → green; `pnpm types` → clean.
- [ ] **Step 5: Commit** `git add <files> && git commit -m "price: a source-neutral price store and the APP_PRICE_SOURCE switch"`

### Task 2: The free provider's building blocks

**Files:**
- Create: `src/lib/price/pairs.ts`, `src/lib/price/coinbaseStream.ts`, `src/lib/price/sponsored.ts`, `src/lib/price/leveling.ts`
- Test: `src/lib/price/__tests__/{pairs,coinbaseStream,sponsored,leveling}.test.ts`

**Interfaces:**
- Consumes: `PYTH_FEED_IDS`, `SupportedPair` from `@/lib/pyth/feedIds`.
- Produces:
  - `pairs.ts`: `COINBASE_PRODUCTS: Record<SupportedPair, string>`; `pairForFeedId(feedId: string): SupportedPair | null` (case-insensitive, with or without `0x`).
  - `coinbaseStream.ts`: `type CoinbaseEvent = { kind: 'trade'; price: number; timeMs: number } | { kind: 'heartbeat'; timeMs: number }`; `function createCoinbaseStream(wsCtor?: typeof WebSocket): { subscribe(product: string, onEvent: (e: CoinbaseEvent) => void): () => void }`; `export const coinbaseStream` (lazy default instance). One socket for all products; subscribe/unsubscribe messages are sent when a product's first listener arrives or its last leaves; on close it reconnects with the existing Hermes hook's backoff (1 s doubling to 30 s, ±20% jitter) and re-subscribes every product that still has listeners.
  - `sponsored.ts`: `PYTH_PUSH_ORACLE_PROGRAM_ID`, `PYTH_RECEIVER_PROGRAM_ID` (`PublicKey`s); `sponsoredFeedAddress(feedIdHex: string, shard?: number): PublicKey`; `interface SponsoredUpdate { feedIdHex: string; price: number; publishTime: number; full: boolean }`; `decodePriceUpdateV2(data: Uint8Array): SponsoredUpdate | null` (null on a short or malformed buffer); `subscribeSponsored(connection: Connection, feedIdHex: string, on: { update(u: SponsoredUpdate): void; missing(): void }): () => void` — reads the account once with `getAccountInfo`, then `onAccountChange(address, cb, 'confirmed')`; calls `missing()` when the account is absent or its owner is not the receiver; ignores updates that are not Full or carry another feed id.
  - `leveling.ts`: the three threshold constants; `class TradeBuffer { push(timeMs: number, price: number): void; priceAt(timeMs: number): number | null; latest(): { timeMs: number; price: number } | null }` (keeps `TRADE_BUFFER_MS`); `levelFactor(pythPrice: number, coinbasePrice: number): number` (`pythPrice / coinbasePrice`); `candlePriceAt(candle: { time: number /* s */; open: number; close: number }, tSec: number): number` (`open + (close - open) × (tSec - time) / 60`).

- [ ] **Step 1: Write the failing tests** (a fake WebSocket class with `send` recorded, `onopen`/`onmessage`/`onclose` driven by the test; fixtures copied from the measured messages below)

```ts
// coinbaseStream.test.ts — fixtures:
// {"type":"match","price":"95.7","product_id":"SOL-USD","time":"2026-10-31T13:18:18.577625Z", ...}
// {"type":"heartbeat","product_id":"SOL-USD","time":"2026-10-31T13:18:14.000000Z", ...}
it('parses match and last_match as trades and heartbeat as liveness')   // price 95.7, timeMs Date.parse(time)
it('refcounts subscriptions per product')                            // two subscribers → one subscribe message; first unsubscribe sends none; last sends unsubscribe
it('reconnect resubscribes every product with listeners')
// sponsored.test.ts — a 134-byte Full fixture built in the test (feed id, price, expo -8, publish_time) as in the keeper's tests
it('derives the SOL/USD devnet address')                             // sponsoredFeedAddress(PYTH_FEED_IDS['SOL/USDC']).toBase58() === '7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE'
it('decodes a Full update into a scaled price and publish time')
it('returns null for a short buffer')
it('reports missing for an absent account or a foreign owner')       // fake Connection with getAccountInfo / onAccountChange
it('ignores a Partial update or another feed id')
// leveling.test.ts
it('priceAt returns the last trade at or before the time')
it('drops trades older than the buffer window')
it('levelFactor is a ratio')                                         // levelFactor(95.77, 95.70) ≈ 1.000731
it('candlePriceAt interpolates inside the minute')
// pairs.test.ts
it('maps feed ids to pairs with or without 0x, in any case')
```

- [ ] **Step 2: Run them to verify they fail.** `pnpm vitest run src/lib/price/__tests__`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the four modules. Copy the address derivation and the PriceUpdateV2 offsets from the keeper (Global Constraints); the price is `Number(price) × 10^exponent`.
- [ ] **Step 4: Run them.** Same command → PASS; `pnpm types` → clean.
- [ ] **Step 5: Commit** `git commit -m "price: Coinbase trade stream, Pyth sponsored account reader, level factor"`

### Task 3: The live feeds behind one hook, and every consumer moved to it

**Files:**
- Create: `src/lib/price/freeFeed.ts`, `src/lib/price/pythFeed.ts`, `src/lib/price/hooks.ts`, `src/lib/price/index.ts`
- Move: the Hermes hook body from `src/lib/pyth/hooks.ts` into `pythFeed.ts` (writing to `usePriceStore`); delete `src/lib/pyth/hooks.ts` and `src/stores/pythStore.ts`; move `src/lib/pyth/__tests__/usePythFeed.test.ts` → `src/lib/price/__tests__/pythFeed.test.ts` and `pythStore.test.ts` into Task 1's store test
- Modify: `src/routes/pages/MarketPage.tsx:52-53,310-313`, `src/routes/pages/MarketsPage.tsx:26-27,113-118`, `src/routes/pages/AdminPage.tsx:39,429-433`, `src/features/market/MarketCard.tsx:15-17,80`, `src/features/chart/LevXChart.tsx:15,203-204,910-911`, and the test mocks that name `@/lib/pyth/hooks` (`MarketCard.test.tsx`, `MarketPage.test.tsx`) or set `usePythStore` (`LevXChart.test.tsx`)
- Test: `src/lib/price/__tests__/freeFeed.test.ts`, `pythFeed.test.ts`, `hooks.test.ts`

**Interfaces:**
- Consumes: Task 1's store and `priceSource()`, Task 2's modules, `fetchCandles` from Task 4 for the minute-candle fallback (inject it: `useLeveledFeed` takes it through a module-level `setCandleFetcher` used by tests; Task 4 wires the real one — until then the fallback fetcher returns `null`).
- Produces (all exported from `@/lib/price`):
  - `usePriceFeed(feedId: string | null): void` — `priceSource() === 'pyth' ? usePythHermesFeed : useLeveledFeed`, chosen once at module load.
  - `useLatestPrice(feedId: string | null): PriceTick | null`; `useFeedState(feedId: string | null): FeedState | null`; `useLevel(feedId: string | null): number | null`.
  - `useLeveledFeed(feedId: string | null): void`: resolves the pair (`pairForFeedId`) and product; subscribes the Coinbase stream and the sponsored account (one account subscription per feed across mounts, refcounted in the module); pushes trades into a `TradeBuffer`; on each sponsored update sets `k = levelFactor(pyth, buffer.priceAt(publishTime × 1000) ?? candlePriceAt(minuteCandle, publishTime))`, keeping the previous k when neither price exists; every second (one `setInterval(…, 1000)` per feed) writes `{ time: s × 1000, value, publishTime: s }` and the feed state:

| Stream alive (an event within `COINBASE_SILENT_MS`) | Latest trade | k | value written | FeedState |
| --- | --- | --- | --- | --- |
| yes | yes | set | trade × k | live, leveled, levelAgeSec = now − last Pyth publish |
| yes | yes | unset (no sponsored account) | trade | live, leveled false |
| no | – | – | last Pyth price, if any; nothing if none | delayed |

  - `usePythHermesFeed(feedId)`: today's behaviour (Hermes stream, reconnect), writing ticks to `usePriceStore`, and feed state from tick age (live while the last tick is younger than `COINBASE_SILENT_MS`, `leveled: true`, `levelAgeSec: 0`).

- [ ] **Step 1: Write the failing tests** (fake timers; a fake coinbase stream and a fake `Connection` injected through module seams `__setCoinbaseStreamForTests` / `__setConnectionForTests`, mirroring `__resetPythClientForTests`)

```ts
it('writes trade × k each second once a Pyth update has set the level')     // trade 95.70, Pyth 95.77 at publish t → tick value ≈ 95.77
it('measures k at the Pyth publish time, not at the latest trade')         // trades 95.70 @t, 95.90 @t+20s; Pyth 95.77 @t → k = 95.77/95.70
it('quiet market keeps advancing and stays live while heartbeats arrive')    // 20 s of heartbeats only → 20 ticks, same value, status 'live'
it('falls back to the last Pyth price and delayed when the stream is silent') // no events for 6 s → value = Pyth price, status 'delayed'
it('first level factor falls back to the minute candle, then to unleveled')
it('a missing sponsored account leaves the feed unleveled')
it('one account subscription per feed across mounts')
it('unknown feed id subscribes to nothing')
it('usePriceFeed uses the Hermes feed when APP_PRICE_SOURCE is pyth')         // vi.stubEnv + resetModules
// pythFeed.test.ts: the existing usePythFeed tests, retargeted to usePriceStore
```

- [ ] **Step 2: Run them to verify they fail.** `pnpm vitest run src/lib/price/__tests__`. Expected: the new files FAIL.
- [ ] **Step 3: Implement** `freeFeed.ts`, `pythFeed.ts`, `hooks.ts`, `index.ts`; switch the consumers' imports and calls (`usePythFeed` → `usePriceFeed`, `useLatestPrice` from `@/lib/price`); update the three test files' mocks to `@/lib/price` and `usePriceStore`; delete the old hook and store.
- [ ] **Step 4: Run the suite and the types.** `pnpm test:run` → green; `pnpm types` → clean; `pnpm lint` → no new errors.
- [ ] **Step 5: Commit** `git commit -m "price: one live-price hook; the leveled Coinbase feed by default, Hermes behind APP_PRICE_SOURCE=pyth"`

### Task 4: History from the pipeline endpoint

**Files:**
- Create: `src/lib/price/candlesClient.ts`, `src/lib/price/usePriceHistory.ts`
- Delete: `src/lib/pyth/benchmarksClient.ts`, `src/lib/pyth/useBenchmarksHistory.ts`, their tests; `PYTH_BENCHMARK_SYMBOLS` and `benchmarkSymbolForPair` in `src/lib/pyth/feedIds.ts` (no other users)
- Modify: `MarketPage.tsx:54,317-333`, `AdminPage.tsx:40,442-452`, `MarketCard.tsx:18,81-84`, their tests' mocks, `src/lib/price/freeFeed.ts` (wire the real minute-candle fetcher)
- Test: `src/lib/price/__tests__/candlesClient.test.ts`, `usePriceHistory.test.tsx`

**Interfaces:**
- Consumes: the pipeline route contract (levx-infra plan, Task 4): `GET /api/v1/candles?pair&resolution&from&to` → `{ pair, resolution, source, sources, window: { from, to }, last_refresh, stale, rows: [{ time, open, high, low, close }] }`; 503 codes `candle_cache_disabled`, `candle_cache_warming`. `useLevel` from Task 3.
- Produces:
  - `type CandleResolution = '1' | '5' | '15' | '60' | 'D'`; `RESOLUTION_SECONDS: Record<CandleResolution, number>`; `interface CandlesResponse { … as the contract }`; `fetchCandles(args: { pair: string; resolution: CandleResolution; from: number; to: number }): Promise<CandlesResponse>` via `apiFetch` (the pair URL-encoded).
  - `usePriceHistory(args: { pair: string | null; interval: CandleInterval; toTime?: number }): UsePriceHistoryResult` — the same result shape as today's `useBenchmarksHistory` (`data, isLoading, isError, error, isSuccess, fetchStatus, isFetchingOlder, hasMoreHistory, fetchOlder`); `useInfiniteQuery` key `['price-history', pair, interval]`; pages `[to − BARS_PER_PAGE × step, to]`; next page param `undefined` when a page is empty or its `window.from` is later than the requested `from`; rows mapped to `{ time: time × 1000, value: close }`; in free mode, values multiplied by `useLevel(feedIdForPair(pair))` unless `sources` is exactly `['pyth']`; retries a 503 three times, five seconds apart.
  - `useLazyHistoryTrigger` moved here unchanged.

- [ ] **Step 1: Write the failing tests** (`vi.mock('@/api/client')` with a `mockApiFetch`, the existing `QueryClientProvider` wrapper)

```ts
it('builds the candles URL with an encoded pair')                    // '/api/v1/candles?pair=SOL%2FUSDC&resolution=5&from=…&to=…'
it('maps rows to close-price points in ms')
it('pages backwards 500 bars at a time')
it('stops paging at the cache window')                               // window.from > requested from → hasMoreHistory false, no further call
it('shifts history by the current level in free mode')               // level 1.0007 → value × 1.0007
it('does not shift Pyth-sourced history')                            // sources ['pyth'] → unshifted
it('retries a warming 503')
```

- [ ] **Step 2: Run them to verify they fail.** `pnpm vitest run src/lib/price/__tests__/candlesClient.test.ts src/lib/price/__tests__/usePriceHistory.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement**, switch the three consumers to `usePriceHistory` / `useLazyHistoryTrigger` from `@/lib/price`, wire `freeFeed`'s minute-candle fetcher to `fetchCandles` (resolution `'1'`, the minute containing the publish time), delete the Benchmarks client, hook, tests and symbols.
- [ ] **Step 4: Run the suite and the types.** `pnpm test:run` → green; `pnpm types` → clean.
- [ ] **Step 5: Commit** `git commit -m "price: chart history from the pipeline's candles endpoint; the retired Benchmarks client removed"`

### Task 5: Settled checkpoint dots and dissolved paths on the chart

**Files:**
- Create: `src/lib/api/checkpointPrices.ts`
- Modify: `src/features/chart/LevXChart.tsx` (props at :94; the path loop at :446-485; a dot layer after the historical line at :603-612), `src/routes/pages/MarketPage.tsx` (pass the prop)
- Test: `src/lib/api/__tests__/checkpointPrices.test.ts`, `src/features/chart/__tests__/LevXChart.test.tsx` (extend)

**Interfaces:**
- Consumes: `deriveSamplePda(marketId: number, checkpointIndex: number)` (`src/lib/solana/pda.ts:107`), `getReadOnlyProgram()` (`src/lib/solana/program.ts`), `SCALE` (`src/lib/constants.ts`), the market's numeric on-chain id (the value `getMarket` passes to `derivePathPda` in `src/lib/api/onchain.ts`).
- Produces:
  - `interface CheckpointPrice { index: number; time: number /* ms, PriceSample.timestamp × 1000 */; price: number }`
  - `fetchCheckpointPrices(marketId: number, completed: number): Promise<CheckpointPrice[]>` — `program.account.priceSample.fetchMultiple` over the PDAs for `0 … completed − 1`, closed accounts (null) skipped.
  - `useCheckpointPrices(marketId: number | null, completed: number): CheckpointPrice[]` — `useQuery` key `['checkpoint-prices', marketId, completed]`, enabled when `completed > 0` (the market query already refetches on `CheckpointSampled`, which changes `completed`).
  - `LevXChartProps.checkpointPrices?: CheckpointPrice[]`.
  - Chart rendering: a dot (radius 5, fill `var(--color-warning)` or the closest existing amber token, 2 px background-coloured stroke) at each `(time, price)`, a label `#{index + 1} · {formatPrice(price)}` at the top of the plot above its x; faint dashed guides at checkpoint times not yet sampled, the next one labelled `in {m} m`; for each AI path with `dissolved`, only the part up to `marketStart + (dissolvedAtCheckpoint − 1) × checkpointInterval × 1000` is drawn, dashed at opacity 0.35, with a `×` at the cut; the dot layer has `pointerEvents="none"`.

- [ ] **Step 1: Write the failing tests**

```ts
// checkpointPrices.test.ts — a fake program whose account.priceSample.fetchMultiple returns [sample0, null, sample2]
it('converts samples to ms and scaled prices and skips closed accounts')   // price 95_410_000n / SCALE → 95.41
// LevXChart.test.tsx (existing ParentSize mock)
it('draws one dot and label per settled checkpoint')                        // getAllByTestId('checkpoint-dot').length === 2; text '#1 · 95.41'
it('cuts a dissolved path at its dissolving checkpoint')                     // dissolvedAtCheckpoint 3 → the drawn path ends at x(start + 2 × interval)
it('labels the next unsampled checkpoint with its countdown')
```

- [ ] **Step 2: Run them to verify they fail.** `pnpm vitest run src/lib/api/__tests__/checkpointPrices.test.ts src/features/chart/__tests__/LevXChart.test.tsx`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement** the module and hook, the chart prop and layers (`data-testid="checkpoint-dot"` on the dots), and pass `checkpointPrices={useCheckpointPrices(<market id>, market.completedCheckpoints)}` from `MarketPage`.
- [ ] **Step 4: Run the suite and the types.** `pnpm test:run` → green; `pnpm types` → clean.
- [ ] **Step 5: Commit** `git commit -m "chart: settled checkpoint prices and dissolved paths"`

### Task 6: The quiet header dot, change since start, docs

**Files:**
- Create: `src/features/market/LivePriceDot.tsx`, `src/lib/price/change.ts`
- Modify: `src/routes/pages/MarketPage.tsx` (header around :714-727), `src/features/market/MarketCard.tsx` (use `changeSinceStart` in place of its local `calculatePctChange`), `README.md` (env table: `APP_PRICE_SOURCE`, `APP_HERMES_URL` now conditional; one paragraph on the two modes and the revert table from the spec §6)
- Test: `src/features/market/__tests__/LivePriceDot.test.tsx`, `src/lib/price/__tests__/change.test.ts`, `src/routes/pages/__tests__/MarketPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `useFeedState`, `priceSource()`, `CheckpointPrice` (Task 5).
- Produces:
  - `LivePriceDot({ feedId }: { feedId: string | null })` — a small dot and the word `Live` (green token) or `Delayed` (amber token); the `title` is the Global Constraints hover copy for the current state (`{n}` = `Math.floor(levelAgeSec / 60)`); renders nothing for a null feed id or no state yet.
  - `changeSinceStart(args: { history: PricePoint[]; marketStart: number; checkpoint0Price?: number; current: number }): { value: number; isPositive: boolean }` — baseline is `checkpoint0Price` when given, else the history point nearest `marketStart` (MarketCard's current rule).

- [ ] **Step 1: Write the failing tests**

```ts
it('shows Live with the leveled hover copy')
it('shows the level age in minutes when the level is old')
it('shows the unleveled copy for a pair without a sponsored account')
it('shows Delayed with its copy')
it('shows the Pyth copy in pyth mode')
it('uses checkpoint 0 as the baseline when it exists')
it('falls back to the history at the market start')
it('market page header shows the price, the change since start and the dot')
```

- [ ] **Step 2: Run them to verify they fail.** `pnpm vitest run src/features/market/__tests__/LivePriceDot.test.tsx src/lib/price/__tests__/change.test.ts src/routes/pages/__tests__/MarketPage.test.tsx`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement** the component, the helper, the header (pair · state badge · price · change · dot, following `AGENTS.md`'s `cn` rule), MarketCard's switch to the helper, the README section.
- [ ] **Step 4: Run everything.** `pnpm test:run` → green; `pnpm types` → clean; `pnpm lint` → no new errors; `pnpm build` → succeeds.
- [ ] **Step 5: Commit** `git commit -m "market page: the quiet Live/Delayed dot and the change since start; README for the two price sources"`

## Verification after merge (controller, not a task)

On the devnet frontend with the pipeline endpoint live: on a live market the line advances every second and its level changes with trades; each settled dot sits within a few bps of the line at its time; all five ranges load; closing the Coinbase socket (devtools: offline) turns the dot to Delayed and the line to the last Pyth price; a local build with `APP_PRICE_SOURCE=pyth` runs the Hermes provider (it answers 401 today, as expected; the unit tests prove the path).
