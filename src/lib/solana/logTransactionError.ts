import type { Connection } from '@solana/web3.js'

type ErrorRecord = Record<string, unknown>

const LOG_KEYS = [
  'logs',
  'transactionLogs',
  'logMessages',
  'errorLogs',
  'programErrorStack',
] as const

const ERROR_KEYS = [
  'name',
  'message',
  'stack',
  'code',
  'signature',
  'transactionError',
  'InstructionError',
  'instructionError',
  'program',
  'programId',
  'logs',
  'transactionLogs',
  'logMessages',
  'errorLogs',
  'programErrorStack',
  'cause',
  'error',
] as const

export interface TransactionErrorLogOptions {
  connection?: Connection
  details?: Record<string, unknown>
}

function isRecord(value: unknown): value is ErrorRecord {
  return typeof value === 'object' && value !== null
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined
}

function getNestedRecord(record: ErrorRecord, key: string): ErrorRecord | undefined {
  const value = record[key]
  return isRecord(value) ? value : undefined
}

function directLogsFrom(error: unknown): string[] | undefined {
  if (!isRecord(error)) return undefined

  for (const key of LOG_KEYS) {
    const logs = stringArray(error[key])
    if (logs) return logs
  }

  const transactionError = getNestedRecord(error, 'transactionError')
  if (transactionError) {
    const logs = stringArray(transactionError.logs)
    if (logs) return logs
  }

  const nestedError = getNestedRecord(error, 'error')
  return nestedError ? directLogsFrom(nestedError) : undefined
}

async function resolveLogs(
  error: unknown,
  connection: Connection | undefined,
): Promise<string[] | undefined> {
  const directLogs = directLogsFrom(error)
  if (directLogs) return directLogs
  if (!connection || !isRecord(error) || typeof error.getLogs !== 'function') return undefined

  try {
    const logs = await (error.getLogs as (connection: Connection) => Promise<string[]>).call(
      error,
      connection,
    )
    return stringArray(logs)
  } catch (logsErr) {
    console.warn('[tx:error] failed to fetch transaction logs', logsErr)
    return undefined
  }
}

function serializeError(error: unknown, depth = 0): unknown {
  if (!isRecord(error) || depth > 3) return error

  const serialized: ErrorRecord = {}
  for (const key of ERROR_KEYS) {
    if (!(key in error)) continue
    const value = error[key]
    serialized[key] = key === 'cause' || key === 'error' ? serializeError(value, depth + 1) : value
  }

  return serialized
}

function logLines(logs: string[]): string {
  return logs.map((line, index) => `${index}: ${line}`).join('\n')
}

export async function logTransactionError(
  label: string,
  error: unknown,
  options: TransactionErrorLogOptions = {},
): Promise<void> {
  const logs = await resolveLogs(error, options.connection)

  console.groupCollapsed(`[tx:error] ${label}`)
  if (options.details) console.info('Context', options.details)
  console.error('Raw error', error)
  console.info('Error details', serializeError(error))
  if (logs?.length) console.info(`Simulation logs (${logs.length})\n${logLines(logs)}`)
  console.groupEnd()
}
