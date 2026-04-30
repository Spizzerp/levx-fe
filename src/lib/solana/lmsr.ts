/**
 * Off-chain estimators for the on-chain LMSR cost-function used by
 * `place_wager` and `exit_position`. These power the slippage UX:
 * we estimate the expected shares-out (or payout-out) for the user's
 * trade, then apply the configured tolerance to derive `min_shares_out`
 * / `min_payout_out` floors that the program enforces.
 *
 * The on-chain implementation has two tiers (cache-fresh quadratic
 * vs. plain LMSR softmax). We mirror only the plain LMSR tier here —
 * the cache-fresh tier is a tighter approximation around the previous
 * checkpoint and the difference falls inside any non-zero slippage
 * tolerance the user picks. If we ever need exact matching we'd port
 * `quantum_cost::shares_for_budget` directly.
 *
 * Math, with quantities `q` and liquidity `b`:
 *
 *     C(q) = b * ln(Σ exp(q_j / b))
 *     Buy Δq of path k for amount a:
 *         a = C(q + Δq·e_k) − C(q)
 *         exp(q'_k / b) = exp(q_k / b) + (exp(a / b) − 1) · Σ exp(q_j / b)
 *         Δq = b · ln(exp(q'_k / b)) − q_k
 *     Sell s shares of path k:
 *         payout = C(q) − C(q − s·e_k)
 *
 * Stable via log-sum-exp shift. Inactive (dissolved) paths are dropped
 * because the program restricts cost-fn evaluation to the active mask.
 */

const EPS = 1e-12

interface EstimateInput {
  /** Net signed share quantities per path, scaled by SCALE (human units). */
  shareQuantities: number[]
  /** Active path count (matches market.numPaths). */
  numPaths: number
  /** LMSR liquidity parameter `b`, scaled (human units). */
  lmsrAlpha: number
  /** Subset of path indices that are still active (default: all paths < numPaths). */
  activeMask?: boolean[]
}

function effectiveActive(input: EstimateInput): boolean[] {
  if (input.activeMask) return input.activeMask
  return Array.from({ length: input.numPaths }, () => true)
}

/**
 * Numerically stable log(Σ exp(q_j / b)) over active paths only.
 *
 * Returns `{ lse, scaled }` where:
 *   - `scaled[i]` = exp((q_i − maxQ) / b)  (only for active paths; others 0)
 *   - `lse`      = log(Σ scaled) + maxQ / b   (i.e. the unshifted log-sum-exp)
 */
function logSumExp(
  q: number[],
  active: boolean[],
  numPaths: number,
  b: number,
): { lse: number; scaled: number[]; maxQ: number } {
  let maxQ = -Infinity
  for (let i = 0; i < numPaths; i++) {
    if (active[i] && q[i] > maxQ) maxQ = q[i]
  }
  if (!isFinite(maxQ)) {
    return { lse: -Infinity, scaled: new Array(numPaths).fill(0), maxQ: 0 }
  }
  const scaled = new Array(numPaths).fill(0)
  let sum = 0
  for (let i = 0; i < numPaths; i++) {
    if (!active[i]) continue
    const s = Math.exp((q[i] - maxQ) / b)
    scaled[i] = s
    sum += s
  }
  return { lse: Math.log(sum) + maxQ / b, scaled, maxQ }
}

/**
 * Estimate shares-out for a buy-side trade in `amountScaled` USDC of
 * path `pathIndex`. All inputs and outputs are in human (post-SCALE)
 * units. Returns the predicted shares-out the program would emit
 * (modulo the tier-1 EigenCache adjustment, see file header).
 *
 * Returns 0 for degenerate inputs (b ≤ 0, no active paths, dissolved
 * target path) — those cases would also be rejected by the program,
 * so the slippage floor will be 0 and the on-chain validation will
 * surface the real error.
 */
export function estimateLmsrSharesOut(
  input: EstimateInput & {
    pathIndex: number
    /** USDC amount being wagered (post-fee), in human (scaled) units. */
    amountScaled: number
  },
): number {
  const { shareQuantities, numPaths, lmsrAlpha, pathIndex, amountScaled } = input
  if (lmsrAlpha <= 0 || numPaths <= 0 || pathIndex < 0 || pathIndex >= numPaths) return 0
  if (amountScaled <= 0) return 0
  const active = effectiveActive(input)
  if (!active[pathIndex]) return 0

  const b = lmsrAlpha
  const { scaled, maxQ } = logSumExp(shareQuantities, active, numPaths, b)
  const sumExp = scaled.reduce((acc, v) => acc + v, 0)
  if (sumExp <= EPS) return 0

  // exp((q_k − maxQ) / b) is `scaled[pathIndex]`.
  // After buying Δq of path k:
  //   exp((q'_k − maxQ) / b) = scaled[pathIndex] + (exp(a/b) − 1) · sumExp
  const newScaledK = scaled[pathIndex] + (Math.exp(amountScaled / b) - 1) * sumExp
  if (newScaledK <= EPS) return 0
  const newQK = b * (Math.log(newScaledK) + maxQ / b)
  const delta = newQK - shareQuantities[pathIndex]
  return delta > 0 ? delta : 0
}

/**
 * Estimate USDC payout for selling `sharesScaled` shares of path
 * `pathIndex` (full-exit equivalent — pass `position.lmsrShares`).
 * All inputs/outputs in human (scaled) units. Mirrors the program's
 * exit-side cost-fn evaluation.
 *
 * Returns 0 if the request would consume more shares than the LMSR
 * pool can release (degenerate path).
 */
export function estimateLmsrExitPayout(
  input: EstimateInput & {
    pathIndex: number
    /** Shares being sold, in human (scaled) units. */
    sharesScaled: number
  },
): number {
  const { shareQuantities, numPaths, lmsrAlpha, pathIndex, sharesScaled } = input
  if (lmsrAlpha <= 0 || numPaths <= 0 || pathIndex < 0 || pathIndex >= numPaths) return 0
  if (sharesScaled <= 0) return 0
  const active = effectiveActive(input)
  if (!active[pathIndex]) return 0

  const b = lmsrAlpha
  const before = logSumExp(shareQuantities, active, numPaths, b)
  const after = shareQuantities.slice()
  after[pathIndex] = shareQuantities[pathIndex] - sharesScaled
  const afterLse = logSumExp(after, active, numPaths, b)
  const payout = b * (before.lse - afterLse.lse)
  return payout > 0 ? payout : 0
}

/**
 * Apply slippage tolerance to an expected output and floor at 0.
 *
 * tolerance is a decimal in [0, 1) — e.g. 0.005 = 0.5%.
 * Returns `floor(expected · (1 − tolerance))`. Floor (not round) is
 * intentional: we never want the FE-side floor to exceed what the
 * on-chain handler actually delivers due to off-by-rounding.
 */
export function applySlippageFloor(expected: number, tolerance: number): number {
  if (!isFinite(expected) || expected <= 0) return 0
  const t = Math.max(0, Math.min(0.99, tolerance))
  return Math.floor(expected * (1 - t))
}
