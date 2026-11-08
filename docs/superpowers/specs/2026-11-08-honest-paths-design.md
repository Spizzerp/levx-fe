# Honest paths — design (package A of decision C)

**Date:** 2026-11-08 · **Owner decision:** package C of the 2026-11-08 options review: do A now, the
protocol grid change (B: 12 × 5-min checkpoints, grid shift) as its own project afterwards, designed on
A's data. · **Repos:** levx-infra (pipeline, keeper-mode2), levx-fe (chart), LevXv2 (research).
**Status:** draft for the owner's review. Plans follow per repo.

## 1. Intent

The market chart exposed three defects, only one of them cosmetic:

1. **The AI paths are a fabricated fan.** Since 2026-05-10 (levx-infra `da313ad`, "widen tight
   scenario path clouds") the pipeline's `enforce_terminal_spread_floor` has put every candidate
   path's end point on a rank-ordered, evenly spaced grid from −7.5 % to +7.5 % and bent each path
   onto it with a straight ramp in log space (`scenario_terminal_spread_floor_bps = 1200`). In all 273
   K3 artifacts the post-floor terminal sigma is exactly 4.33 % (the sigma of a uniform grid over
   ±7.5 %); the model's own spread is replaced, not widened. The five selected paths therefore end at
   about −6.1 / −4.3 / 0 / +3.5 / +5.9 % every hour while the realized 50-minute move has sd 0.46 %
   (median |move| 0.19 %, max 1.82 % over 74 markets). The ramp step (up to 1.25 % per checkpoint)
   swamps the model's own movement (0.15 % per step), which is why the paths are straight lines.
2. **The model underneath is roughly right.** Before the floor, the Glim ensemble + copula cloud has a
   terminal p10–p90 of about 1.3 % for an hourly SOL market. Over the 74 usable K3 markets the realized
   outcome fell inside the model's p10–p90 band 91–93 % of the time (target 80 %); the z-score sd is
   0.79–0.83. The model is 1.2–1.3× too wide — conservative, not broken. Its per-step movement (mean
   |step| 0.15 %) matches the realized 10-minute step (mean |step| 0.15 %, sd 0.21 %).
3. **Scoring barely separates the paths.** Running the program's own formulas over the 74 markets'
   realized prices: today's five paths finish within ~4 composite points (of 100) of each other and
   the best path's bettors receive 20.6 % of the Mode 1 pool against 20 % for an even split; a
   stylized honest menu widens that to ~20 points and 23 %. No path dissolves in either case
   (0 of 370). Cause: `reference_action = 1.0` needs a cumulative squared relative error of order
   100 % before the exponential bites (realized cumulative action is ~2 × 10⁻⁴ for honest paths,
   6 × 10⁻³ for the fan); `decoherence_rate = 0.5` and `minimum_probability = 1 %` are sized for
   deviations of tens of percent. These are per-market parameters set at market creation; the
   programs need no change. Mode 2 inherits them: the custody program copies the Mode 1 market's
   params into the cohort (`programs/levx-mode2/src/instructions/cohort.rs`), and the frozen
   scorer takes them as inputs.

Two timing bugs found alongside: the provider gateway tells external providers that checkpoints
fall at `start + (i+1)·interval` while the program scores at `start + i·interval`
(`provider_gateway.py` `_context_times_are_consistent`); and checkpoint 0 is scored at the market
start, the last 10 minutes never. The first is fixed here; the second is part of project B.

Consequences today: Mode 1 pays nearly everyone back; Mode 2 resolves on the fan's fixed geometry
rather than the forecast (the middle path's index is highest almost every hour, four of five offers
are near-certain losers); K3 run 1 (markets 86–185) measured the fan, not input freshness.

## 2. Goals, non-goals, anti-goals

**Goals**

- G1. Paths on chain are the model's forecast: the candidate cloud is never regridded; any widening
  is proportional and bounded by a volatility-derived minimum.
- G2. The chart draws each AI path at the model's native resolution (5-minute steps for hourly
  markets), passing exactly through the six scored checkpoints, which stay marked.
- G3. Mode 1 scoring rewards the right path: in a typical hourly market the best path's bettors
  receive a materially larger share than an even split, and a path that is clearly wrong by
  mid-market loses amplitude; parameter values come from a study on real outcomes, not guesses.
