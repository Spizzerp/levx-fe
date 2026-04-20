import { serve } from 'std/http/server'
import { createClient } from 'supabase-js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { create as signJWT, getNumericDate } from 'djwt'
import { corsHeaders } from './_shared/cors.ts'
import { buildMessage } from './_shared/message.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const NONCE_TTL_SECONDS = 5 * 60
const JWT_TTL_SECONDS = 24 * 60 * 60

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function jwtSigningSecret(): string | undefined {
  // Must match the project's JWT signing secret (Dashboard → Project Settings → API → JWT signing keys / JWT Secret).
  // Hosted Edge does not list this in "default" secrets — set explicitly:
  //   supabase secrets set EDGE_JWT_SECRET='…'   (recommended name; avoids CLI stripping SUPABASE_* in local serve)
  // Optional fallback name if you inject it yourself:
  //   SUPABASE_JWT_SECRET
  return Deno.env.get('EDGE_JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET')
}

// Lazy-init so the function can serve non-/verify routes even if the secret
// isn't set yet (e.g. local dev before the env file is configured).
let _jwtKey: Promise<CryptoKey> | null = null
function getJwtKey(): Promise<CryptoKey> {
  if (!_jwtKey) {
    const secret = jwtSigningSecret()
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const url = new URL(req.url)

  try {
    if (url.pathname.endsWith('/nonce')) return await handleNonce()
    if (url.pathname.endsWith('/verify')) return await handleVerify(req)
    return json({ error: 'not_found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: 'internal' }, 500)
  }
})

async function handleNonce(): Promise<Response> {
  await admin.from('auth_nonces').delete().lt('expires_at', new Date().toISOString())
  const nonce = bs58.encode(crypto.getRandomValues(new Uint8Array(32)))
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString()
  const { error } = await admin.from('auth_nonces').insert({ nonce, expires_at: expiresAt })
  if (error) throw error
  return json({ nonce, message: buildMessage(nonce), expiresAt })
}

async function handleVerify(req: Request): Promise<Response> {
  const parsed = await req.json().catch(() => null)
  if (!parsed || typeof parsed !== 'object') return json({ error: 'malformed' }, 400)
  const { pubkey, nonce, signature } = parsed as Record<string, unknown>
  if (typeof pubkey !== 'string' || typeof nonce !== 'string' || typeof signature !== 'string') {
    return json({ error: 'malformed' }, 400)
  }

  // Fail before consuming a nonce so misconfiguration does not burn valid nonces.
  if (!jwtSigningSecret()) {
    console.error(
      '[verify-wallet] Missing EDGE_JWT_SECRET. Set it to the API JWT secret: Dashboard → Project Settings → API, then `supabase secrets set EDGE_JWT_SECRET=…`',
    )
    return json({ error: 'jwt_secret_missing' }, 503)
  }

  // Atomic consume: single delete returning the row, gated on expires_at.
  const { data: deleted, error: delErr } = await admin
    .from('auth_nonces')
    .delete()
    .eq('nonce', nonce)
    .gt('expires_at', new Date().toISOString())
    .select('nonce')
    .maybeSingle()
  if (delErr || !deleted) return json({ error: 'nonce_used_or_expired' }, 400)

  const messageBytes = new TextEncoder().encode(buildMessage(nonce))
  let sigBytes: Uint8Array
  let pubkeyBytes: Uint8Array
  try {
    sigBytes = bs58.decode(signature)
    pubkeyBytes = bs58.decode(pubkey)
  } catch {
    return json({ error: 'malformed' }, 400)
  }
  if (sigBytes.length !== 64 || pubkeyBytes.length !== 32) {
    return json({ error: 'malformed' }, 400)
  }

  const ok = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes)
  if (!ok) return json({ error: 'invalid_signature' }, 401)

  const jwt = await signJWT(
    { alg: 'HS256', typ: 'JWT' },
    {
      iss: 'supabase',
      sub: pubkey,
      role: 'authenticated',
      aud: 'authenticated',
      wallet: pubkey,
      iat: getNumericDate(0),
      exp: getNumericDate(JWT_TTL_SECONDS),
    },
    await getJwtKey(),
  )
  const expiresAt = new Date(Date.now() + JWT_TTL_SECONDS * 1000).toISOString()
  return json({ jwt, expiresAt })
}
