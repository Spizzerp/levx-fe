import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'

// Local-only values printed by `supabase start`. These are the default CLI keys,
// safe to commit because they only unlock the local development stack.
const LOCAL_URL             = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_JWT_SECRET      = 'super-secret-jwt-token-with-at-least-32-characters-long'

export function anonClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_ANON_KEY)
}

export function serviceClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_SERVICE_ROLE, { auth: { persistSession: false } })
}

/** Build a Supabase client authenticated as the given wallet via a test-signed JWT. */
export async function walletClient(wallet: string): Promise<SupabaseClient> {
  const secret = new TextEncoder().encode(LOCAL_JWT_SECRET)
  const jwt = await new SignJWT({
    wallet,
    role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(wallet)
    .setIssuer('supabase')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)

  return createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    accessToken: async () => jwt,
  })
}

/** Wipe comments + rate-limit state between tests. */
export async function resetTables() {
  const svc = serviceClient()
  await svc.from('comments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await svc.from('comment_rate_limit').delete().neq('wallet', '__never__')
  await svc.from('auth_nonces').delete().neq('nonce', '__never__')
}

export const WALLET_A = 'AliceWalletPubkey1111111111111111111111111111'
export const WALLET_B = 'BobWalletPubkey22222222222222222222222222222'
