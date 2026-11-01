/**
 * Test fixtures: market 142 as it stood on devnet before its start (spec §1). A cohort of k = 5 AI
 * paths starting at 15:00Z with 6 checkpoints of 10 minutes; one bound, open group with today's
 * offers; epoch 61 active with 200 USDC of LP cash under the rehearsal caps. Every builder returns
 * the decoded shape, which the client's encoders accept as is.
 */
import { none } from '@solana/kit'
import type { Address } from '@solana/kit'
import {
  BUCKET_CLAIMS,
  BUCKET_ESCROW,
  BUCKET_LP,
  COHORT_DISCRIMINATOR,
  EPOCH_ACTIVE,
  FUNDING_EPOCH_DISCRIMINATOR,
  GROUP_OPEN,
  MODE2_CONFIG_DISCRIMINATOR,
  NETTING_GROUP_DISCRIMINATOR,
  PAIR_EXPOSURE_DISCRIMINATOR,
  PATH_FORECAST_DISCRIMINATOR,
  POLICY_INDIVIDUAL,
  POSITION_RECEIPT_DISCRIMINATOR,
  RESULT_NONE,
  RULE_RANK_MULTIPLIERS_V1,
  associatedTokenAddress,
  cashPda,
  cohortPda,
  epochPda,
  groupPda,
  mode1MarketPda,
  mode1PathPda,
  pairPda,
} from '@spizzerp/levx-mode2-client'
import type {
  Bucket,
  Cohort,
  FundingEpoch,
  Mode2Config,
  NettingGroup,
  Offer,
  PairExposure,
  PathForecast,
  PositionReceipt,
  RiskCaps,
} from '@spizzerp/levx-mode2-client'
import type { Mode2MarketView } from '../types'

/** The market's start, 15:00Z. */
export const FIXTURE_START_MS = 1_793_545_200_000
export const FIXTURE_MARKET_ID = 142
/** The trader: a fixed address that is nobody's wallet. */
export const FIXTURE_OWNER = 'kgERWXbLfq6MHcWLd86a5dpmSvM86QhQrQjL2gGPbnD' as Address
/** The rank row at k = 5: `SCALE × multiplier / k` for the multipliers below. */
export const FIXTURE_ENTRY_LEVELS = [210600n, 208400n, 204200n, 190000n, 186800n]

const START = BigInt(FIXTURE_START_MS / 1000)
const K = 5
const TOTAL_CHECKPOINTS = 6
const CHECKPOINT_INTERVAL = 600
const REVIEW_INTERVAL = 600n
const EPOCH_ID = 61n
/** Every path of the cohort, as an offer's `permittedPaths` mask. */
const ALL_PATHS = (1 << K) - 1
const MULTIPLIERS_PPM = [1_053_000, 1_042_000, 1_021_000, 950_000, 934_000]
/** Priors in slot order, highest first, so the rank row is the slot row. */
const PRIORS_BPS = [2400, 2200, 2000, 1800, 1600]
const CLUSTER_MAP = [0, 1, 2, 3, 4]

const SOL_MINT = 'So11111111111111111111111111111111111111112' as Address
const USDC_MINT = '6xz4EVw6rYFnfJwgumXsBt28xgjvKjpAWpwzdvPUJkhz' as Address
/** Payer, authority and recipient of every fixture account. */
const OPERATOR = 'MQik1CL4pkMV5LJ6g17Dy5kzDtrzdBDazr55PHVWt7Z' as Address

const MARKET = mode1MarketPda(BigInt(FIXTURE_MARKET_ID))
const COHORT = cohortPda(MARKET)
const EPOCH = epochPda(EPOCH_ID)
const GROUP_0 = groupPda(COHORT, 0)

/** The rehearsal caps (spec §1). */
const REHEARSAL_CAPS: RiskCaps = {
  maxPositionCollateral: 10_000_000n,
  maxPositionNotional: 30_000_000n,
  maxGroupReserve: 200_000_000n,
  maxEpochReservation: 200_000_000n,
  maxPairNotional: 1_000_000_000n,
  maxMarketNotional: 1_000_000_000n,
  maxPathNotional: 250_000_000n,
  maxClusterNotional: 250_000_000n,
  maxGroupPositions: 32,
  maxLpOwners: 16,
}

