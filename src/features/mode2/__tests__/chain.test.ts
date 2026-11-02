// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import type { AccountInfo, Connection } from '@solana/web3.js'
import type { Address } from '@solana/kit'
import {
  LEVX_MODE2_PROGRAM_ADDRESS,
  cohortPda,
  configPda,
  epochPda,
  forecastPda,
  getCohortEncoder,
  getFundingEpochEncoder,
  getMode2ConfigEncoder,
  getNettingGroupEncoder,
  getPairExposureEncoder,
  getPathForecastEncoder,
  getPositionReceiptEncoder,
  groupPda,
  mode1MarketPda,
  pairPda,
  positionPda,
} from '@spizzerp/levx-mode2-client'
import { fetchMode2Forecasts, fetchMode2Market } from '../chain'
import {
  FIXTURE_OWNER,
  makeCohort,
  makeConfig,
  makeEpoch,
  makeForecast,
  makeGroup,
  makePair,
  makeReceipt,
  makeView,
} from './fixtures'

const MARKET = mode1MarketPda(142n)
const COHORT = cohortPda(MARKET)
const EPOCH = epochPda(61n)
const GROUP_0 = groupPda(COHORT, 0)
const PAIR = pairPda(EPOCH, makeCohort().baseMint, makeCohort().quoteMint)
const OTHER_OWNER = 'DrB2hHfWzMcAAEjNSF58726aAFhjGiD4ka56RPKPFpo' as Address

function accountInfo(data: Uint8Array): AccountInfo<Buffer> {
  return {
    data: Buffer.from(data),
    executable: false,
    lamports: 1,
    owner: new PublicKey(LEVX_MODE2_PROGRAM_ADDRESS),
    rentEpoch: 0,
  }
}

/** A connection serving `accounts` by address; `rounds` records the addresses of each call. */
function fakeConnection(accounts: ReadonlyMap<string, Uint8Array>) {
  const rounds: string[][] = []
  const connection = {
    getMultipleAccountsInfo: async (keys: PublicKey[]) => {
      const round = keys.map((key) => key.toBase58())
      rounds.push(round)
      return round.map((address) => {
        const data = accounts.get(address)
        return data === undefined ? null : accountInfo(data)
      })
    },
  } as unknown as Connection
  return { connection, rounds }
}

/** Market 142 on chain: the config, the cohort, group 0, epoch 61, its pair and the owner's receipt. */
function marketAccounts(): Map<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    [configPda(), new Uint8Array(getMode2ConfigEncoder().encode(makeConfig()))],
    [COHORT, new Uint8Array(getCohortEncoder().encode(makeCohort()))],
    [GROUP_0, new Uint8Array(getNettingGroupEncoder().encode(makeGroup()))],
    [EPOCH, new Uint8Array(getFundingEpochEncoder().encode(makeEpoch()))],
    [PAIR, new Uint8Array(getPairExposureEncoder().encode(makePair()))],
    [
      positionPda(GROUP_0, FIXTURE_OWNER),
      new Uint8Array(getPositionReceiptEncoder().encode(makeReceipt([1, 1]))),
    ],
  ])
}

function forecastAccounts(pathIndices: readonly number[], incompleteSlot?: number) {
  return new Map<string, Uint8Array>(
    pathIndices.map((pathIndex, slot) => [
      forecastPda(COHORT, slot),
      new Uint8Array(
        getPathForecastEncoder().encode(
          makeForecast(slot, pathIndex, { complete: slot === incompleteSlot ? 0 : 1 }),
        ),
      ),
    ]),
  )
}

