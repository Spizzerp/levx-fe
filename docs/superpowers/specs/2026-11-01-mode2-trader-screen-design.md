# Mode 2 trader screen: leverage on the market page

Date: 2026-11-01. Owner decisions are marked **(owner)**; calls made while writing this are marked **(my call)** for the owner to
check. The mockups are in the brainstorm session folder outside the repo
(`/private/tmp/claude-501/-Users-spizzerp-LevX-Parent/70827fc6-5f23-43c7-ae4f-99819e722fac/scratchpad/brainstorm-mode2/.superpowers/brainstorm/87496-1793541864/content/`:
`trade-panel-v3.html` and `position-card.html` are the accepted ones; the earlier `trade-panel*.html` show max loss as principal plus fee,
which §4.4 corrects).

Related: LevXv2 `docs/superpowers/specs/2026-10-06-mode2-funded-contract-design.md` (the contract),
`2026-10-18-mode2-live-entry-design.md` (v1.1: payoff §4.1, running index §3, live entry D1), `2026-10-26-mode2-late-binding-and-k3-design.md`
(v1.2: binding, the ~3-minute window, D16/D17), `2026-10-29-mode2-epoch-concurrency-and-class-consent-design.md` (v1.3);
levx-infra `keeper-mode2/terms/README.md`.

## 1. Why

Mode 2 (funded-contract leverage, the custody program `A6TNLq28eHjhgvzoYN2FTxGvwEB2j9XWakcED3oEUfbJ`) is live on devnet with money
flows: the keeper and the LP actor create a group for every money-epoch hourly SOL/USDC market, the LP funds it, and the keeper settles
and pays. In the rehearsals the traders were scripts. **No trader can open a Mode 2 position from the app today**: levx-fe has no
integration with the custody program at all. The "Mode 2" names in levx-fe (`useMode2Readiness`, `Mode2MarketReadinessCard`,
`Mode2StatusBadge`, `src/lib/mode2Status.ts`, the `market.leverageEnabled` slider in `MarketPage.tsx`, the admin page's leverage-config
tools) all belong to the superseded Mode 1 leverage overlay (`LeverageConfig` in the Mode 1 program), archived on 2026-10-06.

**What exists right now (read from devnet, 2026-11-01 14:58Z):** epoch 61 is Active with 200 USDC of LP cash; market 142 (hourly,
start 15:00Z, 6 checkpoints of 10 minutes) has a cohort of k = 5 AI paths and one bound group with two offers, 2× and 3×, each 10 USDC
of collateral per position, profit caps 20 and 10 USDC, capacity fees 0.10 and 0.20 USDC, 16 admissions each, expiring at the start.
The epoch mint is test USDC `6xz4…Jkhz`, the mint the app already uses. Under v1.2 every second hourly market carries a money epoch;
v1.3 change 1 (after the K3 final analysis) makes it every market.

**The moment this serves (owner):** a trader on the market page before the start slides leverage from 1× to the maximum, watches the
dollar value they are trading with grow, sees a small breakdown of the position, and opens it with one signature.

## 2. Owner decisions

