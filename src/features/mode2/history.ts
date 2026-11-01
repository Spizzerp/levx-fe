/**
 * A position receipt's history read from its address's transactions: what the owner's ATA paid in
 * (the admissions) and what it was paid by the transaction that closed the receipt (the claim).
 * The amount paid outlives the receipt, which the keeper closes when it pays.
 */
import { PublicKey } from '@solana/web3.js'
import type { Connection, ParsedTransactionWithMeta, TokenBalance } from '@solana/web3.js'

export interface ReceiptHistory {
  /** What the owner's ATA paid in, in micro-USDC: the sum of its debits. */
  principal: bigint
  /** What the claim that closed the receipt paid to the ATA; null while the receipt is open. */
  paid: bigint | null
  claimSignature: string | null
}

/** A receipt sees its admissions and its claim: far fewer than this. */
const SIGNATURE_LIMIT = 20

/** The raw amount `balances` hold for the account at `index`; 0 when it is absent. */
function amountAt(balances: readonly TokenBalance[] | null | undefined, index: number): bigint {
  const entry = balances?.find((balance) => balance.accountIndex === index)
  return entry ? BigInt(entry.uiTokenAmount.amount) : 0n
}

/** The ATA's token-balance change in `tx`: post minus pre, 0 when the ATA is not in it. */
function ataChange(tx: ParsedTransactionWithMeta, ownerAta: string): bigint {
  const index = tx.transaction.message.accountKeys.findIndex(
    (key) => key.pubkey.toBase58() === ownerAta,
  )
  if (index < 0) return 0n
  return amountAt(tx.meta?.postTokenBalances, index) - amountAt(tx.meta?.preTokenBalances, index)
}

/** True when `tx` took the receipt's lamports to zero: Anchor's `close` in `claim_positions`. */
function closesReceipt(tx: ParsedTransactionWithMeta, receipt: string): boolean {
  const index = tx.transaction.message.accountKeys.findIndex(
    (key) => key.pubkey.toBase58() === receipt,
  )
  if (index < 0 || tx.meta === null) return false
  return tx.meta.preBalances[index] > 0 && tx.meta.postBalances[index] === 0
}

/**
 * The receipt's principal and payment from its last `SIGNATURE_LIMIT` transactions; null when its
 * address has none. A zero claim moves no tokens, so it reads as paid 0.
 */
export async function fetchReceiptHistory(
  connection: Connection,
  receipt: string,
  ownerAta: string,
): Promise<ReceiptHistory | null> {
  const signatures = await connection.getSignaturesForAddress(new PublicKey(receipt), {
    limit: SIGNATURE_LIMIT,
  })
  if (signatures.length === 0) return null
  const txs = await connection.getParsedTransactions(
    signatures.map((s) => s.signature),
    { maxSupportedTransactionVersion: 0 },
  )
  const history: ReceiptHistory = { principal: 0n, paid: null, claimSignature: null }
  txs.forEach((tx, i) => {
    if (tx === null) return
    const change = ataChange(tx, ownerAta)
    if (change < 0n) history.principal -= change
    if (closesReceipt(tx, receipt)) {
      history.paid = change
      history.claimSignature = signatures[i].signature
    }
  })
  return history
}
