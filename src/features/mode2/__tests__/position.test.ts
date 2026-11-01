// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Address } from '@solana/kit'
import {
  GROUP_FUNDED_NORMAL,
  GROUP_FUNDED_VOID,
  RESULT_STAGED,
  payoffAt,
  positionPda,
} from '@spizzerp/levx-mode2-client'
import type { Bucket, Cohort, NettingGroup } from '@spizzerp/levx-mode2-client'

import { mode2Keys } from '../api'
import { pathBreakdown } from '../breakdown'
import type { ReceiptHistory } from '../history'
import { summarizePosition } from '../position'
import type { Mode2Forecasts, Mode2MarketView } from '../types'
import {
  FIXTURE_ENTRY_LEVELS,
  FIXTURE_OWNER,
  FIXTURE_START_MS,
  makeCohort,
  makeGroup,
  makeReceipt,
  makeView,
  todayOffers,
} from './fixtures'

const BEFORE_START_MS = FIXTURE_START_MS - 60_000
const RUNNING_MS = FIXTURE_START_MS + 25 * 60_000
const USDC = 1_000_000n

const bucket = (offerSlot: number, path: number, count: number, claim = 0n): Bucket => ({
  claim,
  count,
  offerSlot,
  path,
  pad: new Uint8Array(2),
})

/**
 * The group's book: one 2× and one 3× position on cohort slot 0 (2.5× on 20 USDC), two 2×
 * positions on slot 2 (2.0× on 20 USDC). The owner holds every position: 40 USDC in all.
 */
const BUCKETS = [bucket(0, 0, 1), bucket(1, 0, 1), bucket(0, 2, 2)]
const COUNTS = [1, 1, 2]
/** Cohort slot 0 names Mode 1 path 3 and slot 2 names path 4. */
const FORECASTS: Mode2Forecasts = { slotToPathIndex: [3, 1, 4, 0, 2], prices: [] }

function viewWith(
  cohort: Partial<Cohort> = {},
  group: Partial<NettingGroup> = {},
): Mode2MarketView {
  const view = makeView()
  const address = view.group!.address
  return {
    ...view,
    cohort: { ...view.cohort, data: makeCohort(cohort) },
    group: { address, data: makeGroup({ buckets: BUCKETS, ...group }) },
    receipt: {
      address: positionPda(address as Address, FIXTURE_OWNER),
      data: makeReceipt(COUNTS),
    },
  }
}

/**
 * Staged terminal indices: slot 0 at 0.25, slot 2 at 0.23, the rest at 0. Near the entry levels no
 * profit cap binds and no claim is zero, so the payout depends on each bucket's offer, entry level and
 * slot.
 */
const STAGED_INDICES = Array.from({ length: 16 }, (_, slot) =>
  slot === 0 ? 250_000n : slot === 2 ? 230_000n : 0n,
)

/** The view after the group was funded and the keeper paid and closed the receipt. */
const closedView = (): Mode2MarketView => ({
  ...viewWith(
    { observationsRecorded: 6, resultState: RESULT_STAGED, indices: STAGED_INDICES },
    { state: GROUP_FUNDED_NORMAL },
  ),
  receipt: null,
})

const paidHistory = (paid: bigint): ReceiptHistory => ({
  principal: 40n * USDC,
  paid,
  claimSignature: 'claim',
})

