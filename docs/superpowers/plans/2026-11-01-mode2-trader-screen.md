# Mode 2 Trader Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traders open Mode 2 leverage positions (1 to 4 paths, 0.1× steps) from the market page before the start, and follow them in a position card until they are paid, behind the `APP_MODE2_TRADING` switch.

**Architecture:** A new feature folder `src/features/mode2/` holds pure modules (reader, ladder, breakdown, entry window, pre-check, admission builder, status), React Query hooks and three components. The data comes from the custody program through `@spizzerp/levx-mode2-client` 0.5.0 decoders over the app's web3.js `Connection`; the transaction is one `admit_batch` built with the client's `admitBatchIx`, converted to web3.js and sent with the wallet as fee payer and only owner. `MarketPage.tsx` only switches between today's rail and the new pieces.

**Tech Stack:** React 19, TanStack Query 5, @solana/web3.js 1.98 + wallet-adapter, `@spizzerp/levx-mode2-client` 0.5.0 (@solana/kit 8.4), Vitest 4 + Testing Library, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-11-01-mode2-trader-screen-design.md` (owner decisions T1–T13). The running estimate (§6.3) is NOT in this plan: it is `docs/superpowers/plans/2026-11-01-mode2-estimate.md`, after LevXv2's scorer package ships.

## Global Constraints

- Dependencies, exact: `"@spizzerp/levx-mode2-client": "0.5.0"`, `"@solana/kit": "~8.4.0"` (the keeper's pins). Registry `@spizzerp:registry=https://npm.pkg.github.com`.
- `APP_MODE2_TRADING` (boolean, `'true'` turns it on). Off: the market page renders exactly as on main, legacy readiness card included (spec §4.6).
- Every max win, fee, payout and reserve number comes from the client: `quantitiesAt`, `payoffAt`, `groupBook`, `bookAfter`, `reserveFor`, `leU128`. Never re-derive the payoff in levx-fe.
- Units: on-chain amounts are micro-USDC `bigint` everywhere in `src/features/mode2/`; convert to display strings only in components. Leverage on screen has one decimal; slider values are `tenths / 10` computed one way only (`ladderValues`), so `SegmentedSlider`'s strict equality holds.
- Principal moves in steps of 10 USDC (owner); max loss is the principal; the fee is "taken from the payout" (spec §4.4).
- Copy, verbatim: "Leverage open", "closes in", "Leverage opens when the paths arrive, about 3 minutes before the start", "Leverage closed at the start", "Leverage", "Principal", "Principal per path", "In steps of 10 USDC", "Not available with leverage", "Made of", "Value with leverage", "Max win", "Fee (taken from the payout)", "Max loss", "Total principal", "Total value with leverage", "Total max win", "Total fee", "Total max loss", button "Open Position at {L}×" / "Open {n} Positions at {L}×", card header "Leveraged positions", chips "Waiting for the start", "Running · checkpoint {j} of {T}", "Result in", "Paid", "Voided", "Estimate from checkpoint 4", "Paid to your wallet automatically after the review period", "Paid to your wallet", "Refunded to your wallet", rent line "A small SOL deposit opens your position record; it comes back when you are paid".
- Code style: Prettier (no semicolons, single quotes, width 100); `import type` for types; named exports; components and hooks in separate files (react-refresh); `cn(...)` with AGENTS.md ordering for 8+ classes; desktop-first `md:` variants.
- Tests: Vitest; query by role and accessible name, never `data-testid` or DOM order (global CLAUDE.md). Pure modules use `// @vitest-environment node`. Run single files with `pnpm vitest run <path>`; the whole suite with `pnpm test:run`; types with `pnpm types`.
- Test env for every run: `APP_RPC_URL=http://127.0.0.1:9 APP_NETWORK=devnet APP_PROGRAM_ID=LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV APP_HERMES_URL=https://hermes.invalid APP_SUPABASE_URL=http://127.0.0.1:9 APP_SUPABASE_ANON_KEY=x APP_USE_MOCK=true`.
- Implementer subagents never run `pnpm install`/`pnpm add`, never run scripts against a cluster, never sign or send transactions, never push. Steps marked **Controller** are run by the controller only, and devnet writes only on the owner's word in that turn.
- Git: work on branch `feat/mode2-trader-screen` in a worktree; commit per task; stage explicit paths; no attribution lines.

## Review Focus

