import type { BN, Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'

import type { Levx } from '@/idl/levx'
import { env } from '@/env/env.config'
import { SCALE } from '@/lib/constants'
import { deriveEigenCachePda } from './pda'

export type EigenCacheStatus =
  | 'disabled'
  | 'lambda_zero'
  | 'missing'
  | 'stale'
  | 'fresh'
  | 'unusable'
  | 'rpc_error'

export type QuoteTier = 'lmsr_fallback' | 'eigencache'

export interface EigenCacheQuoteSnapshot {
  cachePda: PublicKey
  status: EigenCacheStatus
  quoteTier: QuoteTier
  cachedPrices: number[]
  checkpointQuantities: number[]
  lipschitz: number
  cacheVersion: number
  marketVersion: number
}

export interface EigenCachePolicy {
  status: EigenCacheStatus
  quoteTier: QuoteTier
  cachePda?: PublicKey
  snapshot?: EigenCacheQuoteSnapshot
  reason?: string
}

function bnToNumber(value: BN | number | undefined | null): number {
  if (typeof value === 'number') return value
  if (value && typeof value.toNumber === 'function') return value.toNumber()
  return Number(value ?? 0)
}

function bnToScaledNumber(value: BN | number | undefined | null): number {
  return bnToNumber(value) / SCALE
}

function pubkeyEquals(left: unknown, right: PublicKey): boolean {
  return left instanceof PublicKey && left.equals(right)
}

export function activeMaskFromPricingMask(
  pricingActiveMask: BN | number | undefined | null,
  numPaths: number,
): boolean[] {
  const mask = BigInt(bnToNumber(pricingActiveMask))
  return Array.from({ length: numPaths }, (_, idx) => ((mask >> BigInt(idx)) & 1n) === 1n)
}

export function summarizeEigenCacheStatus(status: EigenCacheStatus): string {
  switch (status) {
    case 'disabled':
      return 'Disabled'
    case 'lambda_zero':
      return 'Not needed'
    case 'missing':
      return 'Fallback pricing'
    case 'stale':
      return 'Fallback pricing'
    case 'fresh':
      return 'EigenCache fresh'
    case 'unusable':
      return 'Fallback pricing'
    case 'rpc_error':
      return 'Status unavailable'
  }
}

export function evaluateEigenCachePolicy(args: {
  enabled: boolean
  marketPda: PublicKey
  marketAcc: {
    lambda?: BN | number
    eigendecompVersion?: BN | number
    numPaths?: number
  }
  cachePda: PublicKey
  cacheAcc?: {
    market?: PublicKey
    version?: BN | number
    numPaths?: number
    cachedPrices?: Array<BN | number>
    lipschitzConstant?: BN | number
    checkpointQuantities?: Array<BN | number>
  } | null
  readError?: unknown
}): EigenCachePolicy {
  const { enabled, marketPda, marketAcc, cachePda, cacheAcc, readError } = args
  const marketVersion = bnToNumber(marketAcc.eigendecompVersion)
  const numPaths = Number(marketAcc.numPaths ?? 0)

  if (!enabled) return { status: 'disabled', quoteTier: 'lmsr_fallback', cachePda }
  if (bnToNumber(marketAcc.lambda) <= 0) {
    return { status: 'lambda_zero', quoteTier: 'lmsr_fallback', cachePda }
  }
  if (readError) {
    return {
      status: 'rpc_error',
      quoteTier: 'lmsr_fallback',
      cachePda,
      reason: readError instanceof Error ? readError.message : String(readError),
    }
  }
  if (!cacheAcc) return { status: 'missing', quoteTier: 'lmsr_fallback', cachePda }

  const cacheVersion = bnToNumber(cacheAcc.version)
  const cacheNumPaths = Number(cacheAcc.numPaths ?? 0)
  const cachedPrices = cacheAcc.cachedPrices ?? []
  const checkpointQuantities = cacheAcc.checkpointQuantities ?? []
  const lipschitzRaw = bnToNumber(cacheAcc.lipschitzConstant)

  if (
    !pubkeyEquals(cacheAcc.market, marketPda) ||
    cachedPrices.length < numPaths ||
    checkpointQuantities.length !== numPaths ||
    lipschitzRaw <= 0
  ) {
    return { status: 'unusable', quoteTier: 'lmsr_fallback', cachePda }
  }

  if (cacheVersion !== marketVersion || cacheNumPaths !== numPaths) {
    return { status: 'stale', quoteTier: 'lmsr_fallback', cachePda }
  }

  return {
    status: 'fresh',
    quoteTier: 'eigencache',
    cachePda,
    snapshot: {
      cachePda,
      status: 'fresh',
      quoteTier: 'eigencache',
      cachedPrices: cachedPrices.slice(0, numPaths).map((p) => bnToScaledNumber(p)),
      checkpointQuantities: checkpointQuantities.slice(0, numPaths).map((q) => bnToScaledNumber(q)),
      lipschitz: lipschitzRaw / SCALE,
      cacheVersion,
      marketVersion,
    },
  }
}

export async function loadEigenCachePolicy(
  program: Program<Levx>,
  marketId: number,
  marketPda: PublicKey,
  marketAcc: {
    lambda?: BN | number
    eigendecompVersion?: BN | number
    numPaths?: number
  },
): Promise<EigenCachePolicy> {
  const [cachePda] = deriveEigenCachePda(marketId)
  if (!env.APP_EIGENCACHE_QUOTES_ENABLED || bnToNumber(marketAcc.lambda) <= 0) {
    return evaluateEigenCachePolicy({
      enabled: env.APP_EIGENCACHE_QUOTES_ENABLED,
      marketPda,
      marketAcc,
      cachePda,
      cacheAcc: null,
    })
  }

  try {
    const info = await program.provider.connection.getAccountInfo(cachePda)
    if (!info) {
      return evaluateEigenCachePolicy({
        enabled: true,
        marketPda,
        marketAcc,
        cachePda,
        cacheAcc: null,
      })
    }

    const cacheAcc = await program.account.eigenCache.fetch(cachePda)
    return evaluateEigenCachePolicy({
      enabled: true,
      marketPda,
      marketAcc,
      cachePda,
      cacheAcc,
    })
  } catch (readError) {
    return evaluateEigenCachePolicy({
      enabled: true,
      marketPda,
      marketAcc,
      cachePda,
      cacheAcc: null,
      readError,
    })
  }
}

export function eigenCacheRemainingAccounts(policy: EigenCachePolicy) {
  if (policy.status !== 'fresh' || !policy.cachePda) return []
  return [{ pubkey: policy.cachePda, isSigner: false, isWritable: true }]
}