- G4. The Mode 2 oracle window survives the free feed's slow spells (observed 5-minute cadence on
  2026-11-03): no first-checkpoint misses at a 300 s publish gap.
- G5. Every change is observable on devnet before any rerun of K3: five pilot markets with the new
  pipeline and parameters, checked on chain.

**Non-goals (this package)**

- Changing checkpoint count, interval or grid (project B). Changing either on-chain program.
- Changing the scenario selectors, the LP terms (fees, caps, entry-level multipliers) or the
  K2/K3 methodology beyond recording run 1 as void. LP terms are re-derived in a follow-on once
  honest data exists.
- A 1-minute display path. The model's step equals its input-history step; a 1-minute display
  would mean a 1-minute model, which is a calibration project of its own.
- Mainnet anything.

**Anti-goals**

- Any code path that fabricates path shape or spread for visual effect, at any constant.
- Drawing points on the chart that are not the model's output (no client-side interpolation
  presented as forecast).
- Changing scoring parameters without the study's table in front of the owner.

## 3. Constraints

- Mode 1 program (devnet `LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV`): checkpoint `i` is due at
  `start_time + i·checkpoint_interval`; `grace_period` is 300 s for sub-hourly intervals; scoring as
  in `levx-math::quantum` and `score_path.rs` (relative deltas in 6-dp fixed point; composite =
  `exp(−action/reference)` reduced by the weighted feature penalty; payout ∝ composite × exposure).
- Mode 2 program (`A6TNLq28eHjhgvzoYN2FTxGvwEB2j9XWakcED3oEUfbJ`): cohort oracle `grace` must satisfy
  `0 ≤ grace < checkpoint_interval`; scoring params are copied from the Mode 1 market at cohort
  creation; the frozen scorer (`levx-mode2-core::score`, `scorer-lock.json`) is hash-locked in
  source but parameterized by those inputs — no lock change for a parameter change.
- Pipeline: Glim returns nine deciles per step; samples are synthesized from quantiles (AR(1) ρ=0.4);
  provider horizon ≤ 256 steps; history step = model step (5-minute candles today); K3 artifacts
  (`k3/<market>/<lead>.json`) and the daily `sweep_path_outcomes` continue unchanged.
- keeper-mode2: terms file is `keeper-mode2/terms/rehearsal.json`, baked into the image; the
  sponsored-feed attempt engine records an eligible update as soon as it sees one (poll 5 s) and
  takes a final read at `due + grace + 15 s`; `maxUpdateAgeSec = 120`.
- Frontend: paths come from the chain (`anchorPathToFE`), the price line from the pipeline's
  `/api/v1/candles` plus the live trail; the pipeline is reachable at `APP_API_BASE_URL`; the chart
  already draws settled checkpoint prices as labelled dots and faint guides for future checkpoints.
- Process: every repo ships via PR; implementers are Opus 5.5 subagents, reviews on Fable (owner's
  standing rule); subagents never run cluster scripts, never see secrets, never deploy. Railway and
  on-chain actions are the owner's or the controller's on the owner's word. Pipeline test output is
  read with `--tb=line` and redacted.
- Data available for the study: 74 usable K3 markets (realized Mode 2 observations at all six
  checkpoints, Mode 1 settled) in `LevXv2/.claude/worktrees/k3-final/research/k3-staleness-2026-10/data`
  (uncommitted copy), plus Coinbase candle history for any range.

## 4. Decisions

### W1 — Pipeline: honest cloud, dense path, as-of runs, gateway fix (levx-infra)

**W1.1 Spread shaping.** `enforce_terminal_spread_floor` no longer regrids. When the candidate
cloud's p10–p90 terminal spread is below the floor, every path's cumulative log-return is multiplied by
`floor / current_spread` (one scalar for the whole cloud); shape, ordering and per-step movement are
preserved. The floor is a **backstop against degenerate model output, not a calibration device**:
`_scenario_terminal_spread_floor` = `max(configured_bps, scenario_vol_floor_fraction × 2.56·σ·√T)`,
capped by `scenario_terminal_spread_cap_bps`, with `scenario_terminal_spread_floor_bps` defaulting
to **0** and the new `scenario_vol_floor_fraction` defaulting to **0.25**. At full strength the
volatility floor (`2.56·σ·√T` ≈ 1.3 % for an hourly SOL market) would bind on most honest clouds and
push a model that is already 1.2–1.3× too wide further out; at a quarter of it (≈ 0.3 %) it binds
only when the cloud is implausibly narrow for the regime. `.env.example` files follow. The 5σ√T
return cap and its order (cap, then floor) are unchanged. Tests: the two floor tests are rewritten
for proportional widening (spread lands on the floor; the ratio of any two paths' log-returns is
unchanged; a cloud above the floor is untouched); a new test pins the default floor at a quarter of
the volatility floor and the bps floor at 0. Log event `scenario_spread_floor_applied` gains
`scale_factor`, and the audit artifact's `quality` block records `sigma_garch`, `spread_floor` and
`scale_factor` (1.0 when the floor did not bind), so the pilot and the study can count how often it
binds.

