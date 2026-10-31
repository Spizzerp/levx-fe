// @vitest-environment node
// PDA derivation hashes Node Buffers that fail jsdom's Uint8Array check (as in pda.test.ts).

import { describe, it, expect, vi } from 'vitest'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import type { AccountInfo } from '@solana/web3.js'

import {
  PYTH_PUSH_ORACLE_PROGRAM_ID,
  PYTH_RECEIVER_PROGRAM_ID,
  decodePriceUpdateV2,
  sponsoredFeedAddress,
  subscribeSponsored,
} from '@/lib/price/sponsored'
import { PYTH_FEED_IDS } from '@/lib/pyth/feedIds'

const SOL_FEED = PYTH_FEED_IDS['SOL/USDC']
const SOL_FEED_HEX = SOL_FEED.slice(2)
const SOL_USD_SPONSORED = '7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE'
const PRICE_UPDATE_V2_DISCRIMINATOR = [0x22, 0xf1, 0x23, 0x63, 0x9d, 0x7e, 0xf4, 0xcd]
const ACCOUNT_LEN = 134
const PUBLISH_TIME = 1_793_452_698

interface Fields {
  partial?: number
  feedHex: string
  price: bigint
  conf: bigint
  exponent: number
  publishTime: bigint
  prevPublishTime: bigint
  emaPrice: bigint
  emaConf: bigint
  postedSlot: bigint
}

const FULL: Fields = {
  feedHex: SOL_FEED_HEX,
  price: 9_577_000_000n,
  conf: 5_000_000n,
  exponent: -8,
  publishTime: BigInt(PUBLISH_TIME),
  // Distinct neighbours, so a field read one slot off cannot pass.
  prevPublishTime: BigInt(PUBLISH_TIME - 1),
  emaPrice: 9_560_000_000n,
  emaConf: 6_100_000n,
  postedSlot: 515_000_000n,
}

/** A PriceUpdateV2 account as Pyth allocates it: 134 bytes, a Full one leaving the last byte unused. */
function priceUpdateAccount(f: Fields): Buffer {
  const buf = Buffer.alloc(ACCOUNT_LEN)
  Buffer.from(PRICE_UPDATE_V2_DISCRIMINATOR).copy(buf, 0)
  buf.fill(0x11, 8, 40) // write authority
  let m: number
  if (f.partial === undefined) {
    buf[40] = 1
    m = 41
  } else {
    buf[40] = 0
    buf[41] = f.partial
    m = 42
  }
  Buffer.from(f.feedHex, 'hex').copy(buf, m)
  buf.writeBigInt64LE(f.price, m + 32)
  buf.writeBigUInt64LE(f.conf, m + 40)
  buf.writeInt32LE(f.exponent, m + 48)
  buf.writeBigInt64LE(f.publishTime, m + 52)
  buf.writeBigInt64LE(f.prevPublishTime, m + 60)
  buf.writeBigInt64LE(f.emaPrice, m + 68)
  buf.writeBigUInt64LE(f.emaConf, m + 76)
  buf.writeBigUInt64LE(f.postedSlot, m + 84)
  return buf
}

function account(data: Buffer, owner: PublicKey = PYTH_RECEIVER_PROGRAM_ID): AccountInfo<Buffer> {
  return { data, owner, lamports: 1_825_000, executable: false, rentEpoch: 0 }
}

const SUBSCRIPTION_ID = 7

function makeFakeConnection(
  initial: AccountInfo<Buffer> | null | Promise<AccountInfo<Buffer> | null>,
) {
  let registered: ((info: AccountInfo<Buffer>) => void) | null = null
  const getAccountInfo = vi.fn(async (_address: PublicKey, _commitment: string) => initial)
  const onAccountChange = vi.fn(
    (_address: PublicKey, callback: (info: AccountInfo<Buffer>) => void, _commitment: string) => {
      registered = callback
      return SUBSCRIPTION_ID
    },
  )
  const removeAccountChangeListener = vi.fn(async (_id: number) => {})
  return {
    getAccountInfo,
    onAccountChange,
    removeAccountChangeListener,
    fire: (info: AccountInfo<Buffer>) => registered?.(info),
  }
}