| # | Decision |
| --- | --- |
| T1 | **Maximum 4× for now, one group per market.** A group fits 24 offer-and-path pairs and 8 per path, so with every offer open on all 5 paths it holds 4 offers: 1×, 2×, 3× and 4×. |
| T2 | **Every slider stop is a Mode 2 position; 1× is Mode 2 with no leverage**, not a normal (Mode 1) bet. |
| T3 | **Mode 2 winners are paid by the LP, not from the Mode 1 pool.** Mode 1 payouts stay identical with or without Mode 2 (funded-contract design, invariant 9). |
| T4 | **Build the screen now, for pre-start entry. Live entry (D1: open after the start until 80% of checkpoints) is the next project**, brainstormed after this design is approved. The screen is built so live entry extends it (§9). |
| T5 | **A smooth slider in 0.1 steps from 1.0× to 4.0×, drawn like today's `SegmentedSlider`** (small ticks, 2 px gaps, a taller thumb, the lime-to-green fill), not as four wide blocks. A step between whole numbers is built by splitting each path's principal between the two neighbouring whole-number offers (§4.2). |
| T6 | **The LP unit (collateral per position) changes from 10 USDC to 1 USDC**, so any principal in steps of 10 USDC reaches every 0.1 step exactly (§7). |
| T7 | **Several paths per order, like today's bet: one slider and one principal apply to every selected path.** The breakdown shows the shared rows once, one dropdown per path, and totals (mockup `trade-panel-v3.html`). |
| T8 | **The breakdown rows: market, duration, leverage, principal, value with leverage, max win, fee, max loss.** Fee and max loss were proposed in the mockup review and kept. |
| T9 | **After opening, a position card with a live estimate** of what the positions would pay if the market settled at the last recorded checkpoint, and the end states Result in, Paid and Voided (mockup `position-card.html`). |
| T10 | **Payout needs no action from the trader**: the keeper already calls `claim_positions` for every receipt, paying the owner's token account. No claim button. The keeper finds receipts by scanning the program, not from a list of known owners (`keeper-mode2/src/money/discovery.ts`), so app traders are paid like the rehearsal's. |
| T11 | **The estimate starts at the fourth recorded checkpoint**, the scorer's own minimum (`MIN_CHECKPOINTS = 4`, the rule v1.1 §4.2 already states for the running index). **For a partial window the reference action is scaled as the Mode 1 scorer scales it**: `max(1, floor(reference × (j + 1) / T))` (§6.3). |
| T12 | **The LP's prices for 1×–4×** per 1 USDC position: fees 0.005, 0.01, 0.02 and 0.03 USDC; profit caps 1, 2, 3 and 4 USDC (the value with leverage, as today's 2× offer). The LP actor's policy moves with them: `maxLeverage` 4, `minCapacityFee` 0.005 USDC (§7). |
| T13 | **The screen ships behind a switch**, off on the live site until the app devnet proof (§8) passes, on locally and in preview builds (§4.6). |

## 3. Goals, non-goals, anti-goals

**Goals.**

1. On a market whose Mode 2 group is open, the trade panel shows the leverage section: a countdown to when entry closes, the slider, the
   principal per path, the breakdown and one button that opens every selected path's position in one transaction signed by the trader.
2. Every number on the panel is the number the program will use: max win, fee and payout come from the client's own payoff functions,
   never re-derived in levx-fe.
3. An order that would be refused on chain is caught before the wallet prompt (§4.5). Inside a 3-minute window a refusal after signing is
   the worst outcome this screen can produce.
4. After opening, the trader sees their positions, an estimate while the market runs, the final result once the keeper stages it, and
   the payment once it lands.
5. The screen is driven by the offers on chain. It works today on the 2×/3× offers at 10 USDC and, unchanged, on 1×–4× at 1 USDC once the
   LP terms change (§7).
6. Nothing changes on the live site until the owner turns the switch on (T13, §4.6).

