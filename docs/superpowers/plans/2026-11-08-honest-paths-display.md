# Honest Paths — Dense Display Path Implementation Plan (levx-fe)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The market chart draws each AI path at the model's native resolution from the pipeline's display record, only when that record agrees exactly with the chain at every checkpoint; the admin page creates markets with the same scoring parameters as the pipeline.

**Architecture:** A small API module fetches `GET {APP_API_BASE_URL}/api/v1/markets/{id}/display-paths`, verifies it against the chain's `predictedPrices`, and attaches `displayData` to each `PredictionPath`; the chart draws `displayData ?? data` while everything checkpoint-related keeps using the six points. A `scoringDefaults` module becomes the single source of the admin form's scoring values.

**Tech Stack:** React 19, TanStack Query, Vite (`envPrefix: 'APP_'`), Vitest + Testing Library (jsdom), pnpm 10.

**Spec:** `docs/superpowers/specs/2026-11-08-honest-paths-design.md` — a verbatim copy, committed with this plan, of the source of truth in levx-infra (`levx-infra/docs/superpowers/specs/2026-11-08-honest-paths-design.md`); §4 W2, W1.3 record shape, W1.7.

## Global Constraints

- Branch `feat/honest-paths-display` in a worktree under `.claude/worktrees/`; PR to `main`; no push or merge by an implementer.
- Commands: `pnpm types`, `pnpm lint`, `pnpm test:run`; single test `vitest run <file> -t '<name>'`.
- `className` with 8+ utilities uses `cn(...)` with the AGENTS.md grouping order.
- Display record (frozen in the spec): `{ schema: "display-paths-v1", market_id, generated_at, start_time, checkpoint_interval, total_checkpoints, model_step_seconds, times: number[] (unix s), checkpoint_indices: number[], paths: [{ path_index, prices_u64: number[] }] }`. Prices are u64 with 6 decimals; `PredictionPath.predictedPrices` are those values `/ 1_000_000`.
- Fixture for the record: `src/tests/fixtures/displayPaths.ts` (Task 1) — a 6 × 600 s market with 300 s steps (11 grid points, `checkpoint_indices = [0, 2, 4, 6, 8, 10]`).
- No fetch when `APP_API_BASE_URL` is empty or `APP_USE_MOCK === 'true'`.
- Commits: conventional prefix, imperative, no attribution lines.

## Review Focus

1. A record with more or fewer paths than the chain (externals landed beside the menu, or a path not yet uploaded): only indices present on both sides attach; the others keep six points — Task 1.
2. A record whose `checkpoint_indices` are out of range, or whose `times.length !== prices_u64.length`: refused as a whole, no partial attach — Task 1.
3. A dense series whose first points precede `start_time` (the generation-to-start segment): not drawn — Task 1 (filter) and Task 3 (chart test).
4. A dissolved path with a dense series: the cut happens at the dissolving checkpoint's time on the dense series, and the `×` sits on that checkpoint — Task 3.
5. The elapsed/future split at a `nowTime` between two dense points: `segmentPredictionPathAtTime` interpolates the boundary point as it does for six points; no gap and no duplicate point — Task 3.

---

### Task 1: Display-paths API module and the attach rule

**Files:**
- Create: `src/lib/api/displayPaths.ts`, `src/tests/fixtures/displayPaths.ts`
- Modify: `src/types/market.ts:119-140` (`displayData?: PricePoint[]` on `PredictionPath`, doc comment "model-resolution series from the pipeline's display record; drawn instead of `data` when present; never used for scoring or checkpoints")
- Test: `src/lib/api/__tests__/displayPaths.test.ts`

**Interfaces:**
- Produces: `interface DisplayPathsRecord` (the frozen shape); `fetchDisplayPaths(marketId: number): Promise<DisplayPathsRecord | null>` (404 → `null`; non-2xx otherwise throws `DisplayPathsRequestError`; uses `env.APP_API_BASE_URL` like `candlesClient.ts`); `useDisplayPaths(marketId: number | null, enabled: boolean): DisplayPathsRecord | null` (query key `['display-paths', marketId]`, `staleTime: 60_000`, `enabled: enabled && marketId !== null && env.APP_API_BASE_URL !== '' && import.meta.env.APP_USE_MOCK !== 'true'`); `attachDisplayData(paths: readonly PredictionPath[], record: DisplayPathsRecord | null, startTimeMs: number): PredictionPath[]` (pure).

