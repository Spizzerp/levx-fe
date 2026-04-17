import { serve } from 'std/http/server'
import { createClient } from 'supabase-js'
import * as nacl from 'tweetnacl'
import bs58 from 'bs58'
import { create as signJWT, getNumericDate } from 'djwt'
import { corsHeaders } from './_shared/cors.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const NONCE_TTL_SECONDS         = 5 * 60
const JWT_TTL_SECONDS           = 24 * 60 * 60

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Lazy-init so the function can serve non-/verify routes even if the secret
// isn't set yet (e.g. local dev before the env file is configured).
let _jwtKey: Promise<CryptoKey> | null = null
function getJwtKey(): Promise<CryptoKey> {
  if (!_jwtKey) {
    const secret = Deno.env.get('SUPABASE_JWT_SECRET')
    if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set')
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

export function buildMessage(nonce: string): string {
  return `Sign to verify ownership of your wallet for LevX.\n\nNonce: ${nonce}\n\nThis is not a transaction and will not move funds.`
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
    if (url.pathname.endsWith('/nonce'))  return json({ error: 'not_implemented' }, 501)
    if (url.pathname.endsWith('/verify')) return json({ error: 'not_implemented' }, 501)
    return json({ error: 'not_found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: 'internal' }, 500)
  }
})