/** `items` followed by `fill()` up to `size` entries: the client's arrays are fixed length. */
function pad<T>(items: readonly T[], size: number, fill: () => T): T[] {
  return Array.from({ length: size }, (_, i) => (i < items.length ? items[i] : fill()))
}

const bytes = (size: number, value = 0): Uint8Array => new Uint8Array(size).fill(value)
const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

function zeroOffer(): Offer {
  return {
    collateral: 0n,
    profitCap: 0n,
    capacityFee: 0n,
    expiresAt: 0n,
    digest: bytes(32),
    permittedPaths: 0,
    protocolShareBps: 0,
    maxAdmissions: 0,
    admitted: 0,
    leverage: 0,
    pad: bytes(7),
  }
}

function zeroBucket(): Bucket {
  return { claim: 0n, count: 0, offerSlot: 0, path: 0, pad: bytes(2) }
}

/** An offer expiring at the start, open to every path; its digest is filled with `slot + 1`. */
function offer(
  slot: number,
  terms: Pick<Offer, 'leverage' | 'collateral' | 'profitCap' | 'capacityFee' | 'maxAdmissions'>,
): Offer {
  return {
    ...zeroOffer(),
    ...terms,
    expiresAt: START,
    digest: bytes(32, slot + 1),
    permittedPaths: ALL_PATHS,
    protocolShareBps: 1000,
  }
}

/** Today's offers: 2× and 3× at 10 USDC, profit caps 20 and 10 USDC, fees 0.10 and 0.20 USDC. */
export function todayOffers(): Offer[] {
  const terms = { collateral: 10_000_000n, maxAdmissions: 16 }
  return [
    offer(0, { ...terms, leverage: 2, profitCap: 20_000_000n, capacityFee: 100_000n }),
    offer(1, { ...terms, leverage: 3, profitCap: 10_000_000n, capacityFee: 200_000n }),
  ]
}

/** The 1 USDC offers of spec §7: 1×–4×, fees 0.005–0.03 USDC, profit caps 1–4 USDC. */
export function dollarOffers(): Offer[] {
  const fees = [5_000n, 10_000n, 20_000n, 30_000n]
  return fees.map((capacityFee, slot) =>
    offer(slot, {
      leverage: slot + 1,
      collateral: 1_000_000n,
      profitCap: BigInt(slot + 1) * 1_000_000n,
      capacityFee,
      maxAdmissions: 160,
    }),
  )
}

export function makeCohort(o: Partial<Cohort> = {}): Cohort {
  return {
    discriminator: COHORT_DISCRIMINATOR,
    version: 1,
    bump: 255,
    payer: OPERATOR,
    market: MARKET,
    marketId: BigInt(FIXTURE_MARKET_ID),
    baseMint: SOL_MINT,
    quoteMint: USDC_MINT,
    pythFeedId: bytes(32),
    startTime: START,
    checkpointInterval: CHECKPOINT_INTERVAL,
    totalCheckpoints: TOTAL_CHECKPOINTS,
    k: K,
    clusterMap: Uint8Array.from(pad(CLUSTER_MAP, 16, () => 0)),
    scoring: {
      alpha: 500_000n,
      beta: 500_000n,
      referenceAction: 1_000_000n,
      weightQv: 250_000n,
      weightDd: 250_000n,
      weightEndpoint: 250_000n,
      weightDisplacement: 250_000n,
    },
    oracle: { grace: 60n, maxUpdateAge: 30n, maxConfidenceBps: 200 },
    reviewInterval: REVIEW_INTERVAL,
    groupsOpen: 1,
    forecastsOpen: K,
    hasObservations: true,
    hasFinality: false,
    forecastMask: ALL_PATHS,
    sealed: true,
    observationsRecorded: 0,
    notionalTotal: 0n,
    resultState: RESULT_NONE,
    indices: pad([], 16, () => 0n),
    stagedAt: 0n,
    reviewUntil: 0n,
    scorerVersion: 1,
    finalityState: 0,
    groupCount: 1,
    forecastCommitments: pad([], 16, () => bytes(32)),
    cohortDigest: bytes(32),
    priorsBps: pad(PRIORS_BPS, 16, () => 0),
    ...o,
  }
}