**W1.2 Native-resolution paths (the stage reorder).** Today raw samples are interpolated onto the
six checkpoint times *before* the copula, so nothing downstream has more than six points. New order:

1. Build the **dense grid**: model steps from the last history timestamp through the last
   checkpoint, with every checkpoint time inserted where it is not already a grid point (for hourly
   markets: 5-minute steps plus the six 10-minute checkpoints, which coincide). Raw samples are
   interpolated onto the dense grid (same `np.interp` anchored at spot as today).
2. Copula, jumps, return cap and spread floor run on the dense grid; `dt` is the model step in years
   (jump intensity per step scales accordingly).
3. Scenario selection, the quality gate, labels and probability buckets run on the dense grid, with
   "terminal" defined as the last checkpoint time (dense points past it are not generated).
4. Packaging takes each selected path's values **at the checkpoint times** (exact grid points, no
   interpolation) for the chain, tolerance bands as today.
5. The selected paths' dense versions are persisted as the **display record** (W1.3).

Acceptance: a dense path's values at the checkpoint times equal the on-chain prices to the
6-dp integer; with a dense grid equal to the checkpoint grid the pipeline reproduces today's
behaviour exactly (regression test on a fixed seed).

**W1.3 Display record and endpoint.** On every production generation (and regeneration) the
pipeline writes `display/<market_id>.json` to the generation-audits bucket (upsert, via the
existing `persist_generation_audit_artifact(object_path=…)`), containing: `market_id`,
`generated_at`, `start_time`, `checkpoint_interval`, `total_checkpoints`, and per submitted path
`{path_index, times: [unix s], prices: [u64 6-dp], checkpoint_indices: [int]}` where
`checkpoint_indices[j]` is the dense index of checkpoint `j`. K3 extra-lead runs do not write it.
New route `GET /api/v1/markets/{market_id}/display-paths` reads the record from the bucket with
the service role in-process, caches it in memory for 60 s, answers 404 when absent, and sets
`Cache-Control: public, max-age=60`. Same CORS posture as `/api/v1/candles`. The `path_index` in the
record is the on-chain index, taken after submission: in the provider-gateway path the scheduler
learns it from `submit_selection_run_menu`'s result (as `_record_k3_submission` does today), so the
record is written by the scheduler after submission, not inside `generate_paths`.

**W1.4 As-of generation (for the study).** The one-shot CLI gains `--as-of <unix seconds>`,
reproducing what the live pipeline saw at that instant **without look-ahead**. A live run at
`T−300 s` sees every closed candle plus the bucket that opened at `T−300`, still partial, whose close
is the live spot at that moment. A historical fetch with `to_ts = as_of` would return that bucket
*completed* — its close is the price at `T`, checkpoint 0's realized value — and every honest menu
in the study would carry five minutes of look-ahead. So an as-of run collects candles with bucket
timestamp `< as_of` (closed) and appends one synthetic partial bucket at `as_of` whose
open = high = low = close = the open of the bucket that starts at `as_of` (the price at `T−300`);
`data_source.as_of = {at, convention: "closed-candles+open-anchor"}` is recorded. `run_started_unix
= as_of`; the Glim request is unchanged except that the idempotency key's alias carries an `asof`
suffix so a re-run cannot collide with the live run's key or a previous attempt. Submission is
refused (the flag is incompatible with `--on-chain` submission and with the scheduler); the audit
artifact is written locally. Market parameters come from the chain when `--market-id` names an
existing devnet market (read-only, decoded as `scheduler.py` decodes `Market`).

