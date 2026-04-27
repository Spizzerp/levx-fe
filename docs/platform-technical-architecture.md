# LevX Technical Architecture

Last updated: 2026-04-27
Audience: public docs, frontend docs page, technical readers

---

## Overview

LevX is a path-prediction market protocol built on Solana. Instead of asking traders to predict only whether an asset ends higher or lower, LevX lets them trade on the shape of price movement over time. A market contains several possible future paths for a pair such as SOL/USDC, BTC/USDC, or ETH/USDC. Users back the path they believe the market will follow, and the protocol settles positions against verified oracle checkpoints.

The platform combines five core systems:

1. A Solana settlement program that escrows funds, stores paths, scores outcomes, and pays claims.
2. A path-market engine that tracks each market through creation, activation, sampling, settlement, disputes, and claims.
3. A pricing and scoring engine that blends LS-LMSR market making, quantum-inspired state tracking, exponential path scoring, and ELF-weighted settlement.
4. An AI path-generation pipeline that produces representative market scenarios while remaining outside the protocol trust boundary.
5. A keeper and frontend layer that submits oracle updates, cranks settlement, visualizes paths, and gives users an efficient trading interface.

The result is a market structure where users can express richer views than a binary up/down bet: trend, volatility, drawdown, recovery shape, and timing all matter.

---

## What Makes LevX Different

### Path-Based Markets

Most prediction markets collapse an outcome into a binary result or a terminal price bucket. LevX scores the whole route. A path can be right about direction but wrong about volatility, or close on the endpoint but wrong about the journey. The protocol captures that nuance through checkpoint-by-checkpoint comparisons and final multi-feature scoring.

### On-Chain Path Commitments

Predicted checkpoint prices are stored directly in Solana accounts. The program does not need an off-chain database, Arweave object, or Merkle proof to know what a path promised. Settlement can be reproduced from on-chain state and oracle attestations.

### Quantum-Inspired State Evolution

LevX tracks each path with an amplitude-like state. Market prices can initialize and update path amplitudes, and incorrect paths gradually lose amplitude through decoherence as observed price diverges from the prediction. Dissolution is continuous rather than binary: paths fade as evidence arrives instead of instantly flipping from live to dead.

This is not marketed as a physical quantum computer. It is a mathematically inspired market model that borrows useful concepts from quantum probability: amplitudes, Born-rule probabilities, decoherence, and renormalization.

### Graceful Losses

A dissolved path can receive a partial payout based on how long it survived and how much market support it had before dissolution. This gives value to being partially right and makes the product feel more like trading a dynamic thesis than buying a lottery ticket.

### AI as a Competitive Path Layer

LevX ships with an AI pipeline that generates five representative future paths per market. The protocol does not need to trust that service. AI-generated paths and user-drawn paths are both just on-chain path accounts with predicted checkpoint prices. Over time, model outputs and user-created paths produce a training dataset of forecasts scored against reality.

### Security-Oriented Settlement

Recent hardening work added stricter path-account validation, duplicate-account rejection, checkpoint-count overflow protection, API authentication for the generation service, and a bonded dispute system. Anyone can dispute a settlement, but they must lock collateral; governance can return or slash the bond, and unresolved disputes can be finalized after timeout.

---

## Platform Layers

```text
Frontend application
  - Market discovery
  - Path charting and drawing
  - Wallet connection
  - Wager, exit, claim, and vault flows

Keeper and automation layer
  - Oracle update relay
  - Sampling and dissolution cranks
  - Scoring and settlement cranks
  - Dispute timeout finalization

AI path generation pipeline
  - Historical data collection
  - Feature engineering
  - Regime detection
  - Foundation-model forecasts
  - Monte Carlo and copula path generation
  - Clustering into representative paths

Solana program
  - Market lifecycle
  - Escrow and claims
  - Path storage
  - Pricing and scoring
  - Disputes and governance controls

External data and infrastructure
  - Pyth oracle feeds
  - Solana RPC
  - Optional off-chain API/indexer surfaces
```

---

## Solana Program

The LevX program is the source of truth for funds and settlement. It is written with Anchor and uses Program Derived Addresses for all protocol-owned state.

### Core Accounts

