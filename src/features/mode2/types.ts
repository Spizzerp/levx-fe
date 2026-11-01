import type {
  Cohort,
  FundingEpoch,
  NettingGroup,
  PairExposure,
  PositionReceipt,
} from '@spizzerp/levx-mode2-client'

/** A decoded custody account and the address it was read from. */
export interface Decoded<T> {
  address: string
  data: T
}

/** What the trade panel reads for one Mode 1 market: its cohort, the group it trades in and the owner's receipt. */
export interface Mode2MarketView {
  marketId: number
  /** The Mode 1 market PDA. */
  market: string
  owner: string | null
  /** True when the custody program is paused or its config cannot be read. */
  paused: boolean
  cohort: Decoded<Cohort>
  /** The lowest-index group of the cohort that exists; null when there is none. */
  group: Decoded<NettingGroup> | null
  epoch: Decoded<FundingEpoch> | null
  pair: Decoded<PairExposure> | null
  receipt: Decoded<PositionReceipt> | null
}

/** The cohort's forecasts by slot: the Mode 1 path index each slot names and its checkpoint prices. */
export interface Mode2Forecasts {
  slotToPathIndex: number[]
  /** `prices[slot]` holds the cohort's `totalCheckpoints` prices, six-decimal fixed point. */
  prices: bigint[][]
}
