# Mode 2 Position Estimate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Mode 2 position card shows "Worth now (estimate)" from the fourth recorded checkpoint on, computed in the browser by the program's own scorer (`@spizzerp/levx-mode2-score`).

**Architecture:** A lazily loaded WebAssembly scorer computes the running index `v_i(j)` from the cohort's forecasts and recorded observations; the client's `payoffAt` turns it into each bucket's claim; the card renders the sum. Nothing changes before checkpoint 4 or once the result is staged.

**Tech Stack:** React 19, TanStack Query 5, Vite 8 (`optimizeDeps.exclude` for the wasm package), `@spizzerp/levx-mode2-score` 0.1.0, `@spizzerp/levx-mode2-client` 0.5.0, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-11-01-mode2-trader-screen-design.md` §6.3 and T11. **Depends on:** `docs/superpowers/plans/2026-11-01-mode2-trader-screen.md` merged (its `src/features/mode2/` modules, fixtures and card) and LevXv2's `@spizzerp/levx-mode2-score` 0.1.0 published (LevXv2 `docs/superpowers/plans/2026-11-01-mode2-running-index-wasm.md`).

## Global Constraints

- Everything in the trader-screen plan's Global Constraints applies (switch, units, copy style, tests, test env, controller-only installs and devnet writes, git).
- Dependency, exact: `"@spizzerp/levx-mode2-score": "0.1.0"`.
- No estimate when fewer than 4 observations are recorded (`MIN_CHECKPOINTS`, T11), when the receipt is missing, or once `cohort.resultState === RESULT_STAGED` (the card then shows the final result).
- The scorer's params are `cohort.scoring` in the order `[alpha, beta, referenceAction, weightQv, weightDd, weightEndpoint, weightDisplacement]`; forecasts are the cohort slots' `PathForecast.prices[0..T]`; actuals are `Observations.slots[0..observationsRecorded].price`. The package applies the T11 reference scaling itself.
- Copy, verbatim: "Worth now (estimate)", "If the market settled at checkpoint {j}, you would get this. It updates at every checkpoint; the final payout can be different.", the per-path collapsed value "≈ {amount} ({signed change})".

## Review Focus

1. **The Observations account is not full size yet** (`grow_observations` still running when the market starts): the reader returns null and the card keeps "Estimate from checkpoint 4" instead of erroring — pinned in Task 2.
2. **The wasm file fails to load** (blocked request, old browser): the card falls back to the no-estimate text and the page keeps working — pinned in Task 3.
3. **A scorer error** (`InvalidDomain` from a malformed cohort): no estimate, no crash, one `console.warn` — pinned in Task 2.
4. **At the last checkpoint before staging** (`n = T`, result not yet staged): the estimate equals what the result will pay — pinned in Task 2 against a real cohort.
5. **Many re-renders while running**: the scorer runs once per new observation count, not per render — pinned in Task 3 (memoised by `observationsRecorded`).

---

### Task 1: Load the scorer

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (Controller), `vite.config.ts`
- Create: `src/features/mode2/score.ts`
- Test: `src/features/mode2/__tests__/score.test.ts`

**Interfaces:**
- Produces:
```ts
export interface Scorer { runningIndices(params: readonly bigint[], totalCheckpoints: number, k: number, forecasts: readonly (readonly bigint[])[], actuals: readonly bigint[]): bigint[] }
export function scorerFromModule(mod: { runningIndices(p: BigUint64Array, t: number, k: number, f: BigUint64Array, a: BigUint64Array): BigUint64Array }): Scorer // flattens forecasts slot-major, each row cut to totalCheckpoints
export function loadScorer(): Promise<Scorer> // `await init()` once, memoised promise; a rejected load is not cached, so a later call retries
```

- [ ] **Step 1 (Controller):** `pnpm add @spizzerp/levx-mode2-score@0.1.0 --save-exact` (needs `NODE_AUTH_TOKEN`); add `optimizeDeps: { exclude: ['@spizzerp/levx-mode2-score'] }` to `vite.config.ts`.
- [ ] **Step 2: Write the failing test** (`// @vitest-environment node`): build a `Scorer` with `scorerFromModule` over the package after `initSync({ module: readFileSync(fileURLToPath(import.meta.resolve('@spizzerp/levx-mode2-score/levx_mode2_wasm_bg.wasm'))) })`, then for every case of `@spizzerp/levx-mode2-score/golden/running-index.json` with `indices !== null`: `runningIndices(...)` equals the expected indices (rows of `forecasts` re-split by `total`).
- [ ] **Step 3: Run to verify it fails** — Run: `pnpm vitest run src/features/mode2/__tests__/score.test.ts`; Expected: FAIL, module `score.ts` not found.
- [ ] **Step 4: Implement `score.ts`.**
- [ ] **Step 5: Run it, then `pnpm build`** — Expected: PASS; the bundle emits the `.wasm` asset.
- [ ] **Step 6: Commit** — `git add package.json pnpm-lock.yaml vite.config.ts src/features/mode2/score.ts src/features/mode2/__tests__/score.test.ts && git commit -m "feat(mode2): load the running-index scorer"`

### Task 2: Observations and the estimate

**Files:**
- Modify: `src/features/mode2/chain.ts`
- Create: `src/features/mode2/estimate.ts`
- Test: `src/features/mode2/__tests__/estimate.test.ts`, `src/features/mode2/__tests__/chain.test.ts` (add cases)