| Account         | Purpose                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ProtocolState` | Global protocol settings, authority, treasury, insurance fund, supported pairs, and fee defaults.                                 |
| `Market`        | One prediction market: pair, timing, state, pool accounting, paths, amplitudes, scoring config, dispute state, and Mode 2 fields. |
| `PathOutcome`   | One predicted path: checkpoint prices, creator, scoring accumulators, amplitude state, dissolution status, and share accounting.  |
| `Position`      | A user position on one path in one market. Tracks collateral, shares, leverage fields, and claim status.                          |
| `PriceSample`   | A verified oracle checkpoint for a market. Stores normalized price and confidence metadata.                                       |
| `EigenCache`    | Keeper-submitted eigendecomposition data used by the quantum pricing path.                                                        |
| `DisputeConfig` | Governance-managed dispute-bond policy.                                                                                           |
| `DisputeBond`   | Per-market bond metadata for a raised dispute.                                                                                    |
| `LevVault`      | Dormant Mode 2 vault account for future leveraged markets and levUSD.                                                             |
| `PairBuffer`    | Dormant Mode 2 per-pair loss buffer account.                                                                                      |

### Market Lifecycle

```text
Pending
  -> paths are added
  -> market activates once enough valid paths are present

Active / Sampling
  -> users place wagers
  -> keepers submit verified price samples
  -> paths are checked for divergence and may dissolve

Settling
  -> surviving paths are scored
  -> market transitions into maturity window

Maturing
  -> users wait through the dispute window
  -> anyone may raise a bonded dispute

Settled or Void
  -> positions can claim payouts, partial payouts, or collateral refunds
```

The lifecycle is intentionally crankable. Keepers submit transactions when work is ready, but the program enforces correctness. A keeper can relay data or trigger a transition; it cannot choose the settlement result.

---

## Pricing Engine

LevX uses a liquidity-sensitive LMSR-style pricing engine for path shares. Prices update continuously as users buy or sell exposure.

### LS-LMSR Base

The LMSR family gives every path a price and keeps total implied probability normalized. The liquidity-sensitive variant adjusts market depth as participation grows, which makes early markets responsive and mature markets more stable.

### Quadratic Fast Path

For efficient trading, LevX uses a smooth quadratic payment rule around cached quantum prices. This gives the program an O(1) trade-pricing path for common cases while preserving a fallback to the full cost calculation when needed.

### Quantum Pricing Cache

When quantum coupling is enabled, a keeper can submit eigendecomposition data to an `EigenCache` PDA. The program verifies the submitted data and stores cached prices, a Lipschitz constant, and checkpoint quantities. Trades can then use the cache to price correlated paths efficiently.

### Classical Mode

When the market's quantum coupling parameter is zero, LevX reduces to the classical LMSR-style path-pricing model. This gives the protocol a clean, efficient baseline and lets quantum coupling be used only where it adds value.

---

## Scoring Engine

LevX scores paths using both checkpoint-level evolution and final settlement scoring.

### Action Functional

At each checkpoint, LevX measures the deviation between the predicted path and the actual oracle price. The scoring model uses an action functional: a cumulative measure of how much a path diverges across price and velocity changes.

This rewards paths that match the shape of the market, not just its final point.

### Multi-Feature Accuracy

Final scoring also includes accumulated features such as:

- Quadratic variation: how well the path captured volatility texture.
- Max drawdown: how well it captured peak-to-trough stress.
- Endpoint error: how close the final prediction was.
- Displacement error: how close the total move was.

These features make path markets more expressive than simple terminal-price prediction.

### Exponential Scoring

Scores are transformed through an exponential function against a market-level reference action. This avoids keeper-supplied scoring parameters and keeps the settlement rule deterministic.

### ELF-Weighted Settlement

LevX includes an ELF-style settlement layer. At launch, the reference score is set to zero, which behaves like standard parimutuel payout. Governance can later raise the reference score to reward excess skill above a baseline.

---

## Decoherence and Dissolution

A path does not simply win or lose at the end. It evolves.

At each checkpoint, if the actual price diverges from a predicted path, that path's amplitude decays. If its Born-rule probability falls below the market threshold, the path dissolves.

When a path dissolves:

- it stops competing for final settlement,
- its remaining probability is renormalized across surviving paths,
- users on that path may receive a partial payout based on survival time and amplitude history.

This creates a smoother user experience and a more information-rich market. A path that survives 90% of the market before breaking is treated differently from a path that fails immediately.

---

## AI Path Generation

The path generation pipeline is an off-chain service, not a trusted settlement authority.

### Pipeline Stages

```text
Pyth and market data
  -> feature engineering
  -> regime detection
  -> foundation-model forecasts
  -> Monte Carlo simulation
  -> Gaussian copula path generation
  -> clustering into representative paths
  -> path package submitted on-chain
