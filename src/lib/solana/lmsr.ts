import { LMSR_MIN_B, SCALE } from '@/lib/constants'

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
const FIXED_POINT_ATOM = 1 / SCALE
const MIN_B = LMSR_MIN_B / SCALE
const SCALE_BIGINT = BigInt(SCALE)
const I64_MIN = -(1n << 63n)
const I64_MAX = (1n << 63n) - 1n

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

export interface QuadraticEstimateInput {
  /** Current net signed share quantities per path, in human units. */
  shareQuantities: number[]
  /** EigenCache checkpoint quantities, in human units. */
  checkpointQuantities: number[]
  /** EigenCache cached prices, in human probability units. */
  cachedPrices: number[]
  /** EigenCache Lipschitz constant, in human units (`raw / SCALE`). */
  lipschitz: number
  pathIndex: number
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

  const tradeCost = (sharesOut: number) => {
    const qNext = shareQuantities.slice(0, numPaths)
    qNext[pathIndex] = (qNext[pathIndex] ?? 0) + sharesOut
    return adaptiveCost(qNext, active, numPaths, lmsrAlpha) - baseCost
  }

  const costOne = tradeCost(FIXED_POINT_ATOM)
  if (costOne > amountScaled) return 0

  const hiCostGrounded = costOne > EPS ? (amountScaled / costOne) * 2 * FIXED_POINT_ATOM : 0
  const hiFallback = amountScaled * numPaths * 2
  let lo = 0
  let hi = Math.max(hiCostGrounded, hiFallback, FIXED_POINT_ATOM)

  // Start with a marginal-cost bound, then expand until `hi` is above budget.
  for (let i = 0; i < 32 && tradeCost(hi) <= amountScaled; i += 1) {
    hi *= 2
  }

  for (let i = 0; i < 80; i += 1) {
    const mid = lo + (hi - lo) / 2
    if (hi - lo <= FIXED_POINT_ATOM) break

    if (tradeCost(mid) <= amountScaled) lo = mid
    else hi = mid
  }

