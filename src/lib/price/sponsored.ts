/**
 * Pyth's sponsored push feed: Pyth keeps one PriceUpdateV2 account per feed and shard up to date.
 * The derivation and the decode are copied from levx-infra keeper/src/sponsored-feed.ts, returning
 * the price as a number.
 */
import { PublicKey } from '@solana/web3.js'
import type { AccountInfo, Connection } from '@solana/web3.js'

/** Pyth's Solana Receiver, owner of every PriceUpdateV2 account; the same on every cluster. */
export const PYTH_RECEIVER_PROGRAM_ID = new PublicKey('rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ')
/** Pyth's Push Oracle, under which the sponsored feed addresses derive; the same on every cluster. */
export const PYTH_PUSH_ORACLE_PROGRAM_ID = new PublicKey(
  'pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT',
)

const FEED_ID_HEX = /^(0x)?[0-9a-f]{64}$/i

/** Lowercase hex, no 0x. */
const normalizeFeedId = (feedIdHex: string) => feedIdHex.replace(/^0x/i, '').toLowerCase()

/** Seeds `[shard as u16 LE, the 32-byte feed id]` under the push oracle program; 0x optional. */
export function sponsoredFeedAddress(feedIdHex: string, shard = 0): PublicKey {
  if (!FEED_ID_HEX.test(feedIdHex)) throw new Error('sponsored feed id must be 32 bytes of hex')
  const shardSeed = Buffer.alloc(2)
  shardSeed.writeUInt16LE(shard)
  const feed = Buffer.from(normalizeFeedId(feedIdHex), 'hex')
  return PublicKey.findProgramAddressSync([shardSeed, feed], PYTH_PUSH_ORACLE_PROGRAM_ID)[0]
}

export interface SponsoredUpdate {
  /** Lowercase hex, no 0x. */
  feedIdHex: string
  /** price × 10^exponent */
  price: number
  /** unix seconds */
  publishTime: number
  /** Full verification; false for Partial */
  full: boolean
}

/** PriceUpdateV2 (pyth_solana_receiver_sdk): Anchor discriminator, write authority, VerificationLevel, PriceFeedMessage, posted_slot. */
const PRICE_UPDATE_V2_DISCRIMINATOR = Buffer.from([0x22, 0xf1, 0x23, 0x63, 0x9d, 0x7e, 0xf4, 0xcd])
const VERIFICATION_OFFSET = 40
const VERIFICATION_PARTIAL = 0
const VERIFICATION_FULL = 1
/** PriceFeedMessage (84 bytes) then posted_slot (8), from the message start. */
const MSG = { feedId: 0, price: 32, exponent: 48, publishTime: 52, end: 92 } as const

/** Little-endian throughout; null on a short buffer, a wrong discriminator or an unknown verification level. */
export function decodePriceUpdateV2(data: Uint8Array): SponsoredUpdate | null {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  if (buf.length < VERIFICATION_OFFSET + 1) return null
  if (!buf.subarray(0, 8).equals(PRICE_UPDATE_V2_DISCRIMINATOR)) return null
  const level = buf[VERIFICATION_OFFSET]
  let m: number
  if (level === VERIFICATION_FULL) m = VERIFICATION_OFFSET + 1
  // Partial carries its signature count at 41, so its message starts one byte later.
  else if (level === VERIFICATION_PARTIAL) m = VERIFICATION_OFFSET + 2
  else return null
  if (buf.length < m + MSG.end) return null
  return {
    feedIdHex: buf.subarray(m + MSG.feedId, m + MSG.feedId + 32).toString('hex'),
    price: Number(buf.readBigInt64LE(m + MSG.price)) * 10 ** buf.readInt32LE(m + MSG.exponent),
    publishTime: Number(buf.readBigInt64LE(m + MSG.publishTime)),
    full: level === VERIFICATION_FULL,
  }
}

/**
 * Reads the feed's sponsored account once, then follows its changes. Calls `missing()` when the
 * account is absent or not owned by the receiver; delivers only Full updates for this feed id.
 * A failed first read reports nothing (it says nothing about the account).
 */
export function subscribeSponsored(
  connection: Connection,
  feedIdHex: string,
  on: { update(u: SponsoredUpdate): void; missing(): void },
): () => void {
  const address = sponsoredFeedAddress(feedIdHex)
  const expected = normalizeFeedId(feedIdHex)
  let active = true
  // Once a change has arrived, the first read's answer is older and is dropped.
  let changed = false

  function handle(info: AccountInfo<Buffer> | null) {
    if (!info || !info.owner.equals(PYTH_RECEIVER_PROGRAM_ID)) {
      on.missing()
      return
    }
    const u = decodePriceUpdateV2(info.data)
    if (u && u.full && u.feedIdHex === expected) on.update(u)
  }

  connection.getAccountInfo(address, 'confirmed').then(
    (info) => {
      if (active && !changed) handle(info)
    },
    () => {},
  )
  const subscriptionId = connection.onAccountChange(
    address,
    (info) => {
      if (!active) return
      changed = true
      handle(info)
    },
    'confirmed',
  )

  return () => {
    if (!active) return
    active = false
    connection.removeAccountChangeListener(subscriptionId).catch(() => {})
  }
}
