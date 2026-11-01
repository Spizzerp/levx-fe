/**
 * The admission transaction: one `admit_batch` whose only owner is the trader, who also pays the
 * fee. Its orders are the pre-check's, in the pre-check's order (path by path, in each path's part
 * order, zero-unit parts dropped), so the program's first refusal is the one the pre-check names.
 */
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import type { Address } from '@solana/kit'
import {
  COMPUTE_BUDGET_IX_CU,
  CU_CEILINGS,
  POLICY_CERTIFIED,
  admitBatchIx,
  associatedTokenAddress,
  fit,
  toLegacyInstructionFields,
} from '@spizzerp/levx-mode2-client'
import type { Order } from '@spizzerp/levx-mode2-client'
import type { PathOrder } from './precheck'
import type { Mode2MarketView } from './types'

export interface AdmitInstruction {
  instruction: TransactionInstruction
  /** The program's ceiling for the group's policy plus the compute-budget instruction. */
  computeUnitLimit: number
  /** The positions the screen counts: the paths with at least one unit. */
  positions: number
}

/** The paths of `orders` with at least one unit: one position each on screen. */
export function positionCount(orders: readonly PathOrder[]): number {
  return orders.filter((order) => order.parts.some((part) => part.units > 0)).length
}

export function buildAdmitInstruction(
  view: Mode2MarketView,
  owner: string,
  orders: readonly PathOrder[],
): AdmitInstruction {
  const group = view.group?.data
  const epoch = view.epoch?.data
  if (group === undefined || epoch === undefined) {
    throw new Error('This market has no leverage group')
  }
  const cohort = view.cohort.data
  const trader = owner as Address
  const batch: Order[] = orders.flatMap((order) =>
    order.parts
      .filter((part) => part.units > 0)
      .map((part) => ({
        ownerIndex: 0,
        offerSlot: part.offerSlot,
        selectedPath: order.slot,
        count: part.units,
        offerDigest: group.offers[part.offerSlot].digest,
      })),
  )
  const ix = admitBatchIx(
    group.epochId,
    view.cohort.address as Address,
    group.groupIndex,
    view.market as Address,
    cohort.baseMint,
    cohort.quoteMint,
    [{ owner: trader, ownerToken: associatedTokenAddress(trader, epoch.mint) }],
    batch,
  )
  // web3.js 1.98 sends legacy transactions only; `priced` counts the limit and price instructions
  // `buildTransaction` puts in front.
  if (fit([ix], trader, { priced: true }).format !== 'legacy') {
    throw new Error('Too many orders for one transaction')
  }
  const fields = toLegacyInstructionFields(ix)
  return {
    instruction: new TransactionInstruction({
      programId: new PublicKey(fields.programId),
      keys: fields.keys.map((key) => ({ ...key, pubkey: new PublicKey(key.pubkey) })),
      data: Buffer.from(fields.data),
    }),
    computeUnitLimit:
      (group.policy === POLICY_CERTIFIED ? CU_CEILINGS.admitCertified : CU_CEILINGS.admitControl) +
      COMPUTE_BUDGET_IX_CU,
    positions: positionCount(orders),
  }
}