Glim has no recency constraint on `series.last_timestamp` in its recorded contract, but the server
has never been asked for a historical anchor. Before the study batch the controller runs **one**
as-of request against a settled market (dry run) and checks the artifact's `model.status`; if Glim
refuses or clamps, the fallback is to send `last_timestamp = request time` with the historical
series (the models are stateless in time; frequency and horizon are what they use) and to record
that deviation in `data_source.as_of`. The owner tells the Glim operator before the batch (~74
markets × 2 models).

**W1.5 Gateway grid.** `_context_times_are_consistent` and
`_provider_market_context_from_market` use `start + i·interval` for `i in 0..N`. A migration note
in the provider docs; no external provider has submitted to a live market, so no data migration.

**W1.6 Labels.** `labeling.py` thresholds are absolute (±5 % direction, 15 % drawdown, 30 %
parabolic) and would label every honest path "neutral choppy". Direction and character become
relative to the candidate cloud: direction from the path's terminal return as a z-score within the
cloud (≤ −0.5 bear, ≥ +0.5 bull, else neutral); drawdown and vol thresholds as multiples of the
cloud's medians. Label names unchanged. (My call; the owner can rename later.)

**W1.7 Market creation parameters.** `integrations/market_create.py` takes `reference_action`,
`decoherence_rate`, `minimum_probability` (and keeps `nudge_rate`, weights) from a single constants
block with a comment citing the study report (W3). Values are filled in from the study; until then
the PR carries today's values and the block. The same values go into the levx-fe AdminPage
defaults (`src/routes/pages/AdminPage.tsx` currently hard-codes `referenceAction = 1·SCALE`,
`weightQv 0.25`, and form defaults 0.5 / 0.01 / 0.05) and LevXv2's devnet scripts that create
markets, so every creator agrees.

**W1.8 Quality gate.** Constants stay (`_MIN_MEANINGFUL_CANDIDATE_SPREAD 0.01`,
`_MIN_SELECTED_SPREAD_COVERAGE 0.45`, `_DIRECTIONAL_SUPPORT_THRESHOLD 0.005`); tests add honest-sized
clouds (p10–p90 of 0.6 % and 1.3 %) and assert the gate passes them.

### W2 — Frontend: draw the dense path (levx-fe)

- `PredictionPath` gains optional `displayData: PricePoint[]` (unix ms, price). `MarketPage` fetches
  `/api/v1/markets/{id}/display-paths` with TanStack Query (stale 60 s; disabled when
  `APP_API_BASE_URL` is empty) and attaches `displayData` to each chain path by `path_index` **only if**
  the record's values at the checkpoint indices equal the chain's `predictedPrices` exactly;
  otherwise the path keeps six points (no partial use).
- `LevXChart` draws `displayData ?? data` for AI paths: the elapsed/future split at `nowTime` and the
  dissolution cut at the dissolving checkpoint operate on the drawn series; checkpoint dots, guides,
  hover labels, crossing detection for user-drawn paths, and `MarketMiniChart` stay on the six
  checkpoints. Points before `start_time` (the generation-to-start segment) are not drawn.
- The chart's "Checkpoints are scored" affordance is the existing dots and guides; no new copy.
- Tests: adapter (attach/refuse by checkpoint equality), chart (dense series drawn, cut at
  dissolution, fallback), hook (disabled without base URL).

### W3 — Scoring-parameter study and K3 record (LevXv2 `research/`)

**Inputs.** For each of the 74 usable K3 markets: the realized Mode 2 observations (six prices) and
an **honest menu regenerated as of `start_time − 300 s`** with the W1 pipeline (`--as-of`, Coinbase
history, live Glim; run by the controller, ~74 runs). The fan menus from the K3 artifacts are the
baseline.