- [ ] **Step 1: Write the failing tests:**

```ts
it('attaches a dense series when every checkpoint value equals the chain', () => {
  const out = attachDisplayData(paths, record, startTimeMs)
  expect(out[0].displayData).toHaveLength(11)
  expect(out[0].displayData![2].value).toBe(paths[0].predictedPrices[1])      // grid point 2 is checkpoint 1
  expect(out[0].displayData!.every((p) => p.time >= startTimeMs)).toBe(true)   // Review Focus 3
})
it('refuses a path whose checkpoint value differs from the chain by one unit', () => {
  const r = structuredClone(record); r.paths[0].prices_u64[0] += 1
  expect(attachDisplayData(paths, r, startTimeMs)[0].displayData).toBeUndefined()
  expect(attachDisplayData(paths, r, startTimeMs)[1].displayData).toBeDefined()  // others unaffected
})
it('attaches only to indices present on both sides', () => { /* record with path_index 9 extra; chain path 4 missing */ })   // Review Focus 1
it('refuses the whole record when checkpoint_indices are out of range or lengths disagree', () => { /* Review Focus 2 */ })
it('fetchDisplayPaths returns null on 404 and throws on 500', async () => { /* vi.spyOn(globalThis, 'fetch') */ })
```

Equality rule: `record.paths[k].prices_u64[record.checkpoint_indices[j]] === Math.round(path.predictedPrices[j] * 1_000_000)` for every `j < path.numCheckpoints`; `displayData = times.map((t, i) => ({ time: t * 1000, value: prices_u64[i] / 1_000_000 })).filter((p) => p.time >= startTimeMs)`.