```

The current pipeline includes:

- Pyth historical data collection.
- CoinGecko fallback data.
- 22-dimensional feature engineering.
- Regime detection for market states such as bull trend, bear trend, range-bound, high-volatility, and crash-capitulation regimes.
- Foundation-model forecasting using Time-series models when enabled.
- Monte Carlo and copula-based path generation.
- K-means clustering into representative path candidates.

### Trust Boundary

The Solana program does not trust the AI pipeline. The pipeline proposes paths; the protocol stores and settles them according to deterministic rules. Anyone can run a competing path generator or submit user-drawn paths if the market flow allows it.

This gives LevX a strong product advantage without making AI a consensus dependency.

---

## Oracle and Keeper Infrastructure

LevX uses Pyth price attestations for market checkpoints. Keepers relay oracle data and call program instructions, but the program verifies feed identity, freshness, confidence, and account ownership.

### Keeper Responsibilities

- Post or relay oracle price updates.
- Trigger `sample_and_dissolve` for each checkpoint.
- Score paths once checkpoints are complete.
- Finalize markets after the maturity window.
- Trigger timeout finalization for unresolved disputes.
- Submit eigendecomposition data when quantum pricing caches need refresh.

Keepers are permissionless. Their role is execution, not discretion.

---

## Disputes and Governance

LevX includes a dispute window before final settlement.

Anyone may raise a dispute, but they must lock a configurable collateral bond. Governance can then:

- uphold the dispute, voiding the market and returning the bond, or
- reject the dispute, clearing the market and slashing the bond to insurance.

If governance does not resolve the dispute before the review timeout, a permissionless caller can finalize the market and slash the stale bond to insurance. This keeps the system from getting stuck while preserving an emergency review path.

---

## Mode 2: Leverage and levUSD

Mode 1 is the launch mode: pure PvP, parimutuel-style settlement. Mode 2 is the planned leverage system.

Mode 2 introduces:

- A shared levUSD vault.
- Borrowed capital for leveraged wagers.
- Utilization-aware borrow pricing.
- Per-pair buffers.
- Liquidation and health tracking.
- Profit haircuts under stress.

The important design principle is seniority. Borrow repayment to the vault is senior; leveraged user profit is junior. If the vault is stressed, profit can be scaled by a shared haircut ratio rather than allowing first-come-first-served extraction.

This design is inspired by modern derivatives risk engines and recent research into autodeleveraging tradeoffs, but it is adapted to LevX's path-settlement model.

---

## Frontend Architecture

The frontend is the user-facing control plane for the protocol.

### Current Stack

- React 19
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- Zustand
- Tailwind CSS v4
- Solana wallet adapter
- Pyth Hermes client
- Supabase for off-chain user/waitlist surfaces

### Main Product Surfaces

| Surface       | Purpose                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| Markets       | Discover active and upcoming path markets.                                  |
| Market detail | Visualize real price, predicted paths, path state, and checkpoint progress. |
| Trade panel   | Select a path, preview cost/shares/fees, and place a wager.                 |
| Path drawing  | Let users create custom price paths.                                        |
| Positions     | Track active exposure, live scoring, and exit/claim actions.                |
| Portfolio     | Show historical results, claims, PnL, and user performance.                 |
| Vault         | Future Mode 2 LP interface for levUSD deposits and withdrawals.             |
| Leaderboard   | Rank participants by performance, accuracy, and activity.                   |

The frontend should explain the protocol visually. Path charts are the primary interface: users should see what they are backing, how reality is unfolding, and why a path is gaining or losing probability.

---

## Security and Verification Posture

LevX has been hardened around deterministic settlement and account validation.

Current controls include:

- PDA-based account ownership and seed validation.
- Direct on-chain path storage.
- Fixed-point arithmetic with u128 intermediates.
- Pyth owner, feed, freshness, confidence, and verification checks.
- Duplicate remaining-account rejection in multi-account instructions.
- Checkpoint-count overflow protection.
- Bonded disputes and timeout finalization.
- API-key protection for expensive path-generation endpoints.
- Security audit tooling for Node, Rust, and Python dependency checks.
- Formal-spec and bounded-model-checking work for key math and money-moving logic.

Recent verification includes `cargo test -p levx --lib` and `yarn --cwd keeper tsc --noEmit`, both passing as of 2026-04-27.

---

## Product Value

LevX is valuable because it turns market prediction into a richer, more expressive product:

- Traders can express views about path shape, not only final price.
- AI-generated scenarios make markets easier to enter and compare.
- User-drawn paths create a data flywheel of human market intuition.
- On-chain settlement makes outcomes reproducible and transparent.
- Graceful dissolution rewards partially correct theses.
- Mode 2 introduces a path-native leveraged market design with explicit vault risk controls.

The technical architecture is built around one idea: make complex forecasts tradable while keeping custody, scoring, and settlement deterministic.
