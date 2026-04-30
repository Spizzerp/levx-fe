// @ts-nocheck — Supabase Edge (Deno).
//
// Devnet-only test-USDC faucet. Verifies the caller's `verify-wallet`
// JWT (so only authenticated wallets request), enforces a per-wallet
// cooldown via `faucet_requests`, then mints a fixed amount of test
// USDC from the protocol's collateral-mint authority to the caller's
// associated token account.
//
// Required Edge secrets:
//   FAUCET_AUTHORITY_SECRET   base58 keypair that mints the collateral mint
//   FAUCET_USDC_MINT          base58 mint pubkey (the collateral mint)
//   FAUCET_RPC_URL            Solana RPC endpoint (devnet in practice)
//   FAUCET_AMOUNT_BASE        amount in base units, e.g. 1000_000_000 for 1000 USDC (6 decimals)
//   EDGE_JWT_SECRET           HS256 secret matching verify-wallet's signing key
//
// Set with: `supabase secrets set FAUCET_AUTHORITY_SECRET='[…]' FAUCET_USDC_MINT='…' …`
// Document rotation in supabase/README.md when this lands.

import { serve } from 'std/http/server'
import { createClient } from 'supabase-js'
import { verify as verifyJWT } from 'djwt'
import bs58 from 'bs58'
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js'
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token'

import { corsHeaders } from './_shared/cors.ts'
import { tryReserve, releaseReservation } from './_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let _jwtKey: Promise<CryptoKey> | null = null
function getJwtKey(): Promise<CryptoKey> {
  if (!_jwtKey) {
    const secret = Deno.env.get('EDGE_JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET')
    if (!secret) throw new Error('EDGE_JWT_SECRET or SUPABASE_JWT_SECRET must be set')
    _jwtKey = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
  }
  return _jwtKey
}

let _authorityKeypair: Keypair | null = null
function getAuthorityKeypair(): Keypair {
  if (_authorityKeypair) return _authorityKeypair
  const raw = Deno.env.get('FAUCET_AUTHORITY_SECRET')
  if (!raw) throw new Error('FAUCET_AUTHORITY_SECRET must be set')
  // Accept either base58 (single string) or JSON-array form (Anchor wallet).
  const trimmed = raw.trim()
  let bytes: Uint8Array
  if (trimmed.startsWith('[')) {
    bytes = Uint8Array.from(JSON.parse(trimmed))
  } else {
    bytes = bs58.decode(trimmed)
  }
  _authorityKeypair = Keypair.fromSecretKey(bytes)
  return _authorityKeypair
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    return await handle(req)
  } catch (e) {
    console.error('[request-test-usdc] unhandled', e)
    return json({ error: 'internal' }, 500)
  }
})

async function handle(req: Request): Promise<Response> {
  // ── 1. JWT auth ───────────────────────────────────────────────────
  const auth = req.headers.get('authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return json({ error: 'unauthorized' }, 401)
  const token = m[1]

  let claims: Record<string, unknown>
  try {
    claims = await verifyJWT(token, await getJwtKey()) as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_jwt' }, 401)
  }
  const wallet = typeof claims.wallet === 'string' ? claims.wallet : null
  if (!wallet) return json({ error: 'invalid_jwt' }, 401)

  let walletKey: PublicKey
  try {
    walletKey = new PublicKey(wallet)
  } catch {
    return json({ error: 'malformed_wallet' }, 400)
  }

  // ── 2. Validate config BEFORE reserving the rate-limit slot ──────
  // Reserving first then bailing on missing config would block the
  // wallet for 24h despite the operator-side error. Resolve every env
  // var the mint flow needs and bail with 503 before touching state.
  const mintStr = Deno.env.get('FAUCET_USDC_MINT')
  if (!mintStr) return json({ error: 'faucet_misconfigured' }, 503)
  let mint: PublicKey
  try {
    mint = new PublicKey(mintStr)
  } catch {
    return json({ error: 'faucet_misconfigured' }, 503)
  }

  const amountStr = Deno.env.get('FAUCET_AMOUNT_BASE') ?? '1000000000' // 1000 USDC @ 6dp
  let amount: bigint
  try {
    amount = BigInt(amountStr)
  } catch {
    return json({ error: 'faucet_misconfigured' }, 503)
  }

  const rpcUrl = Deno.env.get('FAUCET_RPC_URL')
  if (!rpcUrl) return json({ error: 'faucet_misconfigured' }, 503)

  let authority: Keypair
  try {
    authority = getAuthorityKeypair()
  } catch {
    return json({ error: 'faucet_misconfigured' }, 503)
  }

  // ── 3. Rate limit ─────────────────────────────────────────────────
  const reservation = await tryReserve(admin, wallet)
  if (!reservation.allowed) {
    return json(
      { error: 'rate_limited', retryAfter: reservation.retryAfter },
      429,
      reservation.retryAfter ? { 'Retry-After': String(reservation.retryAfter) } : {},
    )
  }

  // ── 4. Build + send mintTo tx ─────────────────────────────────────
  const connection = new Connection(rpcUrl, 'confirmed')

  let sig: string
  let ata: PublicKey
  try {
    ata = await getAssociatedTokenAddress(mint, walletKey, true)
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        authority.publicKey, // payer
        ata,
        walletKey,
        mint,
      ),
      createMintToInstruction(mint, ata, authority.publicKey, amount),
    )
    tx.feePayer = authority.publicKey
    const latest = await connection.getLatestBlockhash('confirmed')
    tx.recentBlockhash = latest.blockhash
    tx.sign(authority)

    sig = await connection.sendRawTransaction(tx.serialize())
    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      'confirmed',
    )
  } catch (e) {
    console.error('[request-test-usdc] mint failed', e)
    // Roll back the rate-limit reservation so the user isn't blocked
    // for 24h on a transient on-chain failure. Best-effort — logged
    // if it fails so operators can manually unblock if needed.
    await releaseReservation(admin, wallet, reservation.priorLastMintedAt ?? null)
    return json({ error: 'mint_failed', detail: (e as Error).message }, 502)
  }

  return json({ sig, amount: amountStr, mint: mintStr, ata: ata.toBase58() })
}