**Engine.** The existing K3 Rust engine (`research/k3-staleness-2026-10/engine`, request
`{params, actual, sets}`) scores composites for any params — identical to `score_path` with
`first_active_checkpoint = 0`. A small Python model adds the Mode 1 dynamics the engine does not
have: amplitudes (equal start), per-checkpoint decoherence `ψ·(1 − Δp·rate)`, Born probability,
dissolution below `minimum_probability` with renormalization, and the parimutuel payout share
∝ composite × equal exposure. Unit-tested against hand-computed cases and against the formulas in
`levx-math` (the program's integer truncation is reproduced).

**Grid.** `reference_action ∈ {1e6 (today), 1e4, 3e3, 1e3, 300, 100, 30}` (fixed-point u64),
`decoherence_rate ∈ {0.5, 5, 20, 50, 100}`, `minimum_probability ∈ {1 %, 3 %, 5 %, 10 %}`;
`nudge_rate` and the four feature weights fixed at today's values (weights are a separate question).

**Metrics per cell (median and 10th/90th percentile over markets, honest menus unless stated):**
composite spread (max − min of five); best path's pool share; share of markets with ≥ 1
dissolution; **false dissolution** (the path that finishes with the best composite dissolved
before the last checkpoint); dissolution timing distribution; saturation (composites at 1 or at
SCALE); **Mode 2 rank stability** — whether the winner (highest composite, i.e. the top
`ResultStaged` index) and the full ordering change between the cell and today's parameters, and the
spread of the normalized indices — because the ordering is not invariant to `reference_action`
(the exponential and the feature penalty trade dominance) and the Mode 2 custody program pays on
that ordering; the same for the fan menus as a reference column. The honest menus are the W1
pipeline's output at its deployed defaults (W1.1 backstop included); the report states how many of
the 74 the floor touched.

**Presets.** The report names three parameter sets — *gentle*, *medium*, *sharp* — chosen as the
cells nearest these targets: best-path share of ~30 % / ~40 % / ~55 % in the median market, each
with false dissolution < 2 % of markets; medium is the recommended default. The owner picks one
before W1.7's values are filled in.

**K3 record.** `research/k3-staleness-2026-10/README.md` gets a dated run-record entry: run 1
(markets 86–185, 74 usable) is **void for its purpose** because the pipeline's spread floor made the
submitted sets a fixed fan; the interim numbers (per-lead mean loss +0.09 % / +0.19 % / −0.17 %,
95 % upper 1.0 % / 1.0 % / 0.7 %) are recorded for the record; run 2 starts after W1 and W1.7 are
deployed and the pilot passes (Stopping rule restarts at 100 with a new first-market id).

### W4 — keeper-mode2: oracle window (levx-infra)

`classes.hourly.cohort.oracle.graceSec` and `classes.daily.cohort.oracle.graceSec` go from 60 to
**300** in `terms/rehearsal.json` (the Mode 1 sub-hourly grace; the feed's slow cadence on
2026-11-03 was ~306 s, so one publish per window is near-certain). Checks the implementer must
show in tests or by citation: the program bound `grace < checkpoint_interval` (600) holds; the final
read moves to `due + 315 s`, still before `due + interval − LATE_READ_SEC`; `maxUpdateAgeSec 120`
applies from an update's publish time and the engine records on first sight, so a late publish is
not aged out; resolution timing (`terms-plan.ts`: terminal + maturity + review + slack) does not
depend on grace. `maxUpdateAgeSec` and the rest of the terms are unchanged. `lp/policy.rehearsal.json`'s
`termsSha256` is updated to the new terms file's hash (the shipped-files test enforces an exact
match). `keeper-mode2/terms/README.md`'s terms table is updated and gains a short note on the
2026-11-03 slow-feed incident (9 of 10 first observations missed at a 60 s grace) as the reason. The
change reaches devnet by redeploying keeper-mode2 and lp with the new image (owner's word); it
affects cohorts created afterwards.

### Rollout order and gates

1. **W4** (independent) — PR, merge in the quiet window, redeploy on the owner's word.
2. **W1 PR 1**: W1.1, W1.2, W1.3, W1.4, W1.5, W1.6, W1.8, W1.7 with today's values. Deploy to the
   devnet pipeline. No markets are scheduled, so no timing constraint.
3. **W3 generation batch** (controller runs `--as-of` for the 74 markets with the deployed code) →
   **W3 study** → owner picks a preset.
4. **W1 PR 2**: the chosen values in `market_create.py`; **levx-fe PR**: AdminPage defaults and W2;
   **LevXv2 PR**: scripts' defaults, the study, the K3 record. Deploy pipeline and frontend.
5. **Pilot**: `DEVNET_MARKET_SCHEDULE_COUNT` = created + 5 (owner sets). Pass criteria, checked
   from the chain and the display endpoint for all five: paths on chain equal the display record at
   checkpoints; `scale_factor` is 1.0 in at least four of the five (the backstop did not bind) and
   the spread is never 12 %; composite spread and best-path share in the study's predicted band for
   the chosen preset; zero Mode 2 first-checkpoint misses unless the feed's publish gap exceeded
   300 s; the chart shows dense paths through the dots with no console errors.
6. **K3 run 2** (100 markets) and, after it, the **LP terms re-derivation** as its own spec.

**Mode 2 money flows during the pilot and run 2 — owner decision 2026-11-08: keep flows on.**
keeper-mode2 and lp stay live with money flows on, on the current terms (derived against the fan).
The chosen preset is copied into every cohort, so the Mode 2 winner can move with it, and the LP's
exposure on honest paths is unknown until the re-derivation; devnet test-USDC losses in the pilot
and run 2 are accepted as the first honest LP data, the input the re-derivation needs. Observations
and K3 do not depend on money flows (an epoch with no admissions still records every checkpoint).
No rollout step changes the lp service except the W4 image redeploy. Design status: **approved by
the owner 2026-11-08**; plans follow per repo.

### Execution

Three plans (one per repo), written with `superpowers:writing-plans` from this document, executed
subagent-driven: Opus 5.5 implementers, Fable reviewers, one implementer at a time per repo,
`model` set explicitly on every dispatch. W1 and W4 can run in parallel worktrees in levx-infra
(different files); W2 depends on W1.3's response shape (frozen in §4 W1.3 so the FE plan can start
against a fixture); W3's generation batch depends on W1 being deployed.