/**
 * Group 0, bound and open, with today's offers. `offers`, `buckets` and `entryLevels` take only
 * the real entries: they are padded to the account's length, and `offerCount`, `bucketCount` and
 * `positions` follow them unless given.
 */
export function makeGroup(o: Partial<NettingGroup> = {}): NettingGroup {
  const offers = o.offers ?? todayOffers()
  const buckets = o.buckets ?? []
  return {
    discriminator: NETTING_GROUP_DISCRIMINATOR,
    pathTerms: pad([], 16, () => bytes(16)),
    multipliersPpm: pad(MULTIPLIERS_PPM, 16, () => 0),
    lambdaFp: bytes(16),
    matchedReserve: bytes(16),
    controlReserve: bytes(16),
    epochId: EPOCH_ID,
    resolutionDeadline: START + BigInt(TOTAL_CHECKPOINTS * CHECKPOINT_INTERVAL) + 86_400n,
    groupCollateral: 0n,
    groupReserve: 0n,
    protocolClaim: 0n,
    lpFeeRetained: 0n,
    fundedAt: 0n,
    startTime: START,
    reviewSeconds: REVIEW_INTERVAL,
    boundAt: START - 180n,
    oracleGrace: 60n,
    oracleMaxUpdateAge: 30n,
    payer: OPERATOR,
    cohort: COHORT,
    market: MARKET,
    cohortDigest: bytes(32),
    groupIndex: 0,
    receiptCount: 0,
    receiptsOpen: 0,
    oracleMaxConfidenceBps: 200,
    version: 1,
    bump: 255,
    policy: POLICY_INDIVIDUAL,
    k: K,
    state: GROUP_OPEN,
    protocolConsumed: 0,
    ruleKind: RULE_RANK_MULTIPLIERS_V1,
    clusterMap: Uint8Array.from(pad(CLUSTER_MAP, 16, () => 0)),
    provenanceOrigin: 0,
    bound: 1,
    pad: bytes(1),
    ...o,
    offers: pad(offers, 16, zeroOffer),
    offerCount: o.offerCount ?? offers.length,
    buckets: pad(buckets, 24, zeroBucket),
    bucketCount: o.bucketCount ?? buckets.length,
    positions: o.positions ?? sum(buckets.map((bucket) => bucket.count)),
    entryLevels: pad(o.entryLevels ?? FIXTURE_ENTRY_LEVELS, 16, () => 0n),
  }
}

/** Epoch 61: active, 200 USDC of LP cash, nothing reserved, admission closing at the start. */
export function makeEpoch(o: Partial<FundingEpoch> = {}): FundingEpoch {
  return {
    discriminator: FUNDING_EPOCH_DISCRIMINATOR,
    version: 1,
    bump: 255,
    payer: OPERATOR,
    epochId: EPOCH_ID,
    policy: POLICY_INDIVIDUAL,
    phase: EPOCH_ACTIVE,
    caps: REHEARSAL_CAPS,
    termsDigest: bytes(32),
    fundingClose: START - 3_600n,
    admissionCutoff: START,
    resolutionBound: START + 2n * 86_400n,
    reviewInterval: REVIEW_INTERVAL,
    mint: USDC_MINT,
    lpAccount: cashPda(EPOCH, BUCKET_LP),
    escrowAccount: cashPda(EPOCH, BUCKET_ESCROW),
    claimsAccount: cashPda(EPOCH, BUCKET_CLAIMS),
    protocolRecipient: OPERATOR,
    dustRecipient: OPERATOR,
    donationRecipient: OPERATOR,
    lp: 200_000_000n,
    escrow: 0n,
    reserved: 0n,
    claims: 0n,
    receiptsTotal: 0n,
    lpOwnerCount: 1,
    depositsTotal: 200_000_000n,
    withdrawalsTotal: 0n,
    aSnapshot: 0n,
    sLp: 0n,
    dustClaim: 0n,
    dustConsumed: false,
    groupCount: 1,
    openGroupCount: 1,
    unpaidClaims: 0n,
    lpClaimsOutstanding: 0n,
    lpReceiptsConsumed: 0,
    groupAccountsOpen: 1,
    receiptsOpen: 0,
    pairAccountsOpen: 1,
    custodyOpen: 3,
    termsOpen: 1,
    ...o,
  }
}

