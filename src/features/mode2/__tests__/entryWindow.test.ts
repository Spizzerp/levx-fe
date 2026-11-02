// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { EPOCH_ACTIVE, EPOCH_WIND_DOWN, GROUP_CLOSED } from '@spizzerp/levx-mode2-client'
import type { FundingEpoch, NettingGroup } from '@spizzerp/levx-mode2-client'
import { CLOSE_MARGIN_MS, entryState } from '../entryWindow'
import type { Mode2MarketView } from '../types'
import { FIXTURE_START_MS, makeEpoch, makeGroup, makeView, todayOffers } from './fixtures'

/** Two minutes before the start: the group is bound and both offers are open. */
const NOW_MS = FIXTURE_START_MS - 120_000
const START_SECONDS = BigInt(FIXTURE_START_MS / 1000)

/** Market 142's view with `o`'s accounts in place of the fixture's, at the same addresses. */
function viewWith(o: { group?: NettingGroup; epoch?: FundingEpoch }): Mode2MarketView {
  const view = makeView()
  return {
    ...view,
    group: view.group && { ...view.group, data: o.group ?? view.group.data },
    epoch: view.epoch && { ...view.epoch, data: o.epoch ?? view.epoch.data },
  }
}

describe('entryState', () => {
  it('is none without a view or a group', () => {
    expect(entryState(null, 'pending', NOW_MS)).toEqual({ kind: 'none' })
    expect(entryState(makeView({ group: null }), 'pending', NOW_MS)).toEqual({ kind: 'none' })
  })

  it('waits for the bind while the group is unbound before the start', () => {
    const unbound = viewWith({ group: makeGroup({ bound: 0, boundAt: 0n }) })
    expect(entryState(unbound, 'pending', NOW_MS)).toEqual({ kind: 'waiting-bind' })
    // The paths never arrived: at the start, or once the market leaves Pending, entry is closed.
    expect(entryState(unbound, 'pending', FIXTURE_START_MS)).toEqual({ kind: 'closed' })
    expect(entryState(unbound, 'active', NOW_MS)).toEqual({ kind: 'closed' })
  })

  it('is open on a bound, open group and closes at the start', () => {
    expect(entryState(makeView(), 'pending', NOW_MS)).toEqual({
      kind: 'open',
      closesAtMs: FIXTURE_START_MS,
    })
  })

  it('closes at the admission cutoff when it comes before the start', () => {
    const view = viewWith({ epoch: makeEpoch({ admissionCutoff: START_SECONDS - 60n }) })
    expect(entryState(view, 'pending', NOW_MS)).toEqual({
      kind: 'open',
      closesAtMs: FIXTURE_START_MS - 60_000,
    })
  })

  it('closes when the last offer expires', () => {
    const [two, three] = todayOffers()
    const group = makeGroup({
      offers: [
        { ...two, expiresAt: START_SECONDS - 100n },
        { ...three, expiresAt: START_SECONDS - 30n },
      ],
    })
    // The 2× offer has expired: it loses only its own steps, and entry stays open on the 3× offer.
    expect(entryState(viewWith({ group }), 'pending', FIXTURE_START_MS - 90_000)).toEqual({
      kind: 'open',
      closesAtMs: FIXTURE_START_MS - 30_000,
    })
    expect(entryState(viewWith({ group }), 'pending', FIXTURE_START_MS - 40_000)).toEqual({
      kind: 'closed',
    })
    // An offer past the offer count is not on the menu.
    const twoOnly = viewWith({ group: { ...group, offerCount: 1 } })
    expect(entryState(twoOnly, 'pending', NOW_MS)).toEqual({
      kind: 'open',
      closesAtMs: FIXTURE_START_MS - 100_000,
    })
  })

  it('stays open when every offer is full', () => {
    // Fills do not close entry: the steps disable instead, with the pre-check's reason.
    const offers = todayOffers().map((offer) => ({ ...offer, admitted: offer.maxAdmissions }))
    expect(entryState(viewWith({ group: makeGroup({ offers }) }), 'pending', NOW_MS)).toEqual({
      kind: 'open',
      closesAtMs: FIXTURE_START_MS,
    })
  })

  it('is closed 9 s before the close', () => {
    expect(entryState(makeView(), 'pending', FIXTURE_START_MS - 9_000)).toEqual({ kind: 'closed' })
    expect(entryState(makeView(), 'pending', FIXTURE_START_MS - CLOSE_MARGIN_MS)).toEqual({
      kind: 'closed',
    })
    expect(entryState(makeView(), 'pending', FIXTURE_START_MS - 11_000)).toEqual({
      kind: 'open',
      closesAtMs: FIXTURE_START_MS,
    })
  })

  it('is closed whenever the program would refuse the batch', () => {
    const refused: Mode2MarketView[] = [
      makeView({ paused: true }),
      makeView({ epoch: null }),
      viewWith({ epoch: makeEpoch({ phase: EPOCH_WIND_DOWN }) }),
      viewWith({ group: makeGroup({ state: GROUP_CLOSED }) }),
      viewWith({ group: makeGroup({ offers: [] }) }),
    ]
    for (const view of refused) {
      expect(entryState(view, 'pending', NOW_MS)).toEqual({ kind: 'closed' })
    }
    expect(entryState(makeView(), 'active', NOW_MS)).toEqual({ kind: 'closed' })
    // The fixture itself is open under the same clock: each case above is closed by its own change.
    expect(makeEpoch().phase).toBe(EPOCH_ACTIVE)
    expect(entryState(makeView(), 'pending', NOW_MS).kind).toBe('open')
  })
})