/** Lets the initial getAccountInfo promise settle. */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('sponsored', () => {
  it('derives the SOL/USD devnet address', () => {
    expect(PYTH_RECEIVER_PROGRAM_ID.toBase58()).toBe('rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ')
    expect(PYTH_PUSH_ORACLE_PROGRAM_ID.toBase58()).toBe(
      'pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT',
    )
    expect(sponsoredFeedAddress(SOL_FEED).toBase58()).toBe(SOL_USD_SPONSORED)
    expect(sponsoredFeedAddress(SOL_FEED, 0).toBase58()).toBe(SOL_USD_SPONSORED)
    expect(sponsoredFeedAddress(SOL_FEED_HEX.toUpperCase()).toBase58()).toBe(SOL_USD_SPONSORED)
    // Another shard is another account.
    expect(sponsoredFeedAddress(SOL_FEED, 1).toBase58()).not.toBe(SOL_USD_SPONSORED)
    expect(() => sponsoredFeedAddress('0xef0d')).toThrow(/feed id/)
  })

  it('decodes a Full update into a scaled price and publish time', () => {
    const u = decodePriceUpdateV2(priceUpdateAccount(FULL))
    expect(u).not.toBeNull()
    expect(u!.feedIdHex).toBe(SOL_FEED_HEX)
    expect(u!.full).toBe(true)
    expect(u!.price).toBeCloseTo(95.77, 10)
    expect(u!.publishTime).toBe(PUBLISH_TIME)

    // A Partial update decodes with the shifted offset and full: false.
    const partial = decodePriceUpdateV2(
      priceUpdateAccount({ ...FULL, partial: 5, price: -123_456_789n, exponent: -5 }),
    )
    expect(partial).toEqual({
      feedIdHex: SOL_FEED_HEX,
      price: expect.closeTo(-1234.56789, 10),
      publishTime: PUBLISH_TIME,
      full: false,
    })
  })

  it('returns null for a short buffer', () => {
    // A Full account needs 133 bytes, a Partial one all 134.
    expect(decodePriceUpdateV2(priceUpdateAccount(FULL).subarray(0, 133))).not.toBeNull()
    expect(decodePriceUpdateV2(priceUpdateAccount(FULL).subarray(0, 132))).toBeNull()
    expect(
      decodePriceUpdateV2(priceUpdateAccount({ ...FULL, partial: 3 }).subarray(0, 133)),
    ).toBeNull()
    expect(decodePriceUpdateV2(Buffer.from(PRICE_UPDATE_V2_DISCRIMINATOR))).toBeNull()
    expect(decodePriceUpdateV2(new Uint8Array(0))).toBeNull()

    // Malformed: a wrong discriminator or an unknown verification level.
    const wrong = priceUpdateAccount(FULL)
    wrong[0] ^= 0xff
    expect(decodePriceUpdateV2(wrong)).toBeNull()
    const unknownLevel = priceUpdateAccount(FULL)
    unknownLevel[40] = 2
    expect(decodePriceUpdateV2(unknownLevel)).toBeNull()
  })

  it('reports missing for an absent account or a foreign owner', async () => {
    const absent = makeFakeConnection(null)
    const onAbsent = { update: vi.fn(), missing: vi.fn() }
    const offAbsent = subscribeSponsored(absent as never, SOL_FEED, onAbsent)
    await flush()
    expect(absent.getAccountInfo).toHaveBeenCalledTimes(1)
    expect(absent.getAccountInfo.mock.calls[0][0].toBase58()).toBe(SOL_USD_SPONSORED)
    expect(absent.getAccountInfo.mock.calls[0][1]).toBe('confirmed')
    expect(absent.onAccountChange).toHaveBeenCalledTimes(1)
    expect(absent.onAccountChange.mock.calls[0][0].toBase58()).toBe(SOL_USD_SPONSORED)
    expect(absent.onAccountChange.mock.calls[0][2]).toBe('confirmed')
    expect(onAbsent.missing).toHaveBeenCalledTimes(1)
    expect(onAbsent.update).not.toHaveBeenCalled()
    offAbsent()
    expect(absent.removeAccountChangeListener).toHaveBeenCalledWith(SUBSCRIPTION_ID)

    // A lamport-dusted PDA is system-owned: the owner is the finding, whatever the data.
    const foreign = makeFakeConnection(account(priceUpdateAccount(FULL), SystemProgram.programId))
    const onForeign = { update: vi.fn(), missing: vi.fn() }
    const offForeign = subscribeSponsored(foreign as never, SOL_FEED, onForeign)
    await flush()
    expect(onForeign.missing).toHaveBeenCalledTimes(1)
    expect(onForeign.update).not.toHaveBeenCalled()

    // The same check holds for a change: the account closed (system-owned, no data).
    const live = makeFakeConnection(account(priceUpdateAccount(FULL)))
    const onLive = { update: vi.fn(), missing: vi.fn() }
    const offLive = subscribeSponsored(live as never, SOL_FEED, onLive)
    await flush()
    expect(onLive.update).toHaveBeenCalledTimes(1)
    live.fire(account(Buffer.alloc(0), SystemProgram.programId))
    expect(onLive.missing).toHaveBeenCalledTimes(1)

    offForeign()
    offLive()
  })

  it('ignores a Partial update or another feed id', async () => {
    const conn = makeFakeConnection(account(priceUpdateAccount(FULL)))
    const on = { update: vi.fn(), missing: vi.fn() }
    const off = subscribeSponsored(conn as never, SOL_FEED, on)
    await flush()
    expect(on.update).toHaveBeenCalledTimes(1)
    expect(on.update.mock.calls[0][0]).toEqual({
      feedIdHex: SOL_FEED_HEX,
      price: expect.closeTo(95.77, 10),
      publishTime: PUBLISH_TIME,
      full: true,
    })

    conn.fire(account(priceUpdateAccount({ ...FULL, partial: 5, publishTime: 1_793_452_700n })))
    conn.fire(
      account(
        priceUpdateAccount({
          ...FULL,
          feedHex: PYTH_FEED_IDS['BTC/USDC'].slice(2),
          publishTime: 1_793_452_701n,
        }),
      ),
    )
    // Undecodable receiver-owned data is ignored too, not reported missing.
    conn.fire(account(Buffer.alloc(16)))
    expect(on.update).toHaveBeenCalledTimes(1)
    expect(on.missing).not.toHaveBeenCalled()

    conn.fire(
      account(priceUpdateAccount({ ...FULL, price: 9_580_000_000n, publishTime: 1_793_452_710n })),
    )
    expect(on.update).toHaveBeenCalledTimes(2)
    expect(on.update.mock.calls[1][0].price).toBeCloseTo(95.8, 10)
    expect(on.update.mock.calls[1][0].publishTime).toBe(1_793_452_710)

    // Nothing is delivered after unsubscribing.
    off()
    conn.fire(account(priceUpdateAccount({ ...FULL, publishTime: 1_793_452_720n })))
    expect(on.update).toHaveBeenCalledTimes(2)
  })

  it('the first read never lands after a newer change or after unsubscribing', async () => {
    let answer: (info: AccountInfo<Buffer> | null) => void = () => {}
    const slow = new Promise<AccountInfo<Buffer> | null>((resolve) => (answer = resolve))
    const conn = makeFakeConnection(slow)
    const on = { update: vi.fn(), missing: vi.fn() }
    const off = subscribeSponsored(conn as never, SOL_FEED, on)
    conn.fire(account(priceUpdateAccount({ ...FULL, publishTime: 1_793_452_710n })))
    expect(on.update).toHaveBeenCalledTimes(1)
    answer(account(priceUpdateAccount(FULL)))
    await flush()
    expect(on.update).toHaveBeenCalledTimes(1)
    expect(on.update.mock.calls[0][0].publishTime).toBe(1_793_452_710)
    off()

    const absent = makeFakeConnection(null)
    const onAbsent = { update: vi.fn(), missing: vi.fn() }
    subscribeSponsored(absent as never, SOL_FEED, onAbsent)()
    await flush()
    expect(onAbsent.missing).not.toHaveBeenCalled()
  })
})