**Non-goals.** Live entry (T4); any change to Mode 1 or to the payoff, reserve, scorer or buckets; a different leverage per path in one
order; an LP-facing screen; Mode 2 on user-drawn or third-party paths (v1.2 D16/D17: cohorts hold the market's first `k` AI paths only);
the admin page's legacy leverage-config tools (left as they are; §10).

**Anti-goals** (failures even if the screen works):

- A max loss, max win or fee on screen that differs from what the program charges or pays.
- A slider stop that cannot be filled exactly with the principal entered, shown as if it could.
- An estimate presented as a promise, or shown before it means anything (§6.3).
- The trader confusing a Mode 2 position with a normal bet: the two never share a panel at the same moment (§4.1).

## 4. The trade panel

### 4.1 Where and when

The panel is the market page's right rail, where the bet panel is today. Normal bets are accepted only while the Mode 1 market is Active
or Sampling (`place_wager.rs`), and Mode 2 admission only while it is Pending and before the cohort's start (`admission.rs`: `now <
epoch.admission_cutoff && now < cohort.start_time`, `market.state == Pending`). So today the two never overlap, and one panel switches at
the start; no tabs or mode toggle **(my call, accepted in the mockup review)**.

| Market state | What the rail shows |
| --- | --- |
| Pending, no Mode 2 cohort or no group | Today's panel, unchanged. |
| Pending, group created but not yet bound (paths not uploaded) | Today's panel plus a line: "Leverage opens when the paths arrive, about 3 minutes before the start" **(my call)**. |
| Pending, group bound, entry open | The leverage section (below), replacing today's collateral input and button. |
| Active/Sampling, the market had a group | Today's bet panel with one line: "Leverage closed at the start". |
| Any later state | Today's rails, plus the position card (§6) when the trader holds Mode 2 positions. |

Entry is open while `now` is before the earliest of `cohort.start_time`, `epoch.admission_cutoff` and each offer's `expires_at`, the group
is bound (`bound_at > 0`), the program is not paused and at least one offer has room. Today the window runs from the bind (about T−3:20;
the U7 rehearsal bound at start−202 s) to the start.

This replaces, on the market page, the legacy `market.leverageEnabled` slider block and the `Mode2MarketReadinessCard` **(my call)**; both
belong to the superseded overlay.

### 4.2 The slider

The existing `src/ui/SegmentedSlider.tsx` is reused: it already accepts a `values` list, draws one tick per value and snaps the thumb
while dragging. It has no way to draw a tick as disabled, so it gains a small extension for the rule below (a set of disabled values,
drawn dimmed and skipped by clicks and drags); its current callers are unaffected **(my call)**. The value label above it shows one decimal ("2.4×"); the scale under it reads "1× … 4× max · 1h" from the market's
duration, as today.

**Values come from the offers (my call).** Let `L_1 < … < L_n` be the leverages of the group's offers that are open on the selected paths.
The slider runs from `L_1` to `L_n` in 0.1 steps. A value `L` with `L_a ≤ L ≤ L_(a+1)` is filled from those two neighbours:

```text
units      = principal / C                       (C: the offers' collateral per position; all offers in a group share it, §7)
units_hi   = units * (L - L_a) / (L_(a+1) - L_a)  (must be a whole number)
units_lo   = units - units_hi
```

The principal moves in steps of 10 USDC **(owner)**. Every 0.1 value is exact when the neighbouring offers are consecutive whole
numbers and the principal is a multiple of `10 × C`, which every principal is at the 1 USDC unit. So **the terms must offer every whole
number from the lowest to the highest leverage** (§7). A value the principal cannot fill exactly (`units_hi` not whole) is drawn
disabled. At the 1 USDC unit that never happens; on today's offers (2× and 3× at 10 USDC) the slider runs 2.0×–3.0× and a 20 USDC
principal reaches 2.0, 2.5 and 3.0 only. A whole-number value uses one offer. A path order of `L` is therefore up to two program
orders, `(offer_lo, path, units_lo)` and `(offer_hi, path, units_hi)`.

A tick whose split would overflow an offer's remaining admissions, the group's remaining positions or a cap (§4.5) is drawn disabled and
cannot be selected; if the current value becomes disabled, the thumb moves to the nearest enabled value and a line says why **(my call)**.

**The mixed payoff (for the record).** A split pays exactly like a single position at `L` while both parts are between zero and their
caps. In a heavy loss the higher-leverage part reaches zero first, so the trader loses slightly less than at a true `L`; near the top
the two parts reach their caps at different moves. Max win, fee and max loss are the sums of the parts.

### 4.3 Principal and paths

The principal input is the existing `Input` with the unit "USDC" and the hint "In steps of 10 USDC", labelled "Principal
per path" when more than one path is selected. A value off the step is rounded down on blur, showing the rounded value **(my call)**.

Path selection stays in the existing path list, up to 4 paths as today. Only cohort paths can take leverage: the cohort holds the market's
first `k` AI paths, and an order names a path by its **cohort slot**, not its Mode 1 path index; the slot-to-index map comes from the
cohort's forecasts. A selected path outside the cohort (user-drawn, `External`, or beyond `k`) is listed in the breakdown as "Not
available with leverage" and left out of the order **(my call)**.

### 4.4 The breakdown

The box under the principal (mockup `trade-panel-v3.html`):

- **Shared rows:** Market (`SOL/USDC`), Duration (e.g. "1h · 14:00 → 15:00").
- **One dropdown per path**, the first open by default **(my call)**. Collapsed: "Path 1 · LONG, max win +X". Open: Leverage, Made of
  ("30.00 at 2× + 20.00 at 3×"; shown only for a split, **my call, kept in the review**), Principal, Value with leverage, Max win, Fee,
  Max loss.
- **Totals:** total principal, total value with leverage, total max win, total fee, total max loss.

Definitions, per position (one unit of `C`) at its offer and its path's bound entry level `e_k` (`NettingGroup.entry_levels`), from the
v1.1 payoff (§4.1 of that spec) as the client implements it (`quantitiesAt`, `payoffAt`):

| Row | Value |
| --- | --- |
| Value with leverage | `principal × L` (the sum of `count × C × L_offer` over the parts) |
| Max win | `P_eff − F` per position, `P_eff = quantitiesAt(quote, e_k).effectiveCap`. It differs by path: a more likely path has a higher entry level and a smaller cap. |
| Fee | `F` per position, labelled "taken from the payout". The fee is not paid up front: at settlement `f = min(F, W)` comes out of the payout. |
| Max loss | **the principal.** If a position loses everything, `W = 0` and no fee is charged. |

The earlier mockups showed max loss as principal plus fee; that was wrong (found while reading `levx-mode2-core/src/payoff.rs`). The
protocol's share of the fee (`protocol_share_bps`) comes out of `F`, not on top, so it is not a separate row.

### 4.5 The button, the pre-check and the transaction

The button reads "Open Position at 2.4×" or "Open 4 Positions at 2.4×", inside the existing `ConnectGate`.

**Pre-check before the wallet prompt.** All of these are read from chain and checked in the browser; a failing check disables the button
with a one-line reason:

- Entry still open (§4.1), with a margin for the time a signature takes: the button disables 10 s before the close **(my call)**.
- Each offer's `admitted + count ≤ max_admissions`; the group's `positions + total ≤ caps.max_group_positions`.
- The notional caps: `max_path_notional`, `max_cluster_notional` (the cohort's cluster map), `max_market_notional` (the cohort's
  `notional_total`) and `max_pair_notional` (the epoch's `PairExposure`).
- The reserve: the group's book after the order (`bookAfter`) and its reserve (`reserveFor`, with the group's policy) fit
  `max_group_reserve`, and the epoch's reservation after it fits both `max_epoch_reservation` and the epoch's LP cash.
- The trader's USDC balance covers the total principal, and their SOL covers a new receipt's rent (first admission in this group) plus
  fees. The rent comes back when the keeper pays the receipt; the panel says so in one line **(my call)**.

**The transaction.** One `admit_batch` instruction from the client's `admitBatchIx` builder, with the trader as **the fee payer and the
only owner** (owner index 0), the trader's associated token account for the epoch mint, their receipt PDA (`[m2-position-v1, group,
owner]`), each order's `offer_digest` copied from the group's offer, and the compute ceiling the client gives for the group's policy
(`CU_CEILINGS.admitControl` / `admitCertified`). The client's `admission()` planner is **not** used: it requires a keeper fee payer distinct
from every owner, a rule of the keeper's batching flow, not of the program (`AdmitBatch` has no keeper signer). Four paths split across
two offers make 8 orders, within `MAX_BATCH_ORDERS` (16); the plan checks with the client's `fit` that 8 orders from one owner fit one
transaction, and caps the paths per order at what fits if not.

The instruction is converted to a web3.js `TransactionInstruction` through the client's compat fields and sent the way the app sends its
other transactions (`buildTransaction`, `getPriorityFee`, `provider.sendAndConfirm`, `translateError`). Program errors are mapped to plain
messages through the client's generated error codes (`DeadlinePassed`: "Entry closed before your order landed", `Capacity`: "That
leverage step just filled up", and so on); the full list is the plan's.

**Never proven: the trader as fee payer.** Every rehearsal admission had a keeper fee payer. Nothing in the program forbids payer =
owner, but the first such admission is a step of its own (§8).

### 4.6 The switch (owner, T13)

The leverage section and the position card render only when `APP_MODE2_TRADING` is `true` (Vite exposes `APP_`-prefixed variables;
`envPrefix: 'APP_'`). Off on the production Vercel environment until the app devnet proof of §8 passes, then the owner turns it on; on
in `.env.example`/local development and in preview deployments. With the switch off the market page is exactly today's, including
the legacy readiness card **(my call: the replacement of §4.1 happens behind the same switch, so turning it off restores today's page)**.
The reason is the LP actor's loss limit: at 200 USDC of cumulative loss it halts funding for every class (`keeper-mode2/src/lp/policy.ts`),
which would stop all money epochs, the v1.3 rehearsal's included.

## 5. Data the screen reads

All read-only, from the devnet RPC the app already uses, through the client's generated decoders and PDA helpers:

| Account | For |
| --- | --- |
| `Cohort` (`[m2-cohort-v1, market]`) | start time, checkpoints, `k`, cluster map, scoring params, `notional_total`, observations recorded, result state and staged indices, finality |
| `NettingGroup` (`[m2-group-v1, cohort, index]`, `group_count` of them) | offers, buckets, entry levels, `bound_at`, positions, reserves, state |
| `FundingEpoch` (`[m2-epoch-v1, epoch_id]`) | phase, caps, admission cutoff, LP cash and reservation, mint, policy |
| `PairExposure` | the pair's notional for the pair cap |
| `PathForecast` (one per slot) | the slot-to-Mode-1-index map; the forecasts for the estimate |
| `Observations` | the recorded checkpoint prices for the estimate |
| `PositionReceipt` (`[m2-position-v1, group, owner]`) | the trader's counts per bucket |

They are read with TanStack Query, refetched every 5 s while entry is open and the panel is visible, and on each Mode 1 checkpoint event
the app already listens for while the market runs **(my call)**.

The client package `@spizzerp/levx-mode2-client@0.5.0` is published on GitHub Packages (`npm.pkg.github.com`), as the keeper installs it.
levx-fe has no `.npmrc`: the plan adds one with the `@spizzerp` scope, and **the owner adds a read-only GitHub Packages token to the
Vercel project** (and to CI) before the first deploy that imports it.

## 6. The position card

### 6.1 Where

In the right rail: under the trade panel while the market is Pending or running, and beside the existing `UserPositionCard` in the
Maturing, Settled and Void rails. New code lives in a feature folder of its own, `src/features/mode2/`, not in `MarketPage.tsx`, which is
already 1,239 lines **(my call)**.

### 6.2 Content

Mockup `position-card.html`. A header "Leveraged positions" with a status chip; a summary "Worth now (estimate) 214.30 USDC +14.30"
against the principal put in; one dropdown per path, with that path's estimate on the collapsed row and the breakdown rows of §4.4 plus
"Worth now (estimate)" when open. Per path, the trader's buckets on that path (one or two offers) are shown as one position at their
combined leverage.

| Status | When | Summary shows |
| --- | --- | --- |
| Waiting for the start | admitted, before the start | the principal; "Estimate from checkpoint 4" |
| Running · checkpoint j of T, j < 4 | after the start, fewer than 4 observations | the principal; "Estimate from checkpoint 4" |
| Running · checkpoint j of T, j ≥ 4 | 4 or more observations, no result staged | the estimate (§6.3) |
| Result in | the cohort's result staged (`result_state`), group not funded | the final payout from the staged indices, "Paid to your wallet automatically after the review period" |
| Paid | the receipt is closed after `claim_positions` | the amount paid, read from the claim transaction in the receipt address's history **(my call)** |
| Voided | the group funded void | "Refunded to your wallet": the principal (void funding refunds collateral, `funding.rs`) |

### 6.3 The estimate

**What it is.** For each of the trader's buckets: `payoffAt(quote, e_k, v_sel(j))`, minus the fee as at settlement, summed over counts.
`v_i(j)` is the running index of the v1.1 spec §3: `s_i(j)` is the frozen shadow score of path `i` over checkpoints `0..j`, `D(j)` their
sum over the cohort, `v_i(j) = floor(S × s_i(j) / D(j))`. It updates after every recorded observation and is labelled "estimate: what
you would get if the market settled at checkpoint j; the final payout can be different".

**Nothing is shown before the fourth observation (owner, T11).** The scorer refuses a window below `MIN_CHECKPOINTS = 4`, and the
v1.1 spec (§4.2) already says no running index exists before the fourth observation. On an hourly market of 6 checkpoints the
estimate therefore appears after observations 4 and 5, and observation 6 brings the final result; on a daily market of 24 it runs from
observation 4. (Before any observation the index would be `p0` while each position's entry level is `e_k`, a payoff with no
observation behind it, which is a second reason to show nothing early.)

**How it is computed: the program's own scorer, compiled for the browser (my call).** `levx-mode2-core` is pure Rust with no
dependencies beyond `levx-math` (stdlib only). A small wrapper crate in LevXv2, built with `wasm-bindgen` and published to GitHub
Packages next to the client, exposes `new_shadow`, `observe_shadow`, `finish_shadow` and `indices` unchanged. This follows the K3 rule
(v1.2 D15) of using the frozen Rust scorer with no re-implementation, and it is the code live entry needs for its own running index.
The scorer source stays untouched; `fixtures/scorer-lock.json` still pins it.

**The prefix rule (owner, T11).** `finish_shadow` refuses a window that is not complete (`processed != expected`). The estimate runs
it on a shadow created for `j + 1 ≥ 4` checkpoints and fed the first `j + 1` observations, with the scoring params' reference action
replaced by `max(1, floor(reference × (j + 1) / T))`, the way the Mode 1 scorer scales it for a partial window (`score_path`:
`reference × (T − first_active) / T`; the port fixes `first_active = 0`). The wrapper builds that params value; the scorer source is
not edited. At `j = T − 1` the factor is 1 and the result is the terminal score bit for bit, and the plan proves
that parity against real staged results: a cohort's observations and staged indices captured before the keeper closes it (market
141's held 6 observations and staged indices on 2026-11-01), or rebuilt from transaction history as the K3 research does (v1.2 D18).
Live entry will store the same running index on chain, so this rule becomes protocol: the live-entry design adopts it (or replaces it
on the owner's word, and the estimate follows).

## 7. The LP terms change (levx-infra)

The screen reads whatever offers exist; for 1×–4× at 1 USDC (T1, T6) the terms file the keeper and LP actor use
(`keeper-mode2/terms/rehearsal.json`, schema `levx-mode2-pilot-terms-v3` on main) changes, in each class that serves traders:

- **Offers:** four, leverage 1, 2, 3 and 4, `paths: "all"`, `collateral` 1 USDC (`1000000`).
- **Caps:** `maxPositionCollateral` 1 USDC, `maxPositionNotional` 4 USDC.
- **Counts:** `maxAdmissions` per offer and `maxGroupPositions` raised about tenfold so the same money fits **(my call to propose,
  the owner's to set)**: today 16 and 32; proposed 160 and 320.
- **Profit cap `P` and fee `F` per step (owner, T12)**, per 1 USDC position:

  | Leverage | `capacityFee` | `profitCap` |
  | --- | --- | --- |
  | 1× | 0.005 USDC (`5000`) | 1 USDC (`1000000`) |
  | 2× | 0.01 USDC (`10000`) | 2 USDC (`2000000`) |
  | 3× | 0.02 USDC (`20000`) | 3 USDC (`3000000`) |
  | 4× | 0.03 USDC (`30000`) | 4 USDC (`4000000`) |

  The loader requires every offer to be a valid quote at both extremes of the group's entry-level row. With `P = N` that holds: the
  highest level in today's row is `1.053 × S / 5`, where the natural cap is about `3.75 × N`.
- **The LP actor's policy (`lp/policy.rehearsal.json`) moves with the terms (owner, T12):** `maxLeverage` 3 → 4, `minCapacityFee`
  `100000` → `5000`, and `termsSha256` to the new file's hash. Without this, `withinPolicy` (`keeper-mode2/src/lp/plan.ts`) refuses every
  epoch that offers 4×, no group is bound, and the screen never opens at 1×–4×. `maxPositionCollateral` (10 USDC) already admits a
  1 USDC unit.
- `maxGroupReserve` (200 USDC) and the LP's deposit bound the total. Under the individual-profit-caps policy each position reserves its
  cap, so 200 USDC backs about 50 USDC of principal at 4× per market. Whether to deposit more is the owner's.

**Timing.** The terms are baked into the keeper-mode2 and lp images, and those images are not redeployed before the K3 final analysis (the
v1.3 hold). The change ships with the v1.3 rollout. Until then the screen runs on today's 2×/3× offers at 10 USDC, which is what it is
first built and tested against.

## 8. Verification

- **Unit tests (levx-fe, Vitest):** the split (§4.2) for every 0.1 value against principals in 10 USDC steps at both units (1 and 10 USDC), including the neighbours'
  edges and the disabled-tick rule; the breakdown numbers against the client's `quantitiesAt` and `payoffAt` on the live group's values;
  each pre-check; the status mapping of §6.2; the "no estimate before the fourth observation" rule and the reference-action scaling of §6.3.
- **Component tests (Vitest + Testing Library, queried by role and accessible name):** every rail state of §4.1; the slider's values and
  label; adding and removing paths; a dropdown opening; the button label and its disabled reasons.
- **Scorer parity (LevXv2):** the WASM build returns the Rust results bit for bit on the core's own score fixtures, and the full-window
  run on a real cohort's observations reproduces its staged indices.
- **Early devnet proof (my call; on the owner's word at that step, devnet only):** before the UI work, one scripted admission with a
  test keypair as both fee payer and owner, built with `admitBatchIx`, on a live money-epoch market. Nothing in the program forbids it
  (the owner is a writable signer in the remaining accounts and pays the receipt rent), but it has never run, and the whole screen
  rests on it.
- **App devnet proof (on the owner's word, devnet only, the owner signing with a test wallet in the browser):** on a live money-epoch
  hourly market with today's offers, open a 2.5× position on two paths from the app with the trader as fee payer; check the receipt and the bucket counts, the card through Running,
  Result in and Paid, and the paid amount against the staged result. Repeated at 1×–4× after the terms change.

## 9. What live entry will change

Live entry (D1) adds admission after the start in short windows after each checkpoint, a maximum leverage that falls as checkpoints pass,
and the 80% cutoff. On this screen: the leverage section stays in the panel after the start next to the normal bet, which then needs a
choice between the two (a design question for that project); the countdown shows the current window or "next window opens in…"; and the
slider's range shrinks as the offers on chain change. Because the slider and the pre-check read the offers and the entry times from chain,
those last two need no redesign.

## 10. Builder's calls and follow-ups

**Left to the builder:** component structure inside `src/features/mode2/`; the query keys and cache shape; the exact error copy; how the
WASM module loads (lazy, on first estimate); rounding display (2 decimals for USDC, 1 for leverage).

**Follow-ups, not in this project:** remove or rename the legacy overlay code (`useMode2Readiness`, `Mode2MarketReadinessCard`,
`Mode2StatusBadge`, `src/lib/mode2Status.ts`, the admin page's leverage-config tools), whose "Mode 2" names now collide with the real one;
an LP-facing view.

**Sequencing (my call).** Three plans, one per repo:

1. levx-fe: the trade panel, data layer, pre-check, transaction and position card without the estimate, against today's offers.
2. LevXv2: the WASM scorer package and its parity tests; the owner tags and publishes it. Then levx-fe adds the estimate.
3. levx-infra: the terms change of §7, with the v1.3 rollout.
