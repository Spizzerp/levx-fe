import { env } from '@/env'

import { getActiveJWT } from './auth'

export interface FaucetSuccess {
  sig: string
  /** Amount minted in base units (e.g. "1000000000" for 1000 USDC at 6dp). */
  amount: string
  mint: string
  ata: string
}

export class FaucetRateLimitError extends Error {
  /** Seconds until the wallet can request again. */
  readonly retryAfter: number
  constructor(retryAfter: number) {
    super(`Test USDC faucet is rate-limited. Try again in ${retryAfter}s.`)
    this.retryAfter = retryAfter
  }
}

/**
 * Hit the test-USDC faucet edge function. Requires the active wallet
 * to have completed the verify-wallet flow (so a JWT is cached).
 *
 * Throws `FaucetRateLimitError` on 429, generic `Error` on auth /
 * config / on-chain failures.
 */
export async function requestTestUsdc(): Promise<FaucetSuccess> {
  const rec = getActiveJWT()
  if (!rec) {
    throw new Error('Sign in with your wallet first to use the test faucet.')
  }

  const res = await fetch(
    `${env.APP_SUPABASE_URL}/functions/v1/request-test-usdc`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rec.jwt}`,
        apikey: env.APP_SUPABASE_ANON_KEY,
      },
      body: '{}',
    },
  )

  const body = (await res.json().catch(() => null)) as {
    error?: string
    retryAfter?: number
    sig?: string
    amount?: string
    mint?: string
    ata?: string
    detail?: string
  } | null

  if (res.ok && body?.sig) {
    return {
      sig: body.sig,
      amount: body.amount ?? '0',
      mint: body.mint ?? '',
      ata: body.ata ?? '',
    }
  }

  if (res.status === 429 && typeof body?.retryAfter === 'number') {
    throw new FaucetRateLimitError(body.retryAfter)
  }
  if (body?.error === 'unauthorized' || body?.error === 'invalid_jwt') {
    throw new Error('Wallet auth expired — disconnect and reconnect, then try again.')
  }
  if (body?.error === 'faucet_misconfigured') {
    throw new Error('Faucet is not configured for this environment.')
  }
  if (body?.error === 'mint_failed') {
    throw new Error(`Mint failed on-chain: ${body.detail ?? 'unknown error'}`)
  }
  throw new Error(body?.error ?? `Faucet request failed (${res.status})`)
}