describe('fetchMode2Market', () => {
  it('returns null for a market without a cohort', async () => {
    const accounts = marketAccounts()
    accounts.delete(COHORT)
    const { connection, rounds } = fakeConnection(accounts)

    expect(await fetchMode2Market(connection, 142, FIXTURE_OWNER)).toBeNull()
    expect(rounds).toEqual([[configPda(), COHORT]])
  })

  it('reads the cohort, the lowest-index group, its epoch, the pair and the config', async () => {
    const accounts = marketAccounts()
    // Group 0 is gone (closed); groups 1 and 2 exist: the reader takes group 1.
    accounts.delete(GROUP_0)
    accounts.set(COHORT, new Uint8Array(getCohortEncoder().encode(makeCohort({ groupCount: 3 }))))
    accounts.set(
      groupPda(COHORT, 1),
      new Uint8Array(getNettingGroupEncoder().encode(makeGroup({ groupIndex: 1 }))),
    )
    accounts.set(
      groupPda(COHORT, 2),
      new Uint8Array(getNettingGroupEncoder().encode(makeGroup({ groupIndex: 2 }))),
    )
    const { connection, rounds } = fakeConnection(accounts)

    const view = await fetchMode2Market(connection, 142, null)

    expect(view).not.toBeNull()
    expect(view?.marketId).toBe(142)
    expect(view?.market).toBe(MARKET)
    expect(view?.paused).toBe(false)
    expect(view?.cohort).toEqual({ address: COHORT, data: makeCohort({ groupCount: 3 }) })
    expect(view?.group).toEqual({
      address: groupPda(COHORT, 1),
      data: makeGroup({ groupIndex: 1 }),
    })
    expect(view?.epoch).toEqual({ address: EPOCH, data: makeEpoch() })
    expect(view?.pair).toEqual({ address: PAIR, data: makePair() })
    // One round per dependency level: config + cohort, the groups, then epoch + pair.
    expect(rounds).toEqual([
      [configPda(), COHORT],
      [GROUP_0, groupPda(COHORT, 1), groupPda(COHORT, 2)],
      [EPOCH, PAIR],
    ])
  })

  it('treats a paused or missing config as paused', async () => {
    const paused = marketAccounts()
    paused.set(
      configPda(),
      new Uint8Array(getMode2ConfigEncoder().encode(makeConfig({ paused: true }))),
    )
    const missing = marketAccounts()
    missing.delete(configPda())

    expect((await fetchMode2Market(fakeConnection(paused).connection, 142, null))?.paused).toBe(
      true,
    )
    expect((await fetchMode2Market(fakeConnection(missing).connection, 142, null))?.paused).toBe(
      true,
    )
  })

  it("reads the owner's receipt and leaves it null without an owner", async () => {
    const receipt = positionPda(GROUP_0, FIXTURE_OWNER)

    const withOwner = await fetchMode2Market(
      fakeConnection(marketAccounts()).connection,
      142,
      FIXTURE_OWNER,
    )
    expect(withOwner?.owner).toBe(FIXTURE_OWNER)
    expect(withOwner?.receipt).toEqual({ address: receipt, data: makeReceipt([1, 1]) })
    expect(withOwner?.receipt?.data.positions).toBe(2)

    const anonymous = fakeConnection(marketAccounts())
    const withoutOwner = await fetchMode2Market(anonymous.connection, 142, null)
    expect(withoutOwner?.owner).toBeNull()
    expect(withoutOwner?.receipt).toBeNull()
    expect(anonymous.rounds.flat()).not.toContain(receipt)

    // Another wallet reads its own receipt address, not the first owner's.
    const other = fakeConnection(marketAccounts())
    const otherView = await fetchMode2Market(other.connection, 142, OTHER_OWNER)
    expect(otherView?.owner).toBe(OTHER_OWNER)
    expect(otherView?.receipt).toBeNull()
    expect(other.rounds[2]).toEqual([EPOCH, PAIR, positionPda(GROUP_0, OTHER_OWNER)])
  })

  it('ignores an account with the wrong size or discriminator', async () => {
    const good = new Uint8Array(getNettingGroupEncoder().encode(makeGroup()))
    const truncated = good.slice(0, good.length - 1)
    // One byte too long still decodes: only the exact-size rule refuses it.
    const overlong = Uint8Array.of(...good, 0)
    const wrongDiscriminator = good.slice()
    wrongDiscriminator[0] = (wrongDiscriminator[0] + 1) % 256

    for (const bytes of [truncated, overlong, wrongDiscriminator]) {
      const accounts = marketAccounts()
      accounts.set(GROUP_0, bytes)
      const { connection, rounds } = fakeConnection(accounts)

      const view = await fetchMode2Market(connection, 142, FIXTURE_OWNER)

      expect(view).not.toBeNull()
      expect(view?.group).toBeNull()
      expect(view?.epoch).toBeNull()
      expect(view?.pair).toBeNull()
      expect(view?.receipt).toBeNull()
      expect(rounds).toHaveLength(2)
    }
  })
})

describe('fetchMode2Forecasts', () => {
  it('maps forecast slots to Mode 1 path indices', async () => {
    const { connection, rounds } = fakeConnection(forecastAccounts([4, 0, 1, 2, 3]))

    const forecasts = await fetchMode2Forecasts(connection, makeView())

    expect(forecasts?.slotToPathIndex).toEqual([4, 0, 1, 2, 3])
    expect(forecasts?.prices).toHaveLength(5)
    // Each slot keeps the cohort's 6 checkpoints of its 480-entry account.
    expect(forecasts?.prices[0]).toEqual(makeForecast(0, 4).prices.slice(0, 6))
    expect(forecasts?.prices[2]).toEqual(makeForecast(2, 1).prices.slice(0, 6))
    expect(rounds).toEqual([[0, 1, 2, 3, 4].map((slot) => forecastPda(COHORT, slot))])
  })

  it('returns no forecasts while one slot is incomplete', async () => {
    const incomplete = fakeConnection(forecastAccounts([4, 0, 1, 2, 3], 3))
    expect(await fetchMode2Forecasts(incomplete.connection, makeView())).toBeNull()

    const missing = forecastAccounts([4, 0, 1, 2, 3])
    missing.delete(forecastPda(COHORT, 4))
    expect(await fetchMode2Forecasts(fakeConnection(missing).connection, makeView())).toBeNull()

    // A slot missing from the cohort's mask is not read at all.
    const unmasked = fakeConnection(forecastAccounts([4, 0, 1, 2, 3]))
    const view = makeView({
      cohort: { address: COHORT, data: makeCohort({ forecastMask: 0b10111 }) },
    })
    expect(await fetchMode2Forecasts(unmasked.connection, view)).toBeNull()
    expect(unmasked.rounds).toEqual([])
  })
})
