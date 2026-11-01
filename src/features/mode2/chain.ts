/**
 * Reads a Mode 1 market's custody accounts (cohort, group, epoch, pair, config and the owner's
 * receipt) and the cohort's forecasts, decoded with the custody client. Reading and decoding only.
 */
import { PublicKey } from '@solana/web3.js'
import type { AccountInfo, Connection } from '@solana/web3.js'
import type { Address, Decoder, ReadonlyUint8Array } from '@solana/kit'
import {
  COHORT_DISCRIMINATOR,
  FUNDING_EPOCH_DISCRIMINATOR,
  MODE2_CONFIG_DISCRIMINATOR,
  NETTING_GROUP_DISCRIMINATOR,
  PAIR_EXPOSURE_DISCRIMINATOR,
  PATH_FORECAST_DISCRIMINATOR,
  POSITION_RECEIPT_DISCRIMINATOR,
  cohortPda,
  configPda,
  epochPda,
  forecastPda,
  getCohortDecoder,
  getCohortSize,
  getFundingEpochDecoder,
  getFundingEpochSize,
  getMode2ConfigDecoder,
  getNettingGroupDecoder,
  getNettingGroupSize,
  getPairExposureDecoder,
  getPairExposureSize,
  getPathForecastDecoder,
  getPathForecastSize,
  getPositionReceiptDecoder,
  getPositionReceiptSize,
  groupPda,
  mode1MarketPda,
  pairPda,
  positionPda,
} from '@spizzerp/levx-mode2-client'
import type { NettingGroup } from '@spizzerp/levx-mode2-client'
import type { Decoded, Mode2Forecasts, Mode2MarketView } from './types'

/**
 * The account decoded, or null when it is missing, is not exactly `size` bytes (`null` skips the
 * size check, for the Borsh config) or does not start with `discriminator` (the keeper's rule).
 */
export function decodeAccount<T>(
  info: AccountInfo<Buffer> | null,
  decoder: Decoder<T>,
  size: number | null,
  discriminator: ReadonlyUint8Array,
): T | null {
  if (info === null) return null
  const data = new Uint8Array(info.data)
  if (size !== null && data.length !== size) return null
  if (!discriminator.every((byte, i) => data[i] === byte)) return null
  try {
    return decoder.decode(data)
  } catch {
    return null
  }
}

function readAccounts(
  connection: Connection,
  addresses: readonly Address[],
): Promise<(AccountInfo<Buffer> | null)[]> {
  return connection.getMultipleAccountsInfo(addresses.map((address) => new PublicKey(address)))
}

const decoded = <T>(address: string, data: T | null): Decoded<T> | null =>
  data === null ? null : { address, data }

/** The lowest-index group of the cohort whose account decodes. */
async function readFirstGroup(
  connection: Connection,
  cohort: Address,
  groupCount: number,
): Promise<{ address: Address; data: NettingGroup } | null> {
  if (groupCount === 0) return null
  const addresses = Array.from({ length: groupCount }, (_, index) => groupPda(cohort, index))
  const infos = await readAccounts(connection, addresses)
  for (const [index, info] of infos.entries()) {
    const data = decodeAccount(
      info,
      getNettingGroupDecoder(),
      getNettingGroupSize(),
      NETTING_GROUP_DISCRIMINATOR,
    )
    if (data !== null) return { address: addresses[index], data }
  }
  return null
}

/**
 * The market's custody accounts, read in one round per dependency level: the config and the
 * cohort, then the cohort's groups, then the group's epoch, the pair and the owner's receipt.
 * Null when the market has no cohort.
 */
export async function fetchMode2Market(
  connection: Connection,
  marketId: number,
  owner: string | null,
): Promise<Mode2MarketView | null> {
  const market = mode1MarketPda(BigInt(marketId))
  const cohortAddress = cohortPda(market)
  const [configInfo, cohortInfo] = await readAccounts(connection, [configPda(), cohortAddress])
  const cohort = decodeAccount(
    cohortInfo,
    getCohortDecoder(),
    getCohortSize(),
    COHORT_DISCRIMINATOR,
  )
  if (cohort === null) return null
  const config = decodeAccount(
    configInfo,
    getMode2ConfigDecoder(),
    null,
    MODE2_CONFIG_DISCRIMINATOR,
  )
  const view: Mode2MarketView = {
    marketId,
    market,
    owner,
    // A config that cannot be read admits nothing: treat it as paused.
    paused: config?.paused ?? true,
    cohort: { address: cohortAddress, data: cohort },
    group: null,
    epoch: null,
    pair: null,
    receipt: null,
  }

  const group = await readFirstGroup(connection, cohortAddress, cohort.groupCount)
  if (group === null) return view

  const epochAddress = epochPda(group.data.epochId)
  const pairAddress = pairPda(epochAddress, cohort.baseMint, cohort.quoteMint)
  const receiptAddress = owner === null ? null : positionPda(group.address, owner as Address)
  const [epochInfo, pairInfo, receiptInfo = null] = await readAccounts(
    connection,
    receiptAddress === null
      ? [epochAddress, pairAddress]
      : [epochAddress, pairAddress, receiptAddress],
  )
  const epoch = decodeAccount(
    epochInfo,
    getFundingEpochDecoder(),
    getFundingEpochSize(),
    FUNDING_EPOCH_DISCRIMINATOR,
  )
  const pair = decodeAccount(
    pairInfo,
    getPairExposureDecoder(),
    getPairExposureSize(),
    PAIR_EXPOSURE_DISCRIMINATOR,
  )
  const receipt = decodeAccount(
    receiptInfo,
    getPositionReceiptDecoder(),
    getPositionReceiptSize(),
    POSITION_RECEIPT_DISCRIMINATOR,
  )
  return {
    ...view,
    group,
    epoch: decoded(epochAddress, epoch),
    pair: decoded(pairAddress, pair),
    receipt: receiptAddress === null ? null : decoded(receiptAddress, receipt),
  }
}

/**
 * The cohort's forecasts for slots `0..k-1`; null until every slot is in the cohort's
 * `forecastMask` and its forecast account is complete.
 */
export async function fetchMode2Forecasts(
  connection: Connection,
  view: Mode2MarketView,
): Promise<Mode2Forecasts | null> {
  const { address, data: cohort } = view.cohort
  const slots = Array.from({ length: cohort.k }, (_, slot) => slot)
  if (slots.some((slot) => (cohort.forecastMask & (1 << slot)) === 0)) return null
  const infos = await readAccounts(
    connection,
    slots.map((slot) => forecastPda(address as Address, slot)),
  )
  const slotToPathIndex: number[] = []
  const prices: bigint[][] = []
  for (const info of infos) {
    const forecast = decodeAccount(
      info,
      getPathForecastDecoder(),
      getPathForecastSize(),
      PATH_FORECAST_DISCRIMINATOR,
    )
    if (forecast === null || forecast.complete !== 1) return null
    slotToPathIndex.push(forecast.pathIndex)
    prices.push(forecast.prices.slice(0, cohort.totalCheckpoints))
  }
  return { slotToPathIndex, prices }
}