1. **The group fills between the pre-check and the signature** (another trader takes the last positions): the trader sees "That leverage step just filled up" and the panel refreshes its data — pinned in Task 5 (`describeMode2Error` for 6005 and the mutation's `onError` invalidation).
2. **Principal input that is not a clean amount** (`"abc"`, `"-10"`, `"1e3"`, `"25"`, empty, more than the balance): it rounds down to the 10 USDC step on blur, never sends a zero-unit order, and the balance check names the shortfall — pinned in Task 8.
3. **A selected path outside the Mode 2 cohort** (user-drawn, third-party, or beyond `k`): it is listed as "Not available with leverage", left out of the order, and the button counts only cohort paths — pinned in Task 8.
4. **An offer expiring before the start, or one step filling while others have room**: only that step's ticks disable and the thumb moves to the nearest enabled value — pinned in Tasks 4 and 8.
5. **The wallet switches accounts while the panel is open**: the receipt and history shown belong to the new owner (queries keyed by owner) — pinned in Tasks 2 and 9.

---

### Task 1: Package, registry and the switch

**Files:**
- Create: `.npmrc`
- Modify: `package.json`, `pnpm-lock.yaml` (Controller), `.github/workflows/ci.yml`, `src/env/env.config.ts:25-58`, `.env.example`, `src/routes/pages/__tests__/MarketPage.test.tsx:10-22` (env mock literal)
- Test: `src/env/__tests__/mode2Switch.test.ts`, `src/features/mode2/__tests__/client.smoke.test.ts`

**Interfaces:**
- Produces: `env.APP_MODE2_TRADING: boolean` on `AppEnv`; the client package importable from `@spizzerp/levx-mode2-client`.

- [ ] **Step 1 (Controller, needs the owner's read:packages token in `NODE_AUTH_TOKEN`): add the registry and the dependencies**

`.npmrc`:
```
@spizzerp:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```
Run: `pnpm add @spizzerp/levx-mode2-client@0.5.0 @solana/kit@~8.4.0 --save-exact` then fix `@solana/kit` back to `~8.4.0` in package.json and `pnpm install`.
Expected: `package.json` lists `"@spizzerp/levx-mode2-client": "0.5.0"` and `"@solana/kit": "~8.4.0"`; lockfile updated; `pnpm install --frozen-lockfile` passes. Also confirm that without `NODE_AUTH_TOKEN` pnpm fails with a 401/env error naming the registry (record the message in the ledger for the owner's Vercel step).

- [ ] **Step 2: CI reads the package**

In `.github/workflows/ci.yml`, give the workflow `permissions: { contents: read, packages: read }` and the install step `env: NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. (Owner step, recorded in the PR description: grant levx-fe read access in the package's "Manage Actions access", and set `NODE_AUTH_TOKEN` on Vercel to a read:packages token.)

- [ ] **Step 3: Write the failing tests**

`src/env/__tests__/mode2Switch.test.ts` (pattern of `src/lib/pyth/__tests__/env.test.ts`: `vi.stubEnv`, `vi.resetModules()`, dynamic import of `@/env/env.config`):
- `it('is off when APP_MODE2_TRADING is unset')` → `env.APP_MODE2_TRADING === false`
- `it('is on only for the string true')` → `'true'` gives `true`; `'1'` and `'TRUE'` give `false`

`src/features/mode2/__tests__/client.smoke.test.ts` (`// @vitest-environment node`), values read from devnet on 2026-11-01:
```ts
it('derives the market 142 accounts', () => {
  const market = mode1MarketPda(142n)
  expect(market).toBe('CiAyUNKxoSHZXDBZfsMR7CurJaCqAo4cZhUyhASvbDpD')
  expect(cohortPda(market)).toBe('F6xAsG4C9hY29fST9ieisYojjFp9DN81oxmYUufEcNVA')
  expect(epochPda(61n)).toBe('9Loa8VpSkJdm55EhmsbrHHR33H1LZ3DhJ2B3HbaRuK4S')
})
it('derives group 0 of the market 142 cohort', () => {
  expect(groupPda('F6xAsG4C9hY29fST9ieisYojjFp9DN81oxmYUufEcNVA' as Address, 0)).toBe('9g2gbU2QWmG42Sn8dZ2zFN6bVuZNpmoBjGBAWPw3SUmn')
})
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm vitest run src/env/__tests__/mode2Switch.test.ts src/features/mode2/__tests__/client.smoke.test.ts`
Expected: the switch test FAILS (`APP_MODE2_TRADING` undefined). The smoke test checks the install of Step 1 rather than new code, so it PASSES here — if it fails on the group address only, the group index of that cohort was not 0: record the derived value in the ledger and keep the three other assertions.

- [ ] **Step 5: Add `APP_MODE2_TRADING` to `AppEnv` and `env`** with the existing boolean pattern `(import.meta.env.APP_MODE2_TRADING ?? 'false') === 'true'`; add `APP_MODE2_TRADING=false` under "# Optional" in `.env.example` with the comment `# Mode 2 trader screen (leverage); keep false in production until the devnet proof passes`; add `APP_MODE2_TRADING: false` to the `env` literal mocked in `MarketPage.test.tsx`.

- [ ] **Step 6: Run the tests, the types and the suite**

Run: `pnpm vitest run src/env/__tests__/mode2Switch.test.ts src/features/mode2/__tests__/client.smoke.test.ts && pnpm types && pnpm test:run && pnpm build`
Expected: PASS; types clean; the suite as green as on main; the production bundle builds (the client reads `process.env` at module top level, which `vite.config.ts`'s `define: { 'process.env': {} }` already covers — a `ReferenceError: process` here means that define was lost).

- [ ] **Step 7: Commit**

```bash
git add .npmrc package.json pnpm-lock.yaml .github/workflows/ci.yml src/env/env.config.ts .env.example src/env/__tests__/mode2Switch.test.ts src/features/mode2/__tests__/client.smoke.test.ts src/routes/pages/__tests__/MarketPage.test.tsx
git commit -m "feat(mode2): add the custody client and the APP_MODE2_TRADING switch"
```

### Task 2: The market reader and test fixtures

**Files:**
- Create: `src/features/mode2/types.ts`, `src/features/mode2/chain.ts`, `src/features/mode2/__tests__/fixtures.ts`
- Test: `src/features/mode2/__tests__/chain.test.ts`

**Interfaces:**
- Consumes: the client's PDA helpers (`mode1MarketPda`, `cohortPda`, `groupPda`, `epochPda`, `pairPda`, `positionPda`, `forecastPda`, `configPda`) and decoders (`getCohortDecoder`, `getNettingGroupDecoder`, `getFundingEpochDecoder`, `getPairExposureDecoder`, `getPositionReceiptDecoder`, `getPathForecastDecoder`, `getMode2ConfigDecoder`), sizes (`getCohortSize`, …) and discriminators (`COHORT_DISCRIMINATOR`, …).
- Produces (`types.ts`):
```ts
export interface Decoded<T> { address: string; data: T }
export interface Mode2MarketView {
  marketId: number
  market: string
  owner: string | null
  paused: boolean
  cohort: Decoded<Cohort>
  group: Decoded<NettingGroup> | null
  epoch: Decoded<FundingEpoch> | null
  pair: Decoded<PairExposure> | null
  receipt: Decoded<PositionReceipt> | null
}
export interface Mode2Forecasts { slotToPathIndex: number[]; prices: bigint[][] } // index = cohort slot; prices[slot] has totalCheckpoints entries
```
- Produces (`chain.ts`):
  - `fetchMode2Market(connection: Connection, marketId: number, owner: string | null): Promise<Mode2MarketView | null>` — null when the market has no cohort.
  - `fetchMode2Forecasts(connection: Connection, view: Mode2MarketView): Promise<Mode2Forecasts | null>` — null until every slot `< k` has a complete forecast (`forecastMask`, `complete === 1`).
  - `decodeAccount<T>(info: AccountInfo<Buffer> | null, decoder: Decoder<T>, size: number | null, discriminator: ReadonlyUint8Array): T | null` — null for a missing account, a wrong size or a wrong discriminator (the keeper's `discovery.ts` rule).
- Produces (`__tests__/fixtures.ts`, test-only): `makeCohort(o?)`, `makeGroup(o?)`, `makeEpoch(o?)`, `makePair(o?)`, `makeReceipt(counts: number[], o?)`, `makeView(o?): Mode2MarketView`, `todayOffers()` (2× and 3× at 10 USDC: profit caps 20 and 10 USDC, fees 0.10 and 0.20 USDC, 16 admissions, expiring at the start) and `dollarOffers()` (1×–4× at 1 USDC per spec §7, 160 admissions), `FIXTURE_START_MS = 1_793_545_200_000`, entry levels `[210600n, 208400n, 204200n, 190000n, 186800n]` (the rank row at k = 5), k = 5, cluster map `[0,1,2,3,4]`, rehearsal caps (spec §1), epoch phase Active with 200 USDC LP cash.

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment node`; a fake `Connection` whose `getMultipleAccountsInfo` returns account infos encoded with the client's `getXEncoder()` from the fixtures, keyed by address)
- `it('returns null for a market without a cohort')`
- `it('reads the cohort, the lowest-index group, its epoch, the pair and the config')` — asserts the view's addresses equal the PDAs and `paused === false`
- `it('reads the owner\'s receipt and leaves it null without an owner')`
- `it('ignores an account with the wrong size or discriminator')` — a group with a truncated buffer gives `group: null`
- `it('maps forecast slots to Mode 1 path indices')` — forecasts with `pathIndex` 4,0,1,2,3 for slots 0..4 give `slotToPathIndex [4,0,1,2,3]`
- `it('returns no forecasts while one slot is incomplete')`

- [ ] **Step 2: Run to verify they fail** — Run: `pnpm vitest run src/features/mode2/__tests__/chain.test.ts`; Expected: FAIL, module not found.

- [ ] **Step 3: Implement `types.ts`, `chain.ts` and `fixtures.ts`.** One `getMultipleAccountsInfo` round per dependency level (config + cohort; then groups `0..groupCount-1` + forecasts are separate; then epoch + pair + receipt). Group choice (ruling for T1): the lowest index whose account exists. Convert `Address` ↔ `PublicKey` with `new PublicKey(addr)` / `pk.toBase58()`. `Mode2Config` has no size helper: check its discriminator only.

- [ ] **Step 4: Run to verify they pass** — Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/features/mode2/types.ts src/features/mode2/chain.ts src/features/mode2/__tests__/fixtures.ts src/features/mode2/__tests__/chain.test.ts && git commit -m "feat(mode2): read a market's cohort, group, epoch and receipt"`

### Task 3: The leverage ladder and the breakdown

**Files:**
- Create: `src/features/mode2/ladder.ts`, `src/features/mode2/breakdown.ts`
- Test: `src/features/mode2/__tests__/ladder.test.ts`, `src/features/mode2/__tests__/breakdown.test.ts`

**Interfaces:**
- Consumes: `NettingGroup` offers (Task 2 fixtures), `quantitiesAt`, `payoffAt`, `SCALE` from the client.
- Produces (`ladder.ts`):
```ts
export interface OfferRef { slot: number; leverage: number; collateral: bigint }
export interface OrderPart { offerSlot: number; leverage: number; units: number }
export const PRINCIPAL_STEP_MICRO = 10_000_000n
export function openOffers(group: NettingGroup, pathSlot: number, nowMs: number): OfferRef[] // offerCount-bounded, permitted on the path, not expired, sorted by leverage
export function unitCollateral(offers: readonly OfferRef[]): bigint | null // null when offers disagree on C
export function ladderValues(offers: readonly OfferRef[]): number[] // tenths from min to max leverage, as tenths/10
export function splitPrincipal(leverage: number, units: number, offers: readonly OfferRef[]): OrderPart[] | null // null when not exact
export function roundPrincipal(text: string): bigint // micro-USDC, floored to PRINCIPAL_STEP_MICRO, 0 for anything unparseable or negative
```
`splitPrincipal` algorithm (work in tenths, `t = Math.round(leverage * 10)`): find neighbours `a ≤ L ≤ b` among the offers' leverages; if `t === 10a` one part `{a, units}`; else `unitsHi = units * (t - 10a) / (10 * (b - a))`, which must be a whole number, `unitsLo = units - unitsHi`; drop zero-unit parts.
- Produces (`breakdown.ts`):
```ts
export interface PathBreakdown { slot: number; pathIndex: number; leverage: number; parts: OrderPart[]; principal: bigint; valueWithLeverage: bigint; maxWin: bigint; fee: bigint; maxLoss: bigint }
export interface BreakdownTotals { principal: bigint; valueWithLeverage: bigint; maxWin: bigint; fee: bigint; maxLoss: bigint }
export function pathBreakdown(group: NettingGroup, slot: number, pathIndex: number, leverage: number, parts: readonly OrderPart[]): PathBreakdown
export function totalsOf(rows: readonly PathBreakdown[]): BreakdownTotals
```
Per part with quote `q` (the offer as a `Quote`) and `e = group.entryLevels[slot]`: `maxWin += units * (payoffAt(q, e, SCALE).userClaim - q.collateral)`; `fee += units * q.capacityFee`; `valueWithLeverage += units * q.collateral * L_part`; `principal = maxLoss = Σ units * q.collateral`.

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment node`)

`ladder.test.ts`:
- `it('runs 2.0 to 3.0 in tenths on today\'s offers')` → `ladderValues(todayRefs)` has 11 values, first `2`, last `3`, `values[4] === 2.4`
- `it('runs 1.0 to 4.0 on the 1 USDC offers')` → 31 values
- `it('splits 50 units at 2.4x into 30 at 2x and 20 at 3x')` → `[{leverage:2, units:30},{leverage:3, units:20}]` (with their slots)
- `it('fills every tenth exactly when the principal is a multiple of 10 units')` → for units 10, 20, 50 every value of the 1 USDC ladder splits non-null
- `it('refuses a tenth a small principal cannot fill')` → today's offers, units 2 (20 USDC): 2.0, 2.5 and 3.0 split, 2.4 gives null
- `it('uses one offer for a whole number')` → 3.0 with 7 units gives one part of 7 at 3×
- `it('rounds the principal down to the 10 USDC step')` → `'25'`→`20_000_000n`, `'10.99'`→`10_000_000n`, `'abc'`, `'-10'`, `''`→`0n`, `'1e3'`→`0n`
- `it('drops expired and unpermitted offers')`; `it('returns no unit when offers disagree on collateral')`

`breakdown.test.ts`:
- `it('prices 20 USDC at 2.5x on a path at the even level')` → entry level `200000n`, today's offers, 1 unit each: `valueWithLeverage 50_000_000n`, `maxWin 29_700_000n` (19.9 + 9.8 USDC), `fee 300_000n`, `maxLoss 20_000_000n`, `principal 20_000_000n`
- `it('gives a favoured path a smaller max win')` → the same order at `210600n` has a smaller `maxWin` than at `186800n`
- `it('equals the client payoff at the top index')` → for every part, the per-unit max win equals `payoffAt(q, e, SCALE).userClaim - q.collateral`
- `it('adds up totals')`

- [ ] **Step 2: Run to verify they fail** — Run: `pnpm vitest run src/features/mode2/__tests__/ladder.test.ts src/features/mode2/__tests__/breakdown.test.ts`; Expected: FAIL, modules not found.
- [ ] **Step 3: Implement both modules.**
- [ ] **Step 4: Run to verify they pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(mode2): leverage ladder, principal split and breakdown"` (stage the four files)

### Task 4: The entry window and the pre-check

**Files:**
- Create: `src/features/mode2/entryWindow.ts`, `src/features/mode2/precheck.ts`
- Test: `src/features/mode2/__tests__/entryWindow.test.ts`, `src/features/mode2/__tests__/precheck.test.ts`

**Interfaces:**
- Consumes: `Mode2MarketView` (Task 2), `OrderPart` (Task 3), client `groupBook`, `bookAfter`, `reserveFor`, `leU128`, `GROUP_OPEN`, `EPOCH_ACTIVE`; `MarketState` from `@/types/market`.
- Produces (`entryWindow.ts`):
```ts
export const CLOSE_MARGIN_MS = 10_000
export type EntryState = { kind: 'none' } | { kind: 'waiting-bind' } | { kind: 'open'; closesAtMs: number } | { kind: 'closed' }
export function entryState(view: Mode2MarketView | null, marketState: MarketState, nowMs: number): EntryState
```
`open` needs: a group with `bound === 1` and `state === GROUP_OPEN`, epoch phase `EPOCH_ACTIVE`, `!paused`, `marketState === 'pending'`, and `nowMs < closesAtMs - CLOSE_MARGIN_MS`, where `closesAtMs` is the earliest of `cohort.startTime`, `epoch.admissionCutoff` and the latest `expiresAt` among the group's offers (seconds × 1000). `waiting-bind`: a group exists, `bound === 0`, the market is pending and before the start. `none`: no view or no group. Otherwise `closed`.
- Produces (`precheck.ts`):
```ts
export type PrecheckReason = 'closed' | 'no-orders' | 'offer-full' | 'group-full' | 'path-cap' | 'cluster-cap' | 'market-cap' | 'pair-cap' | 'group-reserve' | 'epoch-reserve' | 'lp-cash' | 'usdc' | 'sol'
export type PrecheckResult = { ok: true } | { ok: false; reason: PrecheckReason; message: string }
export interface PrecheckContext { nowMs: number; marketState: MarketState; usdcMicro: bigint | null; lamports: number | null; rentLamports: number; feeLamports: number }
export interface PathOrder { slot: number; parts: OrderPart[] }
export function precheckOrders(view: Mode2MarketView, orders: readonly PathOrder[], ctx: PrecheckContext): PrecheckResult
```
Checks in the program's order (spec §4.5; `admission.rs` steps 3, 11, 14–16): window (`entryState(...).kind === 'open'`), at least one non-zero part, each offer's `admitted + Σcount ≤ maxAdmissions`, `positions + Σcount ≤ caps.maxGroupPositions`, per-path notional over the whole post-order book `≤ maxPathNotional`, per cluster via `cohort.clusterMap` `≤ maxClusterNotional`, `cohort.notionalTotal + added ≤ maxMarketNotional`, `pair.notionalTotal + added ≤ maxPairNotional` (notional = `count × C × L`), `reserveFor(bookAfter(group, orders), k, policy, leU128(group.lambdaFp)) ≤ maxGroupReserve`, `reserved' = epoch.reserved − group.groupReserve + reserve` with `reserved' ≤ epoch.lp` (`lp-cash`) and `≤ maxEpochReservation`, then `usdcMicro ≥ Σ principal` and, when the receipt does not exist yet, `lamports ≥ rentLamports + feeLamports`. A `null` balance skips that check (the program decides, as the Mode 1 panel does). Messages are one plain line each, e.g. `usdc` → "You need {x} USDC more", `offer-full` → "That leverage step is full".

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment node`) — one `it` per `EntryState` kind (including "closes at the earliest offer expiry" and "closed 9 s before the close"); one `it` per `PrecheckReason` built by pushing a fixture over exactly that limit; `it('passes a 20 USDC 2.5x order on two paths on today\'s fixture')`; `it('skips the SOL check when the receipt exists')`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement both modules.**
- [ ] **Step 4: Run to verify they pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(mode2): entry window and pre-check mirroring admit_batch"`

### Task 5: The admission transaction

**Files:**
- Create: `src/features/mode2/admission.ts`, `src/features/mode2/errors.ts`, `src/features/mode2/api.ts`
- Test: `src/features/mode2/__tests__/admission.test.ts`, `src/features/mode2/__tests__/errors.test.ts`, `src/features/mode2/__tests__/api.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–4; client `admitBatchIx`, `toLegacyInstructionFields`, `associatedTokenAddress`, `fit`, `CU_CEILINGS`, `POLICY_CERTIFIED`, `COMPUTE_BUDGET_IX_CU`; app `buildTransaction`, `getPriorityFee` (`@/lib/chain`), `logTransactionError`, `toast`, `useProgram`.
- Produces (`admission.ts`):
```ts
export interface AdmitInstruction { instruction: TransactionInstruction; computeUnitLimit: number; positions: number }
export function buildAdmitInstruction(view: Mode2MarketView, owner: string, orders: readonly PathOrder[]): AdmitInstruction
```
One owner (index 0, `ownerToken = associatedTokenAddress(owner, epoch.mint)`), one `Order` per non-zero part `{ ownerIndex: 0, offerSlot, selectedPath: slot, count: units, offerDigest: group.offers[offerSlot].digest }`; `computeUnitLimit = (policy === POLICY_CERTIFIED ? CU_CEILINGS.admitCertified : CU_CEILINGS.admitControl) + COMPUTE_BUDGET_IX_CU`; throws when `fit([ix], owner, { priced: true }).format !== 'legacy'` (web3.js 1.98 sends legacy only).
- Produces (`errors.ts`): `export function mode2ErrorCode(err: unknown): number | null` (reads `custom program error: 0x…` from the message and `logs`, and `{ InstructionError: [i, { Custom: n }] }`), `export function describeMode2Error(err: unknown): string` with: 6000 "Leverage is closed for this market", 6005 "That leverage step just filled up", 6019 "Entry closed before your order landed", 6024 "Leverage is paused", 6026 "The LP has no room left for this order", 6027 "The offer changed; refresh and try again", 6033 "Leverage has not opened yet", 6006 "Your USDC account does not match this position", any other code "Mode 2 error {code}", no code "Transaction failed".
- Produces (`api.ts`):
```ts
export const mode2Keys = { market: (marketId: number, owner: string | null) => ['mode2', 'market', marketId, owner] as const, forecasts: (marketId: number) => ['mode2', 'forecasts', marketId] as const, history: (marketId: number, owner: string | null) => ['mode2', 'history', marketId, owner] as const }
export function useMode2Market(marketId: number | undefined, marketState: MarketState | undefined): UseQueryResult<Mode2MarketView | null>
export function useMode2Forecasts(view: Mode2MarketView | null | undefined): UseQueryResult<Mode2Forecasts | null>
export interface OpenPositionsInput { view: Mode2MarketView; orders: PathOrder[]; leverage: number }
export function useOpenMode2Positions(): UseMutationResult<string, Error, OpenPositionsInput>
```
Also in `api.ts`: `export const ADMIT_FEE_LAMPORTS = 10_000` (signature fee plus a priority-fee margin) and `export function useWalletFunds(): { lamports: number | null; rentLamports: number | null }` — the connected wallet's SOL balance (`connection.getBalance`, refetch 30 s) and `connection.getMinimumBalanceForRentExemption(getPositionReceiptSize())`, both through React Query, `null` while unknown or disconnected.
`useMode2Market` is enabled only when `env.APP_MODE2_TRADING` and `marketId` are set; owner from `useWalletStore`; connection from `useConnection()`; `refetchInterval` 5 000 ms while `marketState === 'pending'`, 15 000 while active/sampling/settling/maturing, 60 000 otherwise. `useMode2Forecasts`: `staleTime: Infinity` once it returns non-null. The mutation sends through `program.provider` (`useProgram()`), `buildTransaction({ instructions: [ix], computeUnitLimit, priorityFeeMicroLamports: await getPriorityFee(connection) })`, `provider.sendAndConfirm`; `logTransactionError('mode2.admitBatch failed', …)` on failure; `onSuccess` invalidates `['mode2']` and `['usdcBalance']` and toasts "Opened {n} position(s) at {L}×" with the signature; `onError` invalidates `['mode2']` and toasts "Could not open positions" with `describeMode2Error`.

- [ ] **Step 1: Write the failing tests**
- `admission.test.ts` (`// @vitest-environment node`): `it('builds one admit_batch with the owner as signer')` (programId `A6TNLq28eHjhgvzoYN2FTxGvwEB2j9XWakcED3oEUfbJ`; the owner key at index 10 is signer and writable; index 11 is the owner's ATA for the epoch mint; index 12 is `positionPda(group, owner)`), `it('encodes one order per non-zero part with the offer digest')` (decode the data with the generated `getAdmitBatchInstructionDataDecoder`), `it('fits a legacy transaction for 4 paths split across 2 offers')` (8 orders), `it('uses the certified ceiling for a certified group')`.
- `errors.test.ts`: one `it` per mapped code from a web3.js-style `SendTransactionError` message, one from `logs`, one from `InstructionError`, plus the fallbacks.
- `api.test.tsx`: `it('invalidates Mode 2 queries when the order fails')` and `it('is disabled while the switch is off')` (QueryClient wrapper as in `RequestUsdcButton.test.tsx`; mock `@/lib/solana/program`, `@solana/wallet-adapter-react`, `@/env/env.config`).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement `admission.ts`, `errors.ts`, `api.ts`.**
- [ ] **Step 4: Run to verify they pass, then `pnpm types`.**
- [ ] **Step 5: Commit** — `git commit -m "feat(mode2): admit_batch builder, error messages and the open-positions mutation"`

### Task 6 (Controller, devnet, on the owner's word): the trader pays and signs

The spec's early proof (§8). Not an implementer task; no repo change except the ledger.

- [ ] **Step 1:** In the plan workspace (outside the repo), write `self-admit.mjs` that uses only the installed client and kit, not app code: `createSolanaRpc('https://api.devnet.solana.com')`; read the next hourly market's cohort, group 0 and epoch with `fetchMaybeCohort`, `fetchMaybeNettingGroup`, `fetchMaybeFundingEpoch`; wait until the group is bound and the start is more than 30 s away; build one order of 1 unit at the lowest-leverage offer on slot 0 with `admitBatchIx` (owner = fee payer = a rehearsal test-owner keypair from `~/.config/levx/rehearsal/`, the owner names which); `assemble` with `feePayer` = owner and `computeUnitLimit = CU_CEILINGS.admitControl + COMPUTE_BUDGET_IX_CU`; `complete(assembled, ownerSigner)`; send with `sendTransaction` and poll `getSignatureStatuses`.
- [ ] **Step 2 (owner's word):** run it once. Expected: the transaction confirms; `positionPda(group, owner)` exists with `positions === 1` and `ownerTokenAccount` = the owner's ATA; the owner's USDC fell by one unit of collateral.
- [ ] **Step 3:** after the market settles, confirm the keeper paid the receipt (receipt closed; the owner's ATA credited). Record the signatures and amounts in the ledger. If Step 2 fails, stop and report: the screen rests on it.

### Task 7: Slider disabled ticks and the formatters

**Files:**
- Modify: `src/ui/SegmentedSlider.tsx`
- Create: `src/features/mode2/format.ts`
- Test: `src/ui/__tests__/SegmentedSlider.test.tsx`, `src/features/mode2/__tests__/format.test.ts`

**Interfaces:**
- Produces: `SegmentedSlider` prop `disabledValues?: readonly number[]` — disabled ticks render `disabled`, dimmed (`opacity-30`), skip clicks, and a drag snaps to the nearest enabled value; existing callers unchanged.
- Produces (`format.ts`): `formatUsdc(micro: bigint): string` ("29.70"), `formatSignedUsdc(micro: bigint): string` ("+29.70", "−5.90"), `formatLeverage(x: number): string` ("2.4×", "3.0×"), `formatMarketWindow(startMs: number, endMs: number): string` ("1h · 14:00 → 15:00", "24h · 00:00 → 00:00"; 24-hour local time), `formatCountdownShort(ms: number): string` ("2:41"), `pathDirection(path: PredictionPath): 'LONG' | 'SHORT'` (last point's value ≥ first point's, as `MarketPage`'s local `isPathLong`), `pathLabelsOf(paths: readonly PredictionPath[]): Record<number, { name: string; direction: 'LONG' | 'SHORT' }>` keyed by `pathIndex`, `name = path.label`.

- [ ] **Step 1: Write the failing tests** — `SegmentedSlider.test.tsx`: `it('renders a disabled tick as a disabled button')` (`getByRole('button', { name: 'Set to 2.4×' })` is disabled with `formatAriaValue` from `formatLeverage`), `it('ignores a click on a disabled tick')`, `it('keeps today\'s behaviour without disabledValues')`. `format.test.ts`: the examples above, plus `formatUsdc(0n) === '0.00'`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass, plus `src/routes/pages/__tests__/AdminPage*` and `MarketPreview` tests if present.**
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): disabled ticks on SegmentedSlider; mode2 formatters"`

### Task 8: The leverage section

**Files:**
- Create: `src/features/mode2/LeverageSection.tsx`, `src/features/mode2/LeverageBreakdown.tsx`, `src/features/mode2/useLeverageOrder.ts`
- Test: `src/features/mode2/__tests__/LeverageSection.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–5, 7 (`useWalletFunds` and `ADMIT_FEE_LAMPORTS` feed the pre-check's `lamports`, `rentLamports` and `feeLamports`; `useUsdcBalance().data.balance × 1e6` feeds `usdcMicro`); `ConnectGate`, `Button`, `Input`, `Label`, `UsdcBalance`, `RequestUsdcButton`, `useUsdcBalance`, `PredictionPath`, `Market`. The duration label is `formatMarketWindow(market.startTime, market.endTime)`.
- Produces:
```ts
export interface LeverageOrderState { leverage: number; setLeverage(v: number): void; principalText: string; setPrincipalText(t: string): void; commitPrincipal(): void; values: number[]; disabledValues: number[]; disabledReason: string | null; rows: PathBreakdown[]; unavailable: PredictionPath[]; totals: BreakdownTotals; orders: PathOrder[]; precheck: PrecheckResult }
export function useLeverageOrder(view: Mode2MarketView, forecasts: Mode2Forecasts | null, selectedPaths: readonly PredictionPath[], ctx: Omit<PrecheckContext, 'nowMs' | 'marketState'>, nowMs: number, marketState: MarketState): LeverageOrderState
export function LeverageSection(props: { market: Market; view: Mode2MarketView; forecasts: Mode2Forecasts | null; selectedPaths: PredictionPath[]; nowMs: number }): JSX.Element
export function LeverageBreakdown(props: { marketLabel: string; windowLabel: string; rows: PathBreakdown[]; pathLabels: Record<number, { name: string; direction: 'LONG' | 'SHORT' }>; unavailable: string[]; totals: BreakdownTotals }): JSX.Element
```
Behaviour (spec §4.1–§4.5, mockup `trade-panel-v3.html`): the "Leverage open / closes in m:ss" strip; Label "Leverage" with the value `formatLeverage`; `SegmentedSlider` with `values`, `disabledValues`, `formatAriaValue={formatLeverage}`; scale row "1× … 4× max · 1h" from the ladder ends and the market window; `Input` labelled "Principal" (one path) or "Principal per path" (several), unit "USDC", hint paragraph "In steps of 10 USDC", rounding on blur; the breakdown (shared Market and Duration rows, one native `<details>` per cohort path — first open — with the summary "Path {n} · {LONG|SHORT}, max win +{x}", the rows of spec §4.4 and "Made of {lo} at {a}× + {hi} at {b}×" only for a split; totals); paths outside the cohort (no slot maps to their `pathIndex`) listed once as "Not available with leverage"; the rent line when the receipt does not exist; `ConnectGate` around the button; the button label from the cohort paths count and the leverage, disabled with the pre-check message under it. Default leverage: the lowest ladder value; when it becomes disabled, move to the nearest enabled value and show `disabledReason`. Tick disabling: a value is disabled when `splitPrincipal` returns null for any cohort path or `precheckOrders` fails with a capacity/cap/reserve reason for it.

- [ ] **Step 1: Write the failing tests** (jsdom; mock `@/features/mode2/api`, `@/lib/api/useUsdcBalance`, wallet store set directly; fixture view with today's offers; three selected paths of which one has no slot):
- `it('shows the window, the slider and the breakdown')` — `getByText('Leverage open')`, `getByRole('button', { name: 'Set to 2.5×' })`, and the `<details>` summary found by its text "Path 1 · LONG"
- `it('updates value with leverage when the slider moves')` — click "Set to 3.0×", the total value with leverage reads "60.00" for 20 USDC on one path
- `it('rounds the principal on blur')` — type "25", blur, the input shows "20.00" (Review Focus 2), and "abc" shows "0.00" with the button disabled
- `it('lists a path outside the cohort as not available and leaves it out of the count')` — button "Open 2 Positions at 2.0×" with 3 paths selected (Review Focus 3)
- `it('disables the steps a small principal cannot fill')` — 20 USDC: "Set to 2.4×" disabled, "Set to 2.5×" enabled
- `it('moves the thumb when its step fills up')` — fixture offer 3× at `admitted === maxAdmissions`: the 3.0 tick is disabled, the value moves and the reason shows (Review Focus 4)
- `it('names the USDC shortfall')` — balance 5 USDC, principal 20: "You need 15.00 USDC more" (Review Focus 2)
- `it('sends the orders from the button')` — the mocked `useOpenMode2Positions().mutate` receives `{ view, orders, leverage: 2.5 }` with 1 unit at 2× and 1 at 3× per path
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement `useLeverageOrder.ts`, `LeverageBreakdown.tsx`, `LeverageSection.tsx`.**
- [ ] **Step 4: Run to verify they pass; `pnpm types`; `pnpm lint` on the new files.**
- [ ] **Step 5: Commit** — `git commit -m "feat(mode2): leverage section with slider, principal, breakdown and button"`

### Task 9: The position card

**Files:**
- Create: `src/features/mode2/history.ts`, `src/features/mode2/position.ts`, `src/features/mode2/Mode2PositionCard.tsx`, `src/features/mode2/useMode2Position.ts`
- Test: `src/features/mode2/__tests__/history.test.ts`, `src/features/mode2/__tests__/position.test.ts`, `src/features/mode2/__tests__/Mode2PositionCard.test.tsx`

**Interfaces:**
- Consumes: Tasks 2, 3, 5, 7; client `payoffAt`, `RESULT_STAGED`, `GROUP_OPEN`, `GROUP_FUNDED_NORMAL`, `GROUP_FUNDED_VOID`, `positionPda`, `associatedTokenAddress`.
- Produces (`history.ts`):
```ts
export interface ReceiptHistory { principal: bigint; paid: bigint | null; claimSignature: string | null }
export async function fetchReceiptHistory(connection: Connection, receipt: string, ownerAta: string): Promise<ReceiptHistory | null>
```
`getSignaturesForAddress(receipt, { limit: 20 })` then `getParsedTransactions`; per transaction, the owner ATA's token-balance change (`postTokenBalances − preTokenBalances`, raw `amount` strings): negative changes sum into `principal`, the positive change of the transaction that closed the receipt is `paid`. `null` when there are no signatures.
- Produces (`position.ts`):
```ts
export type PositionStatus = 'waiting' | 'running' | 'result-in' | 'paid' | 'voided'
export interface PathPosition { slot: number; pathIndex: number; leverage: number; principal: bigint; valueWithLeverage: bigint; maxWin: bigint; fee: bigint; maxLoss: bigint; finalPayout: bigint | null }
export interface PositionSummary { status: PositionStatus; principal: bigint; checkpoint: number; totalCheckpoints: number; finalPayout: bigint | null; paid: bigint | null; paths: PathPosition[] }
export function summarizePosition(view: Mode2MarketView, forecasts: Mode2Forecasts | null, history: ReceiptHistory | null, marketState: MarketState, nowMs: number): PositionSummary | null
```
Rules (spec §6.2): receipt present and before the start → `waiting`; receipt present, `resultState !== RESULT_STAGED` → `running` (`checkpoint = observationsRecorded`); staged and group `GROUP_OPEN` → `result-in` with `finalPayout = Σ counts[i] × payoffAt(quote(bucket i), entryLevels[path], cohort.indices[path]).userClaim`; group `GROUP_FUNDED_NORMAL` → `result-in` with `finalPayout = Σ counts[i] × buckets[i].claim`; group `GROUP_FUNDED_VOID` → `voided`; receipt gone and `history.paid !== null` → `paid`, except `voided` when `paid === principal` and `marketState === 'void'` (ruling for closed accounts). A path's leverage is `Σ count × L / Σ count` rounded to one decimal; its rows reuse `pathBreakdown` per bucket.
- Produces: `useMode2Position(market: Market, view: Mode2MarketView | null | undefined, forecasts: Mode2Forecasts | null | undefined): PositionSummary | null` (history query `mode2Keys.history`, enabled only when the wallet is connected and the receipt is absent after the start) and `Mode2PositionCard(props: { summary: PositionSummary; pathLabels: Record<number, { name: string; direction: 'LONG' | 'SHORT' }> }): JSX.Element` (mockup `position-card.html`: header "Leveraged positions", the chip, the summary block per status — principal and "Estimate from checkpoint 4" while waiting or running; "Final result" + `finalPayout` and "Paid to your wallet automatically after the review period" for result-in; "Paid to your wallet" + `paid` for paid; "Refunded to your wallet" + principal for voided — and one `<details>` per path).

- [ ] **Step 1: Write the failing tests** — `history.test.ts` (fake connection returning two parsed transactions: an admission −20 USDC and a claim +29.70 USDC → `{ principal: 20_000_000n, paid: 29_700_000n }`; no signatures → null). `position.test.ts`: one `it` per status, the combined leverage `2.5` for 1 unit at 2× and 1 at 3×, `finalPayout` from staged indices equal to the client's `payoffAt` sum, and `it('keys history by owner')` asserting `mode2Keys.history(142, 'A') !== mode2Keys.history(142, 'B')` element-wise (Review Focus 5). `Mode2PositionCard.test.tsx`: each status renders its chip text and summary line by role/text; a path dropdown opens.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass; `pnpm types`.**
- [ ] **Step 5: Commit** — `git commit -m "feat(mode2): position card with waiting, running, result, paid and voided states"`

### Task 10: The market page behind the switch

**Files:**
- Modify: `src/routes/pages/MarketPage.tsx` (rail gates at 735-745, wager rail 922-1188, other rails 1192-1230), `src/lib/api/eventInvalidation.ts`
- Test: `src/routes/pages/__tests__/MarketPage.test.tsx`, `src/lib/api/__tests__/eventInvalidation.test.ts`

**Interfaces:**
- Consumes: `env.APP_MODE2_TRADING`; `useMode2Market`, `useMode2Forecasts` (Task 5); `entryState` (Task 4); `LeverageSection` (Task 8); `useMode2Position`, `Mode2PositionCard` (Task 9).
- Produces: in `EVENT_INVALIDATION_MAP`, `CheckpointSampled`, `MarketSettled`, `MarketFinalized` and `MarketVoided` also invalidate `['mode2']`.

Behaviour with the switch on (spec §4.1 table): `entryState` `open` → the wager rail keeps the path list and draw button, and renders `LeverageSection` in place of the legacy blocks (1079-1117), the balance row, the Collateral input, slippage and button; `waiting-bind` → today's rail plus the line "Leverage opens when the paths arrive, about 3 minutes before the start"; `closed` with a group, market active/sampling → today's rail plus "Leverage closed at the start"; the legacy `leverageEnabled` slider and `Mode2MarketReadinessCard` are not rendered. `Mode2PositionCard` renders under the trade panel in the wager rail and beside `UserPositionCard` in the maturing, settled and void rails, and `showRail` also turns on when the summary is non-null. With the switch off, nothing above renders and the Mode 2 hooks are disabled.

- [ ] **Step 1: Write the failing tests** — in `MarketPage.test.tsx` (mock `@/features/mode2/api` and `@/features/mode2/useMode2Position`; the `env` mock gains a mutable `APP_MODE2_TRADING`):
- `it('renders today\'s page with the switch off')` — the existing legacy readiness assertions still pass and no "Leverage open" text (Review Focus: the switch)
- `it('shows the leverage section while entry is open')` — "Leverage open" and no `getByLabelText(/^collateral$/i)`
- `it('says leverage opens when the paths arrive')`; `it('says leverage closed at the start')`
- `it('shows the position card in the settled rail for a trader with only Mode 2 positions')`
- `eventInvalidation.test.ts`: `CheckpointSampled` invalidates `['mode2']`
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement the wiring** (no new logic in the page beyond choosing what renders).
- [ ] **Step 4: Run the page tests, the suite and the types** — `pnpm vitest run src/routes/pages/__tests__/MarketPage.test.tsx src/lib/api/__tests__/eventInvalidation.test.ts && pnpm test:run && pnpm types`; Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mode2): leverage section and position card on the market page behind APP_MODE2_TRADING"`

### Task 11 (Controller and owner, devnet): the app proof

- [ ] **Step 1:** Run `pnpm dev` with `APP_MODE2_TRADING=true` against devnet (`APP_USE_MOCK` unset), open the next hourly market with a bound group before its start, and check in the browser pane: the window strip counts down, the slider runs 2.0–3.0 on today's offers, 20 USDC per path disables 2.4 and keeps 2.5, the breakdown matches spec §4.4.
- [ ] **Step 2 (owner signs, test wallet):** open 2.5× on two paths with 20 USDC per path. Expected: one wallet prompt, confirmed transaction, the card shows "Waiting for the start", then "Running · checkpoint j of 6", then "Result in", then "Paid" with the amount the receipt's claim moved.
- [ ] **Step 3:** record signatures, amounts and screenshots in the PR description. The switch stays off in production; turning it on is the owner's (spec T13).