## 5. Left to the builder

- Exact module boundaries for the dense grid (likely a `dense_grid.py` helper used by alignment,
  packaging and the display record), the display record's Pydantic model, the endpoint's cache.
- The Python Mode 1 dynamics model's structure and the study report's layout (Markdown + JSON like
  the K3 results).
- How `--as-of` obtains market params for a historical market (chain read of the Market account, as
  `scheduler.py` decodes it) and how it names the local artifact.
- Test fixtures for honest-sized clouds; the regression seed for W1.2.
- Frontend query key placement (`eventInvalidation.ts` per-market keys exist) and the fixture for
  the display record.

## 6. Risks

- **Honest paths look dull.** Five lines within ±1 % of spot. Mitigation: the dense path gives them
  real movement; the pilot is the owner's chance to judge before K3 run 2; project B's grid change is
  the structural answer, not a visual floor.
- **Parameter study optimizes against 74 markets of one pair and one month.** Presets are
  conservative on false dissolution; parameters are per-market and can be retuned without a
  program change.
- **The honest-menu stand-in in §1 was stylized.** The study uses real regenerated menus; §1's
  "~20 points / 23 %" is indicative only.
- **Glim re-forecasts differ from what the live run would have produced** (model drift, history
  source basis ≈ +7 bps Pyth over Coinbase). Acceptable for parameter selection; recorded.
- **Grace 300 s lengthens Mode 2's exposure to a stale first read** only in the sense that a late
  update is accepted later; the program's own eligibility check is unchanged.

## 7. Calls I made (for the owner to check)

1. The spread floor survives only as a backstop: proportional widening to a quarter of the
   volatility floor (`scenario_vol_floor_fraction = 0.25`), bps floor 0. At full strength the
   volatility floor would bind on most honest clouds (reviewer's arithmetic: ≈ 1.3 % vs the model's
   ≈ 1.3 %), which would contradict G1.
2. Display resolution = model-native (5-minute steps), not 1-minute.
2a. `--as-of` reproduces the live anchor without look-ahead: closed candles before `as_of` plus a
   synthetic partial bucket at the price at `as_of`; the Glim idempotency alias gets an `asof`
   suffix; one smoke request before the batch, with a documented fallback if Glim refuses
   historical anchors.
2b. The study reports Mode 2 rank stability per cell, so the preset is picked with the custody
   program's payout in view.
3. Scenario selectors unchanged; labels made relative to the cloud.
4. `medium` preset (best-path share ≈ 40 %) as the recommended default; owner picks from three.
5. Grace 300 s (not 240).
6. Display record served by the pipeline (bucket + endpoint), mirroring `/api/v1/candles`, rather
   than a Supabase table read by the frontend.
7. K3 run 1 declared void for its purpose; run 2 after the pilot.
8. The checkpoint-0-at-start question and the gateway's grid intent are resolved in favour of the
   program as deployed; the grid itself is project B.