/** Epoch 61's SOL/USDC exposure, empty. */
export function makePair(o: Partial<PairExposure> = {}): PairExposure {
  return {
    discriminator: PAIR_EXPOSURE_DISCRIMINATOR,
    version: 1,
    bump: 255,
    payer: OPERATOR,
    epochId: EPOCH_ID,
    baseMint: SOL_MINT,
    quoteMint: USDC_MINT,
    notionalTotal: 0n,
    ...o,
  }
}

/**
 * The owner's receipt in group 0 with `counts[i]` positions in bucket `i`. `collateral` defaults
 * to 10 USDC per position (today's unit); pass it for other offers.
 */
export function makeReceipt(counts: number[], o: Partial<PositionReceipt> = {}): PositionReceipt {
  return {
    discriminator: POSITION_RECEIPT_DISCRIMINATOR,
    collateral: BigInt(sum(counts)) * 10_000_000n,
    group: GROUP_0,
    owner: FIXTURE_OWNER,
    ownerTokenAccount: associatedTokenAddress(FIXTURE_OWNER, USDC_MINT),
    counts: pad(counts, 24, () => 0),
    positions: sum(counts),
    version: 1,
    bump: 255,
    pad: bytes(2),
    ...o,
  }
}

/** The custody program's config, not paused. */
export function makeConfig(o: Partial<Mode2Config> = {}): Mode2Config {
  return {
    discriminator: MODE2_CONFIG_DISCRIMINATOR,
    version: 2,
    bump: 255,
    payer: OPERATOR,
    authority: OPERATOR,
    pendingAuthority: none(),
    collateralMint: USDC_MINT,
    keeperAuthority: OPERATOR,
    paused: false,
    epochCount: EPOCH_ID + 1n,
    activeCount: 1,
    maxActiveEpochs: 2,
    reserved: bytes(7),
    ...o,
  }
}

/**
 * The complete forecast of cohort `slot`, naming Mode 1 path `pathIndex`: 6 prices near 150 SOL
 * (six-decimal fixed point), distinct per path, padded to the account's 480.
 */
export function makeForecast(
  slot: number,
  pathIndex: number,
  o: Partial<PathForecast> = {},
): PathForecast {
  const prices = Array.from(
    { length: TOTAL_CHECKPOINTS },
    (_, j) => 150_000_000n + BigInt(pathIndex) * 1_000_000n + BigInt(j) * 10_000n,
  )
  return {
    discriminator: PATH_FORECAST_DISCRIMINATOR,
    payer: OPERATOR,
    cohort: COHORT,
    pathOutcome: mode1PathPda(BigInt(FIXTURE_MARKET_ID), pathIndex),
    pathUpload: OPERATOR,
    pathRoot: bytes(32),
    creator: OPERATOR,
    chunkHashes: pad([], 12, () => bytes(32)),
    chunkMask: 1,
    version: 1,
    bump: 255,
    pathIndex,
    origin: 0,
    chunkCount: 1,
    complete: 1,
    slot,
    pad: bytes(7),
    ...o,
    prices: pad(o.prices ?? prices, 480, () => 0n),
  }
}

/** Market 142 as the reader returns it for `FIXTURE_OWNER` before any admission: no receipt. */
export function makeView(o: Partial<Mode2MarketView> = {}): Mode2MarketView {
  return {
    marketId: FIXTURE_MARKET_ID,
    market: MARKET,
    owner: FIXTURE_OWNER,
    paused: false,
    cohort: { address: COHORT, data: makeCohort() },
    group: { address: GROUP_0, data: makeGroup() },
    epoch: { address: EPOCH, data: makeEpoch() },
    pair: { address: pairPda(EPOCH, SOL_MINT, USDC_MINT), data: makePair() },
    receipt: null,
    ...o,
  }
}
