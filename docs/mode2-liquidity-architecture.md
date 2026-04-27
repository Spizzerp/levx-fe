# Mode 2 and Liquidity Architecture

Last updated: 2026-04-27
Audience: public docs, frontend docs page, technical readers

---

## Overview

LevX launches with Mode 1 markets: fully collateralized, PvP path-prediction markets where every payout is funded by market participants. Mode 2 is the planned leverage layer. It extends the same path-settlement engine with borrowed capital, LP deposits, vault accounting, risk buffers, and stress controls.

The goal of Mode 2 is not to bolt generic leverage onto a prediction market. The goal is to make path-native leverage possible while keeping settlement deterministic and vault risk explicit.

---

## Design Goals

Mode 2 is built around four principles:

1. Solvency before growth: settlement obligations must remain bounded by protocol-controlled liquidity and risk limits.
2. Transparent seniority: vault repayment is senior, leveraged profit is junior.
3. Fair stress handling: when the system is stressed, eligible leveraged profits are scaled pro rata instead of paying fastest claimants first.
4. Minimal trust assumptions: external liquidity venues can help with capital efficiency, but they should not become the source of truth for LevX settlement.

---

## levUSD Vault

The levUSD vault is the planned liquidity base for leveraged markets.

LPs deposit supported collateral, initially expected to be USDC, and receive vault shares. Traders can use vault liquidity to amplify path-market exposure. Borrowed capital is tracked by the protocol and repaid before user profit is distributed.

At a high level:

```text
LP deposits collateral
  -> vault issues levUSD-style share exposure
  -> leveraged traders borrow from vault capacity
  -> markets settle against oracle-scored path outcomes
  -> vault repayment is senior
  -> user profit is paid from remaining eligible surplus
```

This keeps leverage capital inside a known accounting boundary instead of relying on informal off-chain liquidity assumptions.

---

## Loss Waterfall

Mode 2 uses a layered risk model.

```text
Pair buffer
  -> shared vault
  -> haircut mode for leveraged profit
  -> insurance recovery over time
```

### Pair Buffer

A pair buffer is a first-loss buffer for pair-specific stress. For example, SOL/USDC risk should not immediately spill into every other pair if the pair-level buffer can absorb it.

### Shared Vault

The shared vault backs leveraged market activity. It is senior to trader profit and must be repaid before net leveraged winnings are distributed.

### Haircut Mode

If the system enters a stressed state, leveraged net profit can be scaled by a shared haircut ratio. The haircut applies to profit, not to the vault's senior repayment claim.

### Insurance Recovery

Insurance assets are used as a recovery mechanism. They help restore vault health over time rather than creating a fragile one-transaction bailout dependency.

---

## Haircut Ratio

The haircut ratio is the core fairness mechanism for stressed leverage settlement.

When all eligible claims are fully backed, the ratio is 1.0 and leveraged winners receive their full net profit. When the vault is stressed, the ratio falls below 1.0 and profit is scaled proportionally.

Simplified model:

```text
net_profit = max(0, position_payout - borrowed_amount - accrued_fees)
adjusted_profit = net_profit * haircut_ratio
vault_repayment = min(position_payout, borrowed_amount + accrued_fees)
```

This means:

- The vault is repaid first.
- User profit is paid from remaining capacity.
- No single claimant gets priority just because their transaction lands first.
- Conservative rounding protects vault solvency.

---

## Settlement-Epoch Snapshots

A key Mode 2 design choice is to snapshot the eligible profit denominator before claims open for a settlement epoch.

Without this, early claimants could withdraw against a denominator that excludes later eligible claims. With an epoch snapshot, every eligible claim references the same budget, which makes pro-rata settlement auditable and fair.

```text
market finalizes
  -> eligible leveraged profit denominator is snapshotted
  -> haircut ratio is computed
  -> claims consume the fixed epoch budget
  -> remaining dust is routed conservatively
```

---

## Profit Warmup

Mode 2 should not let a one-checkpoint spike immediately become withdrawable leveraged profit.

Profit warmup means fresh mark-to-market gains must persist before becoming claimable. This reduces the impact of short-lived oracle spikes or manipulation attempts and aligns leverage claims with durable path accuracy.

In practical terms:

- unrealized profit can improve a position's state,
- matured profit becomes eligible for settlement,
- fresh profit is excluded from the immediate claim denominator.

---

## Liquidation and Health

Leveraged positions require health tracking. A position's health depends on collateral, borrowed amount, path performance, market state, and accrued fees.

Mode 2 introduces the surfaces needed for:

- health updates,
- liquidation eligibility,
- borrow fee accrual,
- backstop liquidators,
- pair-level and vault-level limits.

These controls are designed to prevent leveraged positions from turning into unbounded vault liabilities.

---

## External Liquidity Strategy

External liquidity integrations can improve capital efficiency, but they should be supplemental.

LevX's settlement-critical accounting should remain inside LevX-controlled vaults. External venues may be useful for treasury productivity, partnership distribution, or optional user-facing liquidity modules, but they should not directly back guaranteed claim obligations.

Recommended public framing:

```text
LevX vault = source of truth for settlement obligations
External liquidity = optional capital-efficiency sleeve
Risk limits = exposure caps, unwind paths, monitoring, and circuit breakers
```

This lets LevX benefit from ecosystem liquidity without importing external protocol risk into core settlement.

---

## User-Facing Value

Mode 2 adds several product advantages:

- More expressive exposure: traders can back a path thesis with amplified upside.
- LP yield: vault depositors can earn from borrow demand and protocol activity.
- Better liquidity: deeper markets make path prices more useful and responsive.
- Transparent stress handling: users can understand how repayment, profit, buffers, and insurance interact.
- Path-native risk: leverage is tied to the same checkpoint and scoring system as the base market.

---

## Status

Mode 2 is planned as a staged activation after Mode 1 launch. Core account scaffolding exists in the protocol, but leverage behavior should activate only after implementation, testing, risk review, and audit coverage are complete.

The important point for users: Mode 1 does not depend on Mode 2. LevX can launch as a fully collateralized path-prediction market first, then add leverage once the vault and risk controls are ready.