describe('summarizePosition', () => {
  it('is waiting before the start', () => {
    const summary = summarizePosition(viewWith(), FORECASTS, null, BEFORE_START_MS)
    expect(summary).toMatchObject({
      status: 'waiting',
      principal: 40n * USDC,
      checkpoint: 0,
      totalCheckpoints: 6,
      finalPayout: null,
      paid: null,
    })
  })

  it('is running after the start, at the checkpoints recorded', () => {
    const view = viewWith({ observationsRecorded: 2 })
    const summary = summarizePosition(view, FORECASTS, null, RUNNING_MS)
    expect(summary).toMatchObject({
      status: 'running',
      principal: 40n * USDC,
      checkpoint: 2,
      totalCheckpoints: 6,
      finalPayout: null,
    })
  })

  it('shows a path as one position at its combined leverage, 2.5 for 1 unit at 2x and 1 at 3x', () => {
    const view = viewWith()
    const summary = summarizePosition(view, FORECASTS, null, BEFORE_START_MS)!
    const group = view.group!.data
    const { parts: _first, ...first } = pathBreakdown(group, 0, 3, 2.5, [
      { offerSlot: 0, leverage: 2, units: 1 },
      { offerSlot: 1, leverage: 3, units: 1 },
    ])
    const { parts: _second, ...second } = pathBreakdown(group, 2, 4, 2, [
      { offerSlot: 0, leverage: 2, units: 2 },
    ])
    expect(summary.paths).toEqual([
      { ...first, finalPayout: null },
      { ...second, finalPayout: null },
    ])
    expect(summary.paths.map((path) => [path.leverage, path.principal])).toEqual([
      [2.5, 20n * USDC],
      [2, 20n * USDC],
    ])
  })

  it('is result in with the payout at the staged indices before the group is funded', () => {
    const view = viewWith({
      observationsRecorded: 6,
      resultState: RESULT_STAGED,
      indices: STAGED_INDICES,
    })
    const [twoX, threeX] = todayOffers()
    const slot0 =
      payoffAt(twoX, FIXTURE_ENTRY_LEVELS[0], 250_000n).userClaim +
      payoffAt(threeX, FIXTURE_ENTRY_LEVELS[0], 250_000n).userClaim
    const slot2 = 2n * payoffAt(twoX, FIXTURE_ENTRY_LEVELS[2], 230_000n).userClaim

    const summary = summarizePosition(view, FORECASTS, null, RUNNING_MS)!
    expect(summary.status).toBe('result-in')
    expect(summary.finalPayout).toBe(slot0 + slot2)
    expect(summary.paths.map((path) => path.finalPayout)).toEqual([slot0, slot2])
  })

  it('is result in with the claims the group was funded with', () => {
    const view = viewWith(
      { observationsRecorded: 6, resultState: RESULT_STAGED, indices: STAGED_INDICES },
      {
        state: GROUP_FUNDED_NORMAL,
        buckets: [
          bucket(0, 0, 1, 29_700_000n),
          bucket(1, 0, 1, 5_000_000n),
          bucket(0, 2, 2, 9_900_000n),
        ],
      },
    )
    const summary = summarizePosition(view, FORECASTS, null, RUNNING_MS)!
    expect(summary.status).toBe('result-in')
    expect(summary.finalPayout).toBe(54_500_000n)
    expect(summary.paths.map((path) => path.finalPayout)).toEqual([34_700_000n, 19_800_000n])
  })

  it('is voided when the group was funded void', () => {
    const view = viewWith({}, { state: GROUP_FUNDED_VOID })
    const summary = summarizePosition(view, FORECASTS, null, RUNNING_MS)
    expect(summary).toMatchObject({ status: 'voided', principal: 40n * USDC, finalPayout: null })
  })

  it('is paid once the keeper paid and closed the receipt', () => {
    const summary = summarizePosition(closedView(), FORECASTS, paidHistory(54_500_000n), RUNNING_MS)
    expect(summary).toEqual({
      status: 'paid',
      principal: 40n * USDC,
      checkpoint: 6,
      totalCheckpoints: 6,
      finalPayout: null,
      paid: 54_500_000n,
      paths: [],
    })
  })

  it('is voided when the closed receipt paid back exactly its principal, as a group voids on its own', () => {
    const summary = summarizePosition(closedView(), FORECASTS, paidHistory(40n * USDC), RUNNING_MS)
    expect(summary).toMatchObject({ status: 'voided', principal: 40n * USDC, paid: 40n * USDC })
  })

  it('is null without a receipt until the history shows the payment', () => {
    const unpaid: ReceiptHistory = { principal: 40n * USDC, paid: null, claimSignature: null }
    expect(summarizePosition(closedView(), FORECASTS, null, RUNNING_MS)).toBeNull()
    expect(summarizePosition(closedView(), FORECASTS, unpaid, RUNNING_MS)).toBeNull()
  })

  describe('after the keeper closed the group and the epoch (Ruling 18)', () => {
    /** The cohort lingers a while after the group and epoch close. */
    const cohortOnly = (): Mode2MarketView => ({
      ...closedView(),
      group: null,
      epoch: null,
      pair: null,
    })

    it('is paid from the history alone once the cohort is closed too', () => {
      expect(summarizePosition(null, null, paidHistory(54_500_000n), RUNNING_MS)).toEqual({
        status: 'paid',
        principal: 40n * USDC,
        checkpoint: 0,
        totalCheckpoints: 0,
        finalPayout: null,
        paid: 54_500_000n,
        paths: [],
      })
    })

    it('is voided from the history alone once the cohort is closed too', () => {
      expect(summarizePosition(null, null, paidHistory(40n * USDC), RUNNING_MS)).toMatchObject({
        status: 'voided',
        principal: 40n * USDC,
        paid: 40n * USDC,
        paths: [],
      })
    })

    it('is paid or voided from the history while only the cohort is left', () => {
      expect(
        summarizePosition(cohortOnly(), FORECASTS, paidHistory(54_500_000n), RUNNING_MS),
      ).toEqual({
        status: 'paid',
        principal: 40n * USDC,
        checkpoint: 6,
        totalCheckpoints: 6,
        finalPayout: null,
        paid: 54_500_000n,
        paths: [],
      })
      expect(
        summarizePosition(cohortOnly(), FORECASTS, paidHistory(40n * USDC), RUNNING_MS),
      ).toMatchObject({ status: 'voided', principal: 40n * USDC })
    })

    it('is null without a history', () => {
      expect(summarizePosition(null, null, null, RUNNING_MS)).toBeNull()
      expect(summarizePosition(cohortOnly(), FORECASTS, null, RUNNING_MS)).toBeNull()
    })
  })

  it('shows the summary without the path rows while the forecasts are unread', () => {
    const summary = summarizePosition(viewWith(), null, null, BEFORE_START_MS)
    expect(summary).toMatchObject({ status: 'waiting', principal: 40n * USDC, paths: [] })
  })

  it('keys history by owner', () => {
    expect(mode2Keys.history(142, 'A')).not.toEqual(mode2Keys.history(142, 'B'))
  })
})
