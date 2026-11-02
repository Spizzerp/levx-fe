// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import type { Connection, ParsedTransactionWithMeta, TokenBalance } from '@solana/web3.js'
import type { Address } from '@solana/kit'
import { associatedTokenAddress, positionPda } from '@spizzerp/levx-mode2-client'

import { fetchReceiptHistory } from '../history'
import { FIXTURE_OWNER, makeView } from './fixtures'

const VIEW = makeView()
const RECEIPT = positionPda(VIEW.group!.address as Address, FIXTURE_OWNER)
const MINT = VIEW.epoch!.data.mint
const ATA = associatedTokenAddress(FIXTURE_OWNER, MINT)
/** The epoch's custody account on the other side of every transfer. */
const CUSTODY = VIEW.epoch!.data.claimsAccount
const RECEIPT_RENT = 2_449_920

/** The receipt's lamports and each token account's raw balance before and after one transaction. */
interface TxShape {
  receipt: [number, number]
  /** Absent when the transaction does not touch the owner's ATA. */
  ata?: [bigint, bigint]
  custody: [bigint, bigint]
}

/** The transaction's accounts; the lamport balances below follow this order. */
const KEYS = [FIXTURE_OWNER, RECEIPT, CUSTODY, ATA]
const CUSTODY_INDEX = 2
const ATA_INDEX = 3
const TOKEN_ACCOUNT_RENT = 2_039_280

function balance(accountIndex: number, owner: string, amount: bigint): TokenBalance {
  return {
    accountIndex,
    mint: MINT,
    owner,
    uiTokenAmount: { amount: amount.toString(), decimals: 6, uiAmount: null },
  }
}

/** A parsed transaction with the owner, the receipt, the custody account and the owner's ATA. */
function parsedTx(shape: TxShape): ParsedTransactionWithMeta {
  const tokenBalances = (at: 0 | 1) => [
    balance(CUSTODY_INDEX, VIEW.epoch!.address, shape.custody[at]),
    ...(shape.ata ? [balance(ATA_INDEX, FIXTURE_OWNER, shape.ata[at])] : []),
  ]
  return {
    slot: 1,
    transaction: {
      signatures: [],
      message: {
        accountKeys: KEYS.map((key, i) => ({
          pubkey: new PublicKey(key),
          signer: i === 0,
          writable: true,
        })),
        instructions: [],
        recentBlockhash: '11111111111111111111111111111111',
      },
    },
    meta: {
      err: null,
      fee: 5_000,
      preBalances: [1_000_000_000, shape.receipt[0], TOKEN_ACCOUNT_RENT, TOKEN_ACCOUNT_RENT],
      postBalances: [1_000_000_000, shape.receipt[1], TOKEN_ACCOUNT_RENT, TOKEN_ACCOUNT_RENT],
      preTokenBalances: tokenBalances(0),
      postTokenBalances: tokenBalances(1),
    },
  } as ParsedTransactionWithMeta
}

/** A receipt address's history, newest first, as `getSignaturesForAddress` returns it. */
function fakeConnection(history: { signature: string; tx: ParsedTransactionWithMeta | null }[]) {
  const connection = {
    getSignaturesForAddress: vi.fn(async () =>
      history.map(({ signature }) => ({
        signature,
        slot: 1,
        err: null,
        memo: null,
        blockTime: null,
      })),
    ),
    getParsedTransactions: vi.fn(async (signatures: string[]) =>
      signatures.map((signature) => history.find((h) => h.signature === signature)!.tx),
    ),
  }
  return { connection, asConnection: connection as unknown as Connection }
}

const USDC = 1_000_000n

/** An admission of `principal`: the ATA pays the custody, the receipt opens (or grows). */
const admission = (principal: bigint, receiptBefore = 0): ParsedTransactionWithMeta =>
  parsedTx({
    receipt: [receiptBefore, RECEIPT_RENT],
    ata: [100n * USDC, 100n * USDC - principal],
    custody: [0n, principal],
  })

describe('fetchReceiptHistory', () => {
  it('reads the principal from the admission and the payment from the claim that closed the receipt', async () => {
    const claim = parsedTx({
      receipt: [RECEIPT_RENT, 0],
      ata: [80n * USDC, 80n * USDC + 29_700_000n],
      custody: [29_700_000n, 0n],
    })
    const { connection, asConnection } = fakeConnection([
      { signature: 'claim', tx: claim },
      { signature: 'admission', tx: admission(20n * USDC) },
    ])

    await expect(fetchReceiptHistory(asConnection, RECEIPT, ATA)).resolves.toEqual({
      principal: 20_000_000n,
      paid: 29_700_000n,
      claimSignature: 'claim',
    })
    expect(connection.getSignaturesForAddress).toHaveBeenCalledWith(new PublicKey(RECEIPT), {
      limit: 20,
    })
    expect(connection.getParsedTransactions).toHaveBeenCalledWith(['claim', 'admission'], {
      maxSupportedTransactionVersion: 0,
    })
  })

  it('is null when the receipt address has no signatures', async () => {
    const { connection, asConnection } = fakeConnection([])

    await expect(fetchReceiptHistory(asConnection, RECEIPT, ATA)).resolves.toBeNull()
    expect(connection.getParsedTransactions).not.toHaveBeenCalled()
  })

  it('sums every admission and leaves the payment null until a transaction closes the receipt', async () => {
    const { asConnection } = fakeConnection([
      { signature: 'second', tx: admission(10n * USDC, RECEIPT_RENT) },
      { signature: 'unknown', tx: null },
      { signature: 'first', tx: admission(10n * USDC) },
    ])

    await expect(fetchReceiptHistory(asConnection, RECEIPT, ATA)).resolves.toEqual({
      principal: 20_000_000n,
      paid: null,
      claimSignature: null,
    })
  })

  it('reads a payment of zero when the claim that closed the receipt moved no tokens', async () => {
    // A zero claim skips the transfer, so the owner's ATA has no balance entry.
    const claim = parsedTx({ receipt: [RECEIPT_RENT, 0], custody: [0n, 0n] })
    const { asConnection } = fakeConnection([
      { signature: 'claim', tx: claim },
      { signature: 'admission', tx: admission(20n * USDC) },
    ])

    await expect(fetchReceiptHistory(asConnection, RECEIPT, ATA)).resolves.toEqual({
      principal: 20_000_000n,
      paid: 0n,
      claimSignature: 'claim',
    })
  })
})
