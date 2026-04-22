import { env } from '@/env'
import type { JWTRecord } from './types'

const KEY_PREFIX = 'levx_jwt:'
const EXPIRY_MARGIN_MS = 60_000

let activeWallet: string | null = null

/** Provider-only: tells the singleton client which wallet's JWT to attach. */
export function __setActiveWallet(wallet: string | null): void {
  activeWallet = wallet
}

export function cacheJWT(rec: JWTRecord): void {
  localStorage.setItem(KEY_PREFIX + rec.wallet, JSON.stringify(rec))
}

export function loadCachedJWT(wallet: string): JWTRecord | null {
  const raw = localStorage.getItem(KEY_PREFIX + wallet)
  if (!raw) return null
  try {
    const rec = JSON.parse(raw) as JWTRecord
    if (rec.wallet !== wallet) return null
    if (rec.expiresAt <= Date.now() + EXPIRY_MARGIN_MS) return null
    return rec
  } catch {
    return null
  }
}

export function clearJWT(wallet: string): void {
  localStorage.removeItem(KEY_PREFIX + wallet)
}

export function getActiveJWT(): JWTRecord | null {
  if (!activeWallet) return null
  return loadCachedJWT(activeWallet)
}

export type NonceResponse = { nonce: string; message: string; expiresAt: string }
export type VerifyRequest = { pubkey: string; nonce: string; signature: string }
export type SubmitWaitlistRequest = {
  email: string
  xUsername: string
  walletAddress: string
}

export async function requestNonce(): Promise<NonceResponse> {
  const res = await fetch(`${env.APP_SUPABASE_URL}/functions/v1/verify-wallet/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.APP_SUPABASE_ANON_KEY },
    body: '{}',
  })
  if (!res.ok) throw new Error(`nonce request failed: ${res.status}`)
  return (await res.json()) as NonceResponse
}

export async function verifyAndGetJWT(req: VerifyRequest): Promise<JWTRecord> {
  const res = await fetch(`${env.APP_SUPABASE_URL}/functions/v1/verify-wallet/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.APP_SUPABASE_ANON_KEY },
    body: JSON.stringify(req),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error ?? `verify failed: ${res.status}`)
  return {
    jwt:       body.jwt as string,
    expiresAt: Date.parse(body.expiresAt as string),
    wallet:    req.pubkey,
  }
}

export async function submitWaitlist(req: SubmitWaitlistRequest): Promise<void> {
  const res = await fetch(`${env.APP_SUPABASE_URL}/functions/v1/submit-waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.APP_SUPABASE_ANON_KEY },
    body: JSON.stringify(req),
  })

  if (res.ok) return

  const body = await res.json().catch(() => null)
  const code = body?.error

  if (code === 'waitlist_identity_conflict') {
    throw new Error('This email or wallet is already linked to another waitlist entry.')
  }
  if (code === 'invalid_email') {
    throw new Error('Enter a valid email address.')
  }
  if (code === 'invalid_x_username') {
    throw new Error('Enter a valid X username.')
  }
  if (code === 'invalid_wallet_address') {
    throw new Error('Invalid Solana wallet address.')
  }

  throw new Error('Could not join the waitlist. Try again.')
}
