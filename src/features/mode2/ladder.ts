/**
 * The leverage ladder: a path's whole-number offers as a slider in tenths, and a principal split
 * between the two offers either side of the chosen leverage so the parts average it exactly.
 */
import type { NettingGroup } from '@spizzerp/levx-mode2-client'

/** An offer a path can take: its slot in the group, its whole-number leverage and its unit, C. */
export interface OfferRef {
  slot: number
  leverage: number
  collateral: bigint
}

/** `units` positions of the offer in `offerSlot`. */
export interface OrderPart {
  offerSlot: number
  leverage: number
  units: number
}

/** The principal moves in steps of 10 USDC, in micro-USDC. */
export const PRINCIPAL_STEP_MICRO = 10_000_000n

const MICRO_PER_USDC = 1_000_000n
/** Whole USDC with optional decimals; no sign, exponent or separators. */
const AMOUNT = /^(\d+)(?:\.\d*)?$/

/**
 * The group's offers on cohort slot `pathSlot` at `nowMs`, by leverage: within `offerCount`,
 * permitting the slot and not expired. The program admits only while `now < expires_at`, in seconds.
 */
export function openOffers(group: NettingGroup, pathSlot: number, nowMs: number): OfferRef[] {
  const nowSeconds = BigInt(Math.floor(nowMs / 1000))
  return group.offers
    .slice(0, group.offerCount)
    .map((offer, slot) => ({ slot, offer }))
    .filter(
      ({ offer }) => (offer.permittedPaths & (1 << pathSlot)) !== 0 && nowSeconds < offer.expiresAt,
    )
    .map(({ slot, offer }) => ({ slot, leverage: offer.leverage, collateral: offer.collateral }))
    .sort((a, b) => a.leverage - b.leverage)
}

/** The collateral every offer shares, the principal's unit; null when there is none or they differ. */
export function unitCollateral(offers: readonly OfferRef[]): bigint | null {
  if (offers.length === 0) return null
  const unit = offers[0].collateral
  return offers.every((offer) => offer.collateral === unit) ? unit : null
}

/** Every tenth from the lowest to the highest of `offers` (sorted, as `openOffers` returns them). */
export function ladderValues(offers: readonly OfferRef[]): number[] {
  if (offers.length === 0) return []
  const low = offers[0].leverage * 10
  const high = offers[offers.length - 1].leverage * 10
  return Array.from({ length: high - low + 1 }, (_, i) => (low + i) / 10)
}

/**
 * `units` of principal at `leverage` over `offers` (sorted, as `openOffers` returns them): all in
 * one offer at a whole number, else `units × (t − 10a) / (10 (b − a))` at the neighbour above, `b`,
 * and the rest at the one below, `a`. Null when that is not a whole number of units, or `leverage`
 * is outside the offers.
 */
export function splitPrincipal(
  leverage: number,
  units: number,
  offers: readonly OfferRef[],
): OrderPart[] | null {
  const t = Math.round(leverage * 10)
  const below = offers.findLast((offer) => offer.leverage * 10 <= t)
  const above = offers.find((offer) => offer.leverage * 10 >= t)
  if (below === undefined || above === undefined) return null
  const part = (offer: OfferRef, n: number): OrderPart => ({
    offerSlot: offer.slot,
    leverage: offer.leverage,
    units: n,
  })
  if (below.leverage * 10 === t) return [part(below, units)].filter((p) => p.units > 0)
  const numerator = units * (t - below.leverage * 10)
  const denominator = 10 * (above.leverage - below.leverage)
  if (numerator % denominator !== 0) return null
  const unitsAbove = numerator / denominator
  return [part(below, units - unitsAbove), part(above, unitsAbove)].filter((p) => p.units > 0)
}

/**
 * The principal typed as `text`, in micro-USDC, floored to the 10 USDC step; 0 for anything that is
 * not a plain non-negative amount. The decimals never reach a whole step, so only the integer part
 * counts.
 */
export function roundPrincipal(text: string): bigint {
  const match = AMOUNT.exec(text.trim())
  if (match === null) return 0n
  const micro = BigInt(match[1]) * MICRO_PER_USDC
  return micro - (micro % PRINCIPAL_STEP_MICRO)
}