**Interfaces:**
- Consumes: `Mode2MarketView`, `Mode2Forecasts`, `decodeAccount` (trader-screen Task 2); `Scorer` (Task 1); client `payoffAt`, `observationsPda`, `getObservationsDecoder`, `getObservationsSize`, `OBSERVATIONS_DISCRIMINATOR`, `MIN_CHECKPOINTS`, `RESULT_STAGED`.
- Produces:
```ts
// chain.ts
export async function fetchMode2Observations(connection: Connection, view: Mode2MarketView): Promise<bigint[] | null> // slots[0..observationsRecorded].price; null unless the account has exactly the full size
// estimate.ts
export interface PositionEstimate { checkpoint: number; total: bigint; perSlot: Record<number, bigint> }
export function estimatePosition(view: Mode2MarketView, forecasts: Mode2Forecasts, actuals: readonly bigint[], scorer: Scorer): PositionEstimate | null
```
`estimatePosition`: null under the Global Constraints' conditions or when the scorer throws (one `console.warn`); else `v = scorer.runningIndices(params, T, k, forecasts.prices, actuals)` and, for every bucket `i < group.bucketCount` with `receipt.counts[i] > 0`, `claim = counts[i] × payoffAt(quote(offers[bucket.offerSlot]), group.entryLevels[bucket.path], v[bucket.path]).userClaim`, summed per `bucket.path` and in total; `checkpoint = actuals.length`.

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment node`)
- `chain.test.ts`: `it('returns no observations while the account is still growing')` (a 10 240-byte account → null, Review Focus 1); `it('returns the recorded prices only')`.
- `estimate.test.ts`, with a stub `Scorer` returning fixed indices: `it('returns nothing before the fourth observation')` (3 actuals); `it('returns nothing once the result is staged')`; `it('sums each bucket\'s claim at the running index')` (two buckets on one path: 1 unit at 2× and 1 at 3× with `v` = the even level `200000n` → each claim equals `payoffAt(q, e, 200000n).userClaim`); `it('returns nothing and warns when the scorer throws')` (Review Focus 3).
- With the real package (`initSync` as in Task 1) and the golden file's devnet-cohort case at `n = T` turned into a view (counts of 1 on two buckets): `it('matches the final payout at the last checkpoint')` — `estimatePosition(...).total` equals the trader-screen `summarizePosition` result-in `finalPayout` for the same view with `resultState` staged and `indices` = the case's indices (Review Focus 4).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify they pass; `pnpm types`.**
- [ ] **Step 5: Commit** — `git commit -m "feat(mode2): running estimate of a position's payout"` (stage the four files)

### Task 3: The estimate on the card

**Files:**
- Modify: `src/features/mode2/api.ts`, `src/features/mode2/Mode2PositionCard.tsx`, `src/routes/pages/MarketPage.tsx` (pass the estimate)
- Create: `src/features/mode2/useMode2Estimate.ts`
- Test: `src/features/mode2/__tests__/Mode2PositionCard.test.tsx` (add cases), `src/features/mode2/__tests__/useMode2Estimate.test.tsx`

**Interfaces:**
- Produces: `mode2Keys.observations(marketId: number) => ['mode2', 'observations', marketId]`; `useMode2Observations(view)` (enabled while the market runs and a receipt exists; `refetchInterval` 15 000 ms); `useMode2Estimate(view, forecasts): PositionEstimate | null` (loads the scorer through `loadScorer()` in a query with `staleTime: Infinity`; memoises `estimatePosition` on `view.cohort.data.observationsRecorded`); `Mode2PositionCard` gains `estimate?: PositionEstimate | null`.

Card behaviour (mockup `position-card.html`, running state): with an estimate, the summary shows "Worth now (estimate)", the total, the signed change against the principal, and the note "If the market settled at checkpoint {j}, you would get this. It updates at every checkpoint; the final payout can be different."; each path's collapsed row shows "≈ {amount} ({signed change})" and its open rows add "Worth now (estimate)". Without one, the running state stays as the trader-screen plan left it ("Estimate from checkpoint 4").

- [ ] **Step 1: Write the failing tests** — card: `it('shows the estimate when given one')` (text "Worth now (estimate)" and "214.30" for a fixture total of 214.30 USDC on 200 put in, "+14.30"); `it('keeps the no-estimate text without one')`. Hook: `it('does not rerun the scorer on a re-render with the same observation count')` (spy on the stub scorer, Review Focus 5); `it('returns null when the scorer fails to load')` (`loadScorer` rejected, Review Focus 2).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement and pass `estimate` from `MarketPage`'s Mode 2 wiring.**
- [ ] **Step 4: Run the feature tests, the suite and the types** — `pnpm vitest run src/features/mode2 && pnpm test:run && pnpm types`; Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mode2): show the running estimate on the position card"`

### Task 4 (Controller, devnet, read-only): check it live

- [ ] With `APP_MODE2_TRADING=true` on the dev server, open an hourly market where a test wallet holds Mode 2 positions (from the trader-screen plan's Task 11 or a new one on the owner's word): no estimate at checkpoints 1–3; an estimate after checkpoints 4 and 5; at "Result in", the final figure. Record the three numbers and the final payout in the PR.
