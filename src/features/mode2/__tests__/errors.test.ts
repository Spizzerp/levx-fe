// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  SendTransactionError,
  TransactionExpiredBlockheightExceededError,
  TransactionExpiredTimeoutError,
} from '@solana/web3.js'
import { WalletSendTransactionError, WalletSignTransactionError } from '@solana/wallet-adapter-base'
import { describeMode2Error, mode2ErrorCode } from '../errors'

const PROGRAM = 'A6TNLq28eHjhgvzoYN2FTxGvwEB2j9XWakcED3oEUfbJ'
const SIGNATURE = '5xyz'
const NOT_CONFIRMED = 'Not confirmed yet — check your positions before trying again'
const CANCELLED = 'Cancelled in your wallet'

const MESSAGES: [number, string][] = [
  [6000, 'Leverage is closed for this market'],
  [6005, 'That leverage step just filled up'],
  [6006, 'Your USDC account does not match this position'],
  [6019, 'Entry closed before your order landed'],
  [6024, 'Leverage is paused'],
  [6026, 'The LP has no room left for this order'],
  [6027, 'The offer changed; refresh and try again'],
  [6033, 'Leverage has not opened yet'],
]

/** What web3.js throws when the preflight simulation of the admission fails with `code`. */
function simulationError(code: number): SendTransactionError {
  return new SendTransactionError({
    action: 'simulate',
    signature: '',
    transactionMessage: `Transaction simulation failed: Error processing Instruction 2: custom program error: 0x${code.toString(16)}`,
  })
}

describe('mode2ErrorCode', () => {
  it('reads the code from a simulation failure', () => {
    expect(mode2ErrorCode(simulationError(6005))).toBe(6005)
  })

  it('reads the code from the logs', () => {
    const err = Object.assign(new Error('Transaction failed'), {
      logs: [
        `Program ${PROGRAM} invoke [1]`,
        'Program log: Instruction: AdmitBatch',
        `Program ${PROGRAM} failed: custom program error: 0x177a`,
      ],
    })
    expect(mode2ErrorCode(err)).toBe(6010)
  })

  it('reads the code from an InstructionError', () => {
    expect(mode2ErrorCode({ InstructionError: [2, { Custom: 6026 }] })).toBe(6026)
  })

  it('reads the code from a failed confirmation', () => {
    const err = new Error(
      'Raw transaction 5xyz failed ({"err":{"InstructionError":[2,{"Custom":6019}]}})',
    )
    expect(mode2ErrorCode(err)).toBe(6019)
  })

  it('is null without a program error', () => {
    expect(mode2ErrorCode(new Error('User rejected the request.'))).toBeNull()
    expect(mode2ErrorCode({ InstructionError: [2, 'InvalidAccountData'] })).toBeNull()
    expect(mode2ErrorCode(undefined)).toBeNull()
  })
})

describe('describeMode2Error', () => {
  it.each(MESSAGES)('names error %i', (code, message) => {
    expect(describeMode2Error(simulationError(code))).toBe(message)
  })

  it('numbers any other code', () => {
    expect(describeMode2Error(simulationError(6001))).toBe('Mode 2 error 6001')
  })

  it('says the order may still land when the confirmation times out or the blockhash expires', () => {
    expect(describeMode2Error(new TransactionExpiredTimeoutError(SIGNATURE, 60))).toBe(
      NOT_CONFIRMED,
    )
    expect(describeMode2Error(new TransactionExpiredBlockheightExceededError(SIGNATURE))).toBe(
      NOT_CONFIRMED,
    )
  })

  it.each([
    'Transaction was not confirmed in 60.00 seconds.',
    `Signature ${SIGNATURE} has expired: block height exceeded.`,
    'It is unknown if it succeeded or failed.',
  ])('says the order may still land on "%s"', (message) => {
    expect(describeMode2Error(new Error(message))).toBe(NOT_CONFIRMED)
  })

  it('says the trader cancelled in the wallet', () => {
    expect(describeMode2Error(new WalletSignTransactionError('User rejected the request.'))).toBe(
      CANCELLED,
    )
    expect(describeMode2Error(new WalletSendTransactionError('Transaction rejected'))).toBe(
      CANCELLED,
    )
    expect(
      describeMode2Error(
        new WalletSignTransactionError(undefined, { name: 'UserRejectedRequestError' }),
      ),
    ).toBe(CANCELLED)
    expect(describeMode2Error(new Error('User rejected the request.'))).toBe(CANCELLED)
  })

  it('says the transaction failed without a code, a timeout or a rejection', () => {
    expect(describeMode2Error(new WalletSignTransactionError('Wallet is locked'))).toBe(
      'Transaction failed',
    )
    expect(describeMode2Error(new Error('Network request failed'))).toBe('Transaction failed')
    expect(describeMode2Error('boom')).toBe('Transaction failed')
  })
})