- [ ] **Step 2: Run** `vitest run src/lib/api/__tests__/displayPaths.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** the module, the fixture and the type field.
- [ ] **Step 4: Run** the test file → PASS; `pnpm types` → clean.
- [ ] **Step 5: Commit** — `git add src/lib/api/displayPaths.ts src/tests/fixtures/displayPaths.ts src/types/market.ts src/lib/api/__tests__/displayPaths.test.ts` · `feat(chart): display-paths record client and the chain-equality attach rule`

---

### Task 2: Market page wiring

**Files:**
- Modify: `src/routes/pages/MarketPage.tsx:323-330` (hook), `:556` (`allPaths` from the attached AI paths)
- Modify: `src/lib/api/eventInvalidation.ts:79-84` (add `['display-paths', Number(mk)]` to the per-market reads invalidated by path-upload events, next to the Mode 2 keys)
- Test: `src/lib/api/__tests__/eventInvalidation.test.ts` (the key appears for the path events)

**Interfaces:** consumes `useDisplayPaths`, `attachDisplayData` (Task 1); produces nothing new.

- [ ] **Step 1: Test** — in `eventInvalidation.test.ts`, the factory for the AI-path-upload event (whichever `EVENT_INVALIDATION_MAP` key covers `PathUploaded`/`AiPathAdded`; read the file) includes `['display-paths', 176]`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**: `const displayRecord = useDisplayPaths(market?.marketId ?? null, !!market && aiPaths.length > 0)`; `const aiPathsDrawn = useMemo(() => attachDisplayData(aiPaths, displayRecord, chartMarketStart), [...])`; `allPaths` uses `aiPathsDrawn`. Mock mode and empty base URL leave the paths untouched (hook disabled).
- [ ] **Step 4: Run** `pnpm test:run` → PASS; `pnpm types` → clean.
- [ ] **Step 5: Commit** — `feat(market): attach the pipeline's dense display paths to the chart's AI paths`

---

### Task 3: Chart draws the dense series

**Files:**
- Modify: `src/features/chart/LevXChart.tsx:260-276` (`dissolvedPathData` and `drawnData` use `path.displayData ?? path.data`), `:528-606` (the prediction `LinePath`s draw the same series; add `data-testid="prediction-path"`, `data-series={path.displayData ? 'dense' : 'checkpoints'}` and `data-points={segment.length}` on the elapsed and future `LinePath`s, matching the existing `data-testid="dissolved-path"` convention — the `d` attribute is Catmull-Rom cubic segments, so tests read `data-points`, never parse `d`), `:606-650` (other-positions overlay uses `drawnData`)
- Test: `src/features/chart/__tests__/LevXChart.test.tsx`

Checkpoint dots, guides, hover labels, crossing detection, `MarketMiniChart` and `fitDataDomain`/`maxSpanMs` right-edge logic keep using `path.data` (six points).

- [ ] **Step 1: Tests** (with `buildAiPathFixture` plus `displayData` from the Task 1 fixture scaled to the test market):

```ts
it('draws the dense series when a path has displayData', () => {
  render(<LevXChart ... predictions={[withDense]} nowTime={startTime - 1} />)
  const el = screen.getByTestId('prediction-path')                           // nowTime before start → one future segment
  expect(el.getAttribute('data-series')).toBe('dense')
  expect(el.getAttribute('data-points')).toBe('11')                           // 11 points, not 6
})
it('falls back to the six points without displayData', ...)                     // data-series 'checkpoints', 6 points
it('cuts a dissolved dense path at the dissolving checkpoint', () => { /* dissolvedAtCheckpoint 3 → last drawn time == checkpointXs[2]; × at that point */ })   // Review Focus 4
it('splits elapsed and future at a nowTime between dense points without a gap', () => { /* elapsed last point time === future first point time === nowTime */ })  // Review Focus 5
```

- [ ] **Step 2: Run** `vitest run src/features/chart/__tests__/LevXChart.test.tsx` → FAIL (`prediction-path` testid absent).
- [ ] **Step 3: Implement** — a `seriesOf = (path) => path.displayData ?? path.data` helper used by `dissolvedPathData`, `drawnData` and the three render sites.
- [ ] **Step 4: Run** the chart tests and `pnpm test:run` → PASS; `pnpm lint` → no new problems.
- [ ] **Step 5: Commit** — `feat(chart): draw AI paths at model resolution when the display record agrees with the chain`

---

### Task 4: Scoring defaults as one module (W1.7, admin side)

**Files:**
- Create: `src/lib/scoringDefaults.ts`, `src/lib/solana/createMarketParams.ts`
- Modify: `src/routes/pages/AdminPage.tsx:392-394` (form defaults from `SCORING_DEFAULTS`), `:552-568` (params via `buildCreateMarketParams`)
- Test: `src/lib/solana/__tests__/createMarketParams.test.ts`

**Interfaces:**
- Produces: `SCORING_DEFAULTS = { actionAlpha: 0.7, actionBeta: 0.3, decoherenceRate: 0.5, minimumProbability: 0.01, nudgeRate: 0.05, lambda: 0, referenceAction: 1.0, weightQv: 0.375, weightDd: 0.375, weightEndpoint: 0.125, weightDisplacement: 0.125 }` with a comment: "mirror of the pipeline's `SCORING_PARAMS` (levx-infra `integrations/market_create.py`) and LevXv2 `scripts/scoring-defaults.ts`; the honest-paths study fills referenceAction, decoherenceRate, minimumProbability"; `buildCreateMarketParams(input: { pair, startTime, endTime, checkpointInterval, pathMaxAge, targetNumPaths, decoherenceRate, minimumProbability, nudgeRate, lambda }): CreateMarketParams` (the BN object the AdminPage builds today, weights and alpha/beta/referenceAction from `SCORING_DEFAULTS`).

Note: the admin page's weights today are 0.25 each while the pipeline and every devnet market use 0.375/0.375/0.125/0.125; this task aligns them to the pipeline.

- [ ] **Step 1: Test** — `buildCreateMarketParams` with the defaults yields `referenceAction.toNumber() === 1_000_000`, `weightQv.toNumber() === 375_000`, `decoherenceRate.toNumber() === 500_000`, `minimumProbability.toNumber() === 10_000`; the four weights sum to `1_000_000`.
- [ ] **Step 2: Run** → FAIL (modules missing).
- [ ] **Step 3: Implement**; AdminPage's `useState` defaults become `String(SCORING_DEFAULTS.decoherenceRate)` etc.
- [ ] **Step 4: Run** `pnpm test:run`, `pnpm types` → PASS.
- [ ] **Step 5: Commit** — `refactor(admin): scoring defaults in one module, aligned with the pipeline's weights`

---

### Task 5 (deferred — after the owner picks a preset): fill the chosen values

- [ ] Update `SCORING_DEFAULTS.referenceAction/decoherenceRate/minimumProbability` to the preset, cite the study report and preset in the comment, update the Task 4 test's expected numbers, run the suite, commit `feat(admin): scoring parameters from the honest-paths study (<preset>)`.
