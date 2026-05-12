/**
 * Off-chain estimators for the on-chain LMSR cost-function used by
 * `place_wager` and `exit_position`. These power the slippage UX:
 * we estimate the expected shares-out (or payout-out) for the user's
 * trade, then apply the configured tolerance to derive `min_shares_out`
 * / `min_payout_out` floors that the program enforces.
 *
 * The on-chain implementation has two tiers (cache-fresh quadratic
 * vs. plain LMSR softmax). The frontend currently omits EigenCache from
 * place_wager / exit_position, so the program takes the plain λ=0 tier.
 * These estimators mirror that tier's adaptive LS-LMSR cost:
 * b = alpha * Σ|q_active|, floored at MIN_B.
 *
 * Math, with quantities `q` and adaptive liquidity `b(q)`:
 *
 *     C(q) = b(q) * ln(Σ exp(q_j / b(q)))
 *     Buy Δq by binary search on C(q + Δq·e_k) − C(q) <= budget
 *     Sell s shares: payout = C(q) − C(q − s·e_k)
 *
 * Stable via log-sum-exp shift. Inactive (dissolved) paths are dropped
 * because the program restricts cost-fn evaluation to the active mask.
 */

const EPS = 1e-12
const FIXED_POINT_SCALE = 1_000_000
const MIN_B = 10_000 / FIXED_POINT_SCALE

interface EstimateInput {
  /** Net signed share quantities per path, scaled by SCALE (human units). */
  shareQuantities: number[]
  /** Active path count (matches market.numPaths). */
  numPaths: number
  /** LS-LMSR alpha parameter, scaled to human units. */
  lmsrAlpha: number
  /** Subset of path indices that are still active (default: all paths < numPaths). */
  activeMask?: boolean[]
}

export function effectiveActive(input: EstimateInput): boolean[] {
  if (input.activeMask) return input.activeMask.slice(0, input.numPaths)
  return Array.from({ length: input.numPaths }, () => true)
}

function adaptiveLiquidity(
  shareQuantities: number[],
  active: boolean[],
  numPaths: number,
  lmsrAlpha: number,
): number {
  let sumAbs = 0
  for (let i = 0; i < numPaths; i += 1) {
    if (active[i]) sumAbs += Math.abs(shareQuantities[i] ?? 0)
  }
  return Math.max(MIN_B, lmsrAlpha * sumAbs)
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

function adaptiveCost(
  shareQuantities: number[],
  active: boolean[],
  numPaths: number,
  lmsrAlpha: number,
): number {
  const b = adaptiveLiquidity(shareQuantities, active, numPaths, lmsrAlpha)
  const { lse } = logSumExp(shareQuantities, active, numPaths, b)
  if (!isFinite(lse)) return 0
  return b * lse
}

/**
 * Estimate shares-out for a buy-side trade in `amountScaled` USDC of
 * path `pathIndex`. All inputs and outputs are in human (post-SCALE)
 * units. Returns the predicted shares-out the program would emit on the
 * plain λ=0 tier used by frontend-built wager instructions.
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

  const baseCost = adaptiveCost(shareQuantities, active, numPaths, lmsrAlpha)

  const qOne = shareQuantities.slice(0, numPaths)
  qOne[pathIndex] = (qOne[pathIndex] ?? 0) + 1 / FIXED_POINT_SCALE
  const costOne = adaptiveCost(qOne, active, numPaths, lmsrAlpha) - baseCost
  if (costOne > amountScaled) return 0

  const hiCostGrounded = costOne > EPS ? (amountScaled / costOne) * 2 / FIXED_POINT_SCALE : 0
  const hiFallback = amountScaled * 10_000
  let lo = 0
  let hi = Math.max(hiCostGrounded, hiFallback, 1 / FIXED_POINT_SCALE)

  for (let i = 0; i < 80; i += 1) {
    const mid = lo + (hi - lo) / 2
    if (hi - lo <= 1 / FIXED_POINT_SCALE) break

    const qMid = shareQuantities.slice(0, numPaths)
    qMid[pathIndex] = (qMid[pathIndex] ?? 0) + mid
    const costMid = adaptiveCost(qMid, active, numPaths, lmsrAlpha) - baseCost
    if (costMid <= amountScaled) lo = mid
    else hi = mid
  }

  // Stay one fixed-point atom below the float boundary so min_out cannot exceed
  // the program's integer result because of frontend rounding noise.
  return Math.max(0, lo - 1 / FIXED_POINT_SCALE)
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

  const after = shareQuantities.slice()
  after[pathIndex] = shareQuantities[pathIndex] - sharesScaled
  const payout =
    adaptiveCost(shareQuantities, active, numPaths, lmsrAlpha) -
    adaptiveCost(after, active, numPaths, lmsrAlpha)
  return payout > 0 ? payout : 0
}

/**
 * Apply slippage tolerance to an expected output and floor at 0.
 *
 * tolerance is a decimal in [0, 1) — e.g. 0.005 = 0.5%.
 * Fixed-point integer conversion is handled by transaction builders; flooring
 * here would drop sub-unit shares/payouts and silently weaken protection.
 */
export function applySlippageFloor(expected: number, tolerance: number): number {
  if (!isFinite(expected) || expected <= 0) return 0
  const t = Math.max(0, Math.min(0.99, tolerance))
  return expected * (1 - t)
}
