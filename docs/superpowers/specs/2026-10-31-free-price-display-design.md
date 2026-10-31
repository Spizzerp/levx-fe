# Free price display for the frontend (the free oracle path, step 6)

Date: 2026-10-31. Owner decisions are marked **(owner)**; calls made while writing this are marked **(my call)** for the owner to check.

Related: levx-infra `docs/superpowers/specs/2026-10-30-free-oracle-path-design.md` (§8 step 6 left the frontend for a separate design); levx-infra
PRs #104 (pipeline exchange candles), #105 and #106/#107/#108 (keepers read Pyth's sponsored push feed).

## 1. Why

On 2026-10-29 Pyth's Pro trial key expired, and the free Pyth services the frontend used are gone. Probed on 2026-10-31 without a key:

| What the frontend calls | For | Answer |
| --- | --- | --- |
| `https://hermes.pyth.network` price stream (`src/lib/pyth/client.ts`, `hooks.ts`) | the live price everywhere | HTTP 401 |
| `https://benchmarks.pyth.network/v1/shims/tradingview/history` (`benchmarksClient.ts`) | chart and card history | HTTP 404 (retired) |

So every price display in the app is broken: the market page chart and its live edge, the market cards (price, change since start, the
small price line), and the admin page's market-creation preview. The backend already moved to free sources: the pipeline builds paths from
Coinbase candles (5-minute candles over 30 days for an hourly market; Binance.US behind it, no key), and both keepers sample Pyth's
**sponsored push feed**, an on-chain Solana
account Pyth's own pusher writes once a minute (devnet; it was every 30 s until 2026-10-29). Markets settle on that account's price.

**The moment this design serves (owner):** a user opens the market page during a live market and watches the price line move through the
AI paths, to see which path tracks closest as the checkpoints pass.

## 2. Goals

1. On the market page the live line **steps every second (owner)**, and sits on **Pyth's level**: its second-by-second movement comes
   from Coinbase's public trade stream, and its level is kept on Pyth's price by the sponsored account **(owner)**.
2. History behind the chart works for all five ranges of the existing time-range picker (`TimeRangePicker`: 1m, 5m, 15m, 1h, 1d), and
   joins the live line without a visible step.
3. Each passed checkpoint shows the **exact price the market settled on**, read from chain, as a dot on the chart with its number and
   value; paths that dissolved stay visible, faded, ending at the checkpoint that dissolved them **(my call, accepted in the mockup
   review)**. The mockup is `.superpowers/brainstorm/9257-1793450009/content/market-page-live.html` in the main checkout (not committed).
