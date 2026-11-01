/**
 * The custody program's refusals of an admission, read from what the send path throws and named
 * for the trader.
 */
import {
  LEVX_MODE2_ERROR__CAPACITY,
  LEVX_MODE2_ERROR__CUSTODY_MISMATCH,
  LEVX_MODE2_ERROR__DEADLINE_PASSED,
  LEVX_MODE2_ERROR__INSUFFICIENT_RESERVE,
  LEVX_MODE2_ERROR__NOT_BOUND,
  LEVX_MODE2_ERROR__PAUSED,
  LEVX_MODE2_ERROR__TERMS_MISMATCH,
  LEVX_MODE2_ERROR__WRONG_PHASE,
} from '@spizzerp/levx-mode2-client'

const MESSAGES: Readonly<Record<number, string>> = {
  [LEVX_MODE2_ERROR__WRONG_PHASE]: 'Leverage is closed for this market',
  [LEVX_MODE2_ERROR__CAPACITY]: 'That leverage step just filled up',
  [LEVX_MODE2_ERROR__CUSTODY_MISMATCH]: 'Your USDC account does not match this position',
  [LEVX_MODE2_ERROR__DEADLINE_PASSED]: 'Entry closed before your order landed',
  [LEVX_MODE2_ERROR__PAUSED]: 'Leverage is paused',
  [LEVX_MODE2_ERROR__INSUFFICIENT_RESERVE]: 'The LP has no room left for this order',
  [LEVX_MODE2_ERROR__TERMS_MISMATCH]: 'The offer changed; refresh and try again',
  [LEVX_MODE2_ERROR__NOT_BOUND]: 'Leverage has not opened yet',
}

/** A simulation failure's message or log line. */
const HEX_CODE = /custom program error: 0x([0-9a-f]+)/i
/** A failed confirmation's message: the signature status as JSON. */
const STATUS_CODE = /"Custom":(\d+)/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function codeIn(text: unknown): number | null {
  if (typeof text !== 'string') return null
  const hex = HEX_CODE.exec(text)
  if (hex !== null) return parseInt(hex[1], 16)
  const status = STATUS_CODE.exec(text)
  return status === null ? null : Number(status[1])
}

/**
 * The custom program error in `err`: from its message, then its `logs`, then a raw
 * `{ InstructionError: [i, { Custom: n }] }`; null when there is none.
 */
export function mode2ErrorCode(err: unknown): number | null {
  if (!isRecord(err)) return null
  const fromMessage = codeIn(err.message)
  if (fromMessage !== null) return fromMessage
  if (Array.isArray(err.logs)) {
    for (const line of err.logs) {
      const fromLog = codeIn(line)
      if (fromLog !== null) return fromLog
    }
  }
  const failure = err.InstructionError
  if (Array.isArray(failure) && isRecord(failure[1]) && typeof failure[1].Custom === 'number') {
    return failure[1].Custom
  }
  return null
}

/** The trader's one-line reason for a failed admission. */
export function describeMode2Error(err: unknown): string {
  const code = mode2ErrorCode(err)
  if (code === null) return 'Transaction failed'
  return MESSAGES[code] ?? `Mode 2 error ${code}`
}