  return Math.max(0, lo)
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

function toRawFixedPoint(value: number): bigint {
  if (!Number.isFinite(value)) return 0n
  return BigInt(Math.trunc(value * SCALE))
}

function toRawUnsignedFixedPoint(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n
  return BigInt(Math.floor(value * SCALE))
}

function fromRawFixedPoint(value: bigint): number {
  return Number(value) / SCALE
}

function sqrtBigInt(n: bigint): bigint {
  if (n <= 0n) return 0n
  if (n === 1n) return 1n
  let x = n
  let y = (x + 1n) / 2n
  while (y < x) {
    x = y
    y = (x + n / x) / 2n
  }
  return x
}

function saturatingSubI64(a: bigint, b: bigint): bigint {
  const out = a - b
  if (out < I64_MIN) return I64_MIN
  if (out > I64_MAX) return I64_MAX
  return out
}

function effectiveQuadraticPriceRaw(input: QuadraticEstimateInput): bigint {
  const { shareQuantities, checkpointQuantities, cachedPrices, lipschitz, pathIndex } = input
  const pBase = toRawUnsignedFixedPoint(cachedPrices[pathIndex] ?? 0)
  const l = toRawUnsignedFixedPoint(lipschitz)
  if (pBase <= 0n || l <= 0n) return 0n

  const q = toRawFixedPoint(shareQuantities[pathIndex] ?? 0)
  const qCheckpoint = toRawFixedPoint(checkpointQuantities[pathIndex] ?? 0)
  const delta = saturatingSubI64(q, qCheckpoint)
  if (delta >= 0n) {
    const adjustment = (l * delta) / SCALE_BIGINT
    const raised = pBase + adjustment
    return raised > SCALE_BIGINT ? SCALE_BIGINT : raised
  }

  const decrease = (l * -delta) / SCALE_BIGINT
  const lowered = pBase > decrease ? pBase - decrease : 0n
  return lowered < 1n ? 1n : lowered
}

function sharesForBudgetQuadraticRaw(
  effectivePriceRaw: bigint,
  lipschitzRaw: bigint,
  budgetRaw: bigint,
): bigint {
  if (budgetRaw <= 0n || lipschitzRaw <= 0n) return 0n
  const discriminant = effectivePriceRaw * effectivePriceRaw + 2n * lipschitzRaw * budgetRaw
  const sqrtDisc = sqrtBigInt(discriminant)
  const numerator = sqrtDisc > effectivePriceRaw ? sqrtDisc - effectivePriceRaw : 0n
  if (numerator === 0n) return 0n
  return (numerator * SCALE_BIGINT) / lipschitzRaw
}

function quadraticCostRaw(
  effectivePriceRaw: bigint,
  lipschitzRaw: bigint,
  sharesRaw: bigint,
): bigint {
  if (sharesRaw === 0n) return 0n
  const s = sharesRaw < 0n ? -sharesRaw : sharesRaw
  const linear = (effectivePriceRaw * s) / SCALE_BIGINT
  const quadratic = (lipschitzRaw * s * s) / (2n * SCALE_BIGINT * SCALE_BIGINT)
  return linear + quadratic
}

function quadraticSellValueRaw(
  effectivePriceRaw: bigint,
  lipschitzRaw: bigint,
  sharesRaw: bigint,
): bigint {
  if (sharesRaw <= 0n) return 0n
  const linear = (effectivePriceRaw * sharesRaw) / SCALE_BIGINT
  const quadratic = (lipschitzRaw * sharesRaw * sharesRaw) / (2n * SCALE_BIGINT * SCALE_BIGINT)
  return linear > quadratic ? linear - quadratic : 0n
}

/**
 * Estimate EigenCache Tier-1 buy shares using the same fixed-point quadratic
 * rule as `shares_for_budget_quadratic` and the program's effective-price cap.
 * Returns a human-unit float for UI/transaction lower-bound composition.
 */
export function estimateQuadraticSharesOut(
  input: QuadraticEstimateInput & { amountScaled: number },
): number {
  const { pathIndex, cachedPrices, checkpointQuantities, shareQuantities, amountScaled } = input
  if (pathIndex < 0 || pathIndex >= cachedPrices.length) return 0
  if (checkpointQuantities.length <= pathIndex || shareQuantities.length <= pathIndex) return 0
  const l = toRawUnsignedFixedPoint(input.lipschitz)
  const budget = toRawUnsignedFixedPoint(amountScaled)
  const pEff = effectiveQuadraticPriceRaw(input)
  const shares = sharesForBudgetQuadraticRaw(pEff, l, budget)
  if (quadraticCostRaw(pEff, l, shares) > budget) return 0
  return fromRawFixedPoint(shares)
}

/**
 * Estimate EigenCache Tier-1 exit payout using the on-chain quadratic sell
 * value formula. The value is gross of settlement rake; callers apply rake
 * before computing `min_payout_out`, matching `exit_position`.
 */
export function estimateQuadraticExitPayout(
  input: QuadraticEstimateInput & { sharesScaled: number },
): number {
  const { pathIndex, cachedPrices, checkpointQuantities, shareQuantities, sharesScaled } = input
  if (pathIndex < 0 || pathIndex >= cachedPrices.length) return 0
  if (checkpointQuantities.length <= pathIndex || shareQuantities.length <= pathIndex) return 0
  const l = toRawUnsignedFixedPoint(input.lipschitz)
  const shares = toRawUnsignedFixedPoint(sharesScaled)
  const pEff = effectiveQuadraticPriceRaw(input)
  return fromRawFixedPoint(quadraticSellValueRaw(pEff, l, shares))
}

/**
 * Apply slippage tolerance to an expected output and return a human-unit float.
 *
 * tolerance is a decimal in [0, 1) — e.g. 0.005 = 0.5%.
 * Fixed-point integer conversion is handled by transaction builders; flooring
 * here would drop sub-unit shares/payouts and silently weaken protection.
 */
export function applySlippageTolerance(expected: number, tolerance: number): number {
  if (!isFinite(expected) || expected <= 0) return 0
  const t = Math.max(0, Math.min(0.99, tolerance))
  return expected * (1 - t)
}