4. The header is the **quiet** one **(owner, option A)**: pair, current price, change since the market started, and a "Live" dot. Hovering
   the dot explains the source in one or two short sentences (Coinbase trades, kept on Pyth's level; markets settle on Pyth).
5. The market cards and the admin page show the same leveled live price and the same history.
6. **Reverting to Pyth-only is a configuration change, not a code restore (owner).** When the project gets Pyth access or pays for it,
   one switch puts the whole frontend back on Pyth's own live stream and history (§6).

## 3. Non-goals and anti-goals

Not in this work: anchoring the pipeline's generated paths to Pyth's level (decided for after the K3 run); buying or integrating Pyth Pro
beyond keeping the Pyth path intact behind the switch; any keeper or on-chain program change; mainnet launch work (the design should carry
over: Coinbase and Pyth's sponsored feeds exist on mainnet, but the mainnet sponsored account for each pair must be confirmed before launch).

Failure even if it technically works (anti-goals):
- the live line visibly disagrees with a settled checkpoint dot (more than a few bps at the dot's time);
- a frozen price shown with no indication that it is delayed;
- any secret in the browser bundle (every `APP_` variable ships to the browser);
- the Pyth live path deleted or left untested, so "revert" would mean digging it out of git history;
- frontend traffic disturbing the K3 measurement: no visitor request may cause an upstream request from the pipeline (§5.2), because a
  rate-limited Coinbase call at generation time would silently move a market's history to Binance.US inside a preregistered comparison.

## 4. Constraints and facts the builder needs

- **Frontend stack:** React 19, Vite, Tailwind v4, TanStack Router/Query, Zustand; Vitest. Follow `levx-fe/AGENTS.md` (e.g. `cn(...)` for
  8+ utility classes with the documented class order). `envPrefix` is `APP_`.
- **The current price layer is small and has one seam to keep:** `src/lib/pyth/` (`client.ts` Hermes client, `hooks.ts` with
  `usePythFeed(feedId)` and `useLatestPrice(feedId)`, `feedIds.ts` pair → feed id and benchmark symbol, `benchmarksClient.ts` and
  `useBenchmarksHistory.ts` for paged history, `types.ts` `PythTick { time ms, value, publishTime s }`) and `src/stores/pythStore.ts`
  (ticks keyed by feed id). Consumers: `routes/pages/MarketPage.tsx`, `MarketsPage.tsx`, `AdminPage.tsx`, `features/market/MarketCard.tsx`,
  `features/chart/LevXChart.tsx`. Components should not learn which source is active.
- **Pairs:** the code is wired for SOL, BTC and ETH against USD (feed ids in `feedIds.ts`; the pipeline's `PAIR_PRODUCTS` maps
  `SOL/USDC` → Coinbase `SOL-USD`, Binance.US `SOLUSD`, and likewise BTC, ETH). Only SOL/USD is live on devnet. Only SOL/USD's sponsored
  account is verified on devnet; BTC/USD and ETH/USD sponsored accounts on devnet are unverified.
- **Pyth's sponsored push feed:** account address = PDA of `[u16 LE shard 0, 32-byte feed id]` under the push oracle program
  `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`; owner the Pyth Receiver `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`. SOL/USD on devnet is
  `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE`. Layout (`PriceUpdateV2`, 134 bytes): discriminator 8, write authority 8–40, verification
  byte at 40 (1 = Full, message at 41; 0 = Partial, num_sigs at 41, message at 42); in the message: feed id +0 (32 bytes), price i64 +32,
  conf u64 +40, exponent i32 +48, publish_time i64 +52, posted_slot u64 +84. A tested TypeScript decoder exists in levx-infra
  `keeper/src/sponsored-feed.ts` (`sponsoredFeedAddress`, `decodePriceUpdateV2`); copy it, do not import across repos. Writes land 6–12 s
  after their publish time.
- **Solana access from the browser:** `APP_RPC_URL` (a paid Helius plan since 2026-10-31). The app has no account subscription today.
  One websocket account subscription per pair on screen is the expected load.
- **Coinbase's public market data:** websocket `wss://ws-feed.exchange.coinbase.com` (public channels need no key; products `SOL-USD`,
  `BTC-USD`, `ETH-USD`). One shared socket can carry every product on screen. Server-side requests to Coinbase's REST API need a
  `User-Agent` header (403 without one); browsers send one.
- **On-chain checkpoint prices:** Mode 1 writes one `PriceSample` account per checkpoint (PDA `["sample", market_id, checkpoint_index]`;
  fields include `price`, `confidence`, `timestamp`) and emits `CheckpointSampled { market_id, checkpoint_index, price, confidence,
  low_confidence }`. The keeper closes the sample accounts at finalize (about ten minutes after the last checkpoint), emitting
  `PriceSampleClosed`. `PriceSample.timestamp` is the Pyth update's `publish_time` (set in LevXv2 `sample_price.rs`), and `price` has six
  decimals. The frontend already has the helpers: `deriveSamplePda`, a program event stream that decodes `CheckpointSampled` from logs,
  and `apiFetch` for the pipeline API; the data model already carries a dissolved state for paths (`src/types/market.ts`,
  `UserPositionCard.tsx`). Supabase stores nothing about checkpoints.
- **The pipeline's candle client today** (levx-infra `pipeline/src/levx_pipeline/integrations/exchange_candles.py`): resolutions 5, 15,
  60, 240 minutes and daily, no 1-minute; Coinbase pages hold 300 rows; a page gets one retry on a 429, then the chain moves on to
  Binance.US. The generation's resolution map sends a market under a day to 5-minute candles. Cut the pipeline branch from levx-infra
  `origin/main` (the local main checkout is stale).
- **The Benchmarks history route is retired for everyone,** not only without a key; Pyth's history is now Pyth Pro's keyed route, which a
  browser cannot call without exposing the key.
- **Pipeline deploys:** the pipeline's Railway service has no watch pattern, so every merge to levx-infra `main` redeploys it, and changes
  under `pipeline/src/**` also rebuild the Mode 1 keeper. The K3 measurement is running on devnet until about market 185: merge the pipeline
  PR only in a quiet window (after an hour's T−5 menu at about :56, before the next creation at :25), and confirm the keeper's restart is
  harmless at that moment (no checkpoint due).
- **Pipeline API:** public FastAPI app (`pipeline/src/levx_pipeline/main.py`), CORS from `PIPELINE_CORS_ORIGINS`; the frontend reaches it at
  `APP_API_BASE_URL`. There is no general rate limiter on public routes.

## 5. How it works

### 5.1 The live line (owner's decision, details my call)

- Subscribe to Coinbase's trade stream for the pair's product. The displayed line takes **one step per second**: the last trade price in
  each second (no step in a second with no trade).
- Subscribe to the pair's sponsored account. On each update (about once a minute), compute the **level factor** `k = pyth_price /
  coinbase_price_at(publish_time)`, a ratio, not a difference **(my call)**, where `coinbase_price_at(t)` is the last Coinbase trade at or
  before `t` taken from a short ring buffer of recent trades (a few minutes) **(my call: measuring both prices at Pyth's publish time keeps
  the minute's own movement out of the factor)**. If the buffer does not reach back to `publish_time` (page just opened), use the
  pipeline's one-minute candle containing it.
- Displayed price = Coinbase price × the latest `k`. Between Pyth updates `k` is constant. Measured basis on 2026-10-30/31: Pyth above
  Coinbase in 21 of 21 observations, median +7.2 bps, range +4.3 to +11.1, drifting a few bps over hours.
- Accept only a sponsored update that is Full and carries the pair's feed id (as the keepers do); otherwise keep the previous `k`.

### 5.2 History (my call)

- A new read-only pipeline endpoint serves candles from the same chain the pipeline uses to build paths (Pyth history when the pipeline has
  a key, else Coinbase, then Binance.US). Proposed shape: `GET /api/v1/candles?pair=SOL/USDC&resolution=1|5|15|60|D&from=<unix
  s>&to=<unix s>` returning ascending rows `{time, open, high, low, close}` and the `source` label.
- **Add a 1-minute resolution to the candle client (my call):** Coinbase serves 60 s natively; Binance.US needs its `1m` interval. The
  generation's resolution map does not change, so paths are still built from 5-minute candles; the chart's 1m range shows finer bars from
  the same source.
- **No visitor request reaches upstream (my call, from the K3 anti-goal):** the endpoint answers only from an in-memory cache. A background
  refresher fills it at a fixed rate that does not depend on traffic: once at boot it backfills a window per resolution (starting values:
  1m one day, 5m and 15m 30 days, 1h 90 days, 1d one year), paced (for example one upstream page every two seconds), then it refreshes
  the newest bucket of each resolution about once a minute. Per pair that is about 50 pages at boot and about 5 calls a minute after,
  far under Coinbase's public limits and independent of how many browsers are open. A request beyond the cached window gets what the
  cache holds and the window's bounds in the response. A provider failure keeps the last good cache and says so in the response, never a
  silently partial series.
- **CORS (my call):** the candles route answers with `Access-Control-Allow-Origin: *`, since it is public read-only data; the app-wide
  `PIPELINE_CORS_ORIGINS` list does not change. Production, preview deployments and `localhost:3030` all work.
- The frontend's history hook pages through this endpoint instead of the Benchmarks route. In the free mode the history is shifted by the
  current `k`, so the stretch before the user arrived and the live line join without a step **(my call; accepted cost: history drawn
  on today's basis, a few bps off for older candles)**. When the endpoint's `source` is `pyth`, the history is already on Pyth's level and
  is not shifted.
- Opening the page mid-market: the stretch from the market's start to now is drawn from one-minute candles; only the part since the page
  opened steps every second. Acceptable **(my call, stated in the brainstorm without objection)**.

### 5.3 Checkpoint dots and dissolved paths (my call, accepted in the mockup)

- For each passed checkpoint, a dot at the on-chain settled price with a small label (`#n · price`), placed at the sample's `timestamp`;
  future checkpoints as faint vertical guides with the next one's countdown. While the market is live, read the `PriceSample` accounts
  (or the `CheckpointSampled` events). After finalize the accounts are closed and Supabase holds nothing about checkpoints, so finalized
  markets' dots would need the `CheckpointSampled` events from transaction history. Required: live markets. Desirable: finalized
  markets (left to the builder, §8).
- The header's "change since start" uses checkpoint 0's settled price when it exists, else the history at the market's start.
- Dissolved paths stay drawn, faded and dashed, ending at the checkpoint that dissolved them.

### 5.4 Failure states (my call)

| Condition | Line | Header dot |
| --- | --- | --- |
| Coinbase stream down or silent for more than about 5 s | holds at the last displayed price, then shows the last Pyth price | "Delayed" (hover says why) |
| Sponsored account stale (no update for more than about 3 minutes) | keeps moving on the last `k` | stays "Live"; hover says the Pyth level is old |
| Both down | frozen | "Delayed" |
| Recovery | resumes; `k` re-measured on the next Pyth update | "Live" |

The thresholds are starting values for the builder to tune. A pair with no verified sponsored account shows Coinbase's price unleveled,
and the hover says so.

### 5.5 The other pages

- **Market cards** use the same leveled live price and the endpoint's one-hour history; all cards share one Coinbase socket and one
  subscription per pair.
- **Admin page** (market creation) shows the selected pair's leveled live price and history; it reads pairs from on-chain
  `supportedPairs`, as now.

## 6. The revert switch (owner requirement)

- `APP_PRICE_SOURCE = free | pyth`, default `free`. The price layer exposes one interface (latest tick per pair, the tick stream, paged
  history); two providers sit behind it. Components, the store and the chart never branch on the source.
- **The two modes differ only in the live stream (my call).** `pyth` mode uses the Hermes stream for live ticks (`APP_HERMES_URL`); its
  code stays in the tree and keeps its tests green. `free` mode uses the leveled Coinbase stream; `APP_HERMES_URL` is optional there.
  Leveling is not used in `pyth` mode (the stream is Pyth's own price); the checkpoint dots come from chain in both modes.
- **One history provider in both modes: the pipeline endpoint (my call).** Once the pipeline has a Pyth key again, its chain starts at
  Pyth, so the endpoint serves Pyth history with no frontend change. The Benchmarks client and its hook (`benchmarksClient.ts`,
  `useBenchmarksHistory.ts`'s fetch path) are removed: that route is retired for everyone, so keeping it would keep dead code, not a
  working revert.
- **Key caveat:** a browser bundle cannot hold a secret. If Pyth's paid access is a secret key, `pyth` mode's live stream needs a small
  relay on the pipeline that holds the key and re-streams to browsers; `APP_HERMES_URL` then points at the relay. The relay is out of scope
  until the paid plan's terms are known; the switch must not preclude it.
- The whole system's revert, for the record:

| Service | Back to Pyth |
| --- | --- |
| pipeline | set `PYTH_HERMES_API_KEY` (the history chain starts at Pyth) |
| Mode 1 keeper | `PRICE_SOURCE=hermes` plus the key |
| keeper-mode2 and lp | `PRICE_SOURCE=hermes` plus the key |
| frontend | `APP_PRICE_SOURCE=pyth` (plus `APP_HERMES_URL` at a relay, if needed), rebuild |

## 7. Delivery

Two pull requests, in this order:
1. **levx-infra:** the 1-minute resolution in the candle client, the cache and its fixed-rate refresher, and the candles endpoint (§5.2),
   with tests (including: no request path calls upstream; the refresher's rate is fixed; a 1-minute window pages correctly on both
   providers); merged in a K3 quiet window (§4).
2. **levx-fe:** the price layer's provider split and the switch (§6), the free provider (§5.1, §5.2), the checkpoint dots and dissolved
   paths (§5.3), the failure states (§5.4), the quiet header, the cards and the admin page (§5.5). Vitest coverage at least for: the level
   factor and its timing (publish-time lookup in the ring buffer, the candle fallback), the one-step-per-second throttle, the history shift,
   each failure state, the PriceUpdateV2 decode (Full only, feed id check), and the switch selecting each provider. Existing Pyth-path tests
   stay green.

Verification on devnet: on a live market page the line steps every second; each settled dot sits within a few bps of the line at its time;
all five ranges load; killing the Coinbase socket shows "Delayed"; a local build with `APP_PRICE_SOURCE=pyth` runs the Pyth provider (its
calls answer 401 today, which is expected; its unit tests prove the path is intact).

## 8. Left to the builder

The WebSocket client (native is fine), the PDA derivation library already in the app, ring-buffer and cache sizes, exact hover copy within
the quiet style, how the history hook's paging maps onto the endpoint's window, whether the store keeps the `PythTick` name or becomes a
source-neutral `PriceTick`, and the source for finalized markets' checkpoint dots (§5.3).
