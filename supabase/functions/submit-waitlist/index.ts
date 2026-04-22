import { createClient } from 'supabase-js'
import bs58 from 'bs58'
import { corsHeaders } from './_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

type SubmitWaitlistBody = {
  email?: unknown
  xUsername?: unknown
  walletAddress?: unknown
}

type UserRow = {
  user_id: string
  wallet_address: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '')
}

function isValidXUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(username)
}

function isValidSolanaAddress(address: string): boolean {
  try {
    return bs58.decode(address).length === 32
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const parsed = await req.json().catch(() => null)
    if (!parsed || typeof parsed !== 'object') return json({ error: 'malformed' }, 400)

    const { email, xUsername, walletAddress } = parsed as SubmitWaitlistBody
    if (
      typeof email !== 'string' ||
      typeof xUsername !== 'string' ||
      typeof walletAddress !== 'string'
    ) {
      return json({ error: 'malformed' }, 400)
    }

    const cleanedEmail = email.trim()
    const emailNormalized = cleanedEmail.toLowerCase()
    const cleanedX = normalizeUsername(xUsername)
    const cleanedWallet = walletAddress.trim()

    if (!isValidEmail(cleanedEmail)) return json({ error: 'invalid_email' }, 400)
    if (!isValidXUsername(cleanedX)) return json({ error: 'invalid_x_username' }, 400)
    if (!isValidSolanaAddress(cleanedWallet)) return json({ error: 'invalid_wallet_address' }, 400)

    const { data: matchingUser, error: userLookupError } = await admin
      .from('users')
      .select('user_id, wallet_address')
      .eq('wallet_address', cleanedWallet)
      .maybeSingle<UserRow>()
    if (userLookupError) throw userLookupError

    const { data: existingByWallet, error: walletLookupError } = await admin
      .from('waitlist_entries')
      .select('id, email_normalized, status, linked_user_id')
      .eq('wallet_address', cleanedWallet)
      .maybeSingle()
    if (walletLookupError) throw walletLookupError

    const { data: existingByEmail, error: emailLookupError } = await admin
      .from('waitlist_entries')
      .select('id, wallet_address, status, linked_user_id')
      .eq('email_normalized', emailNormalized)
      .maybeSingle()
    if (emailLookupError) throw emailLookupError

    if (
      existingByWallet &&
      existingByEmail &&
      existingByWallet.id !== existingByEmail.id
    ) {
      return json({ error: 'waitlist_identity_conflict' }, 409)
    }

    const existingId = existingByWallet?.id ?? existingByEmail?.id ?? null
    const existingStatus = existingByWallet?.status ?? existingByEmail?.status ?? null
    const payload = {
      email: cleanedEmail,
      email_normalized: emailNormalized,
      x_username: cleanedX,
      wallet_address: cleanedWallet,
      source: 'landing_page',
      linked_user_id: matchingUser?.user_id ?? null,
      linked_user_wallet: matchingUser?.wallet_address ?? null,
      joined_at: matchingUser ? new Date().toISOString() : null,
    }
    const nextStatus = matchingUser ? 'joined' : 'pending'

    if (existingId) {
      if (existingStatus === 'joined') return json({ ok: true, deduped: true }, 200)

      const { error } = await admin
        .from('waitlist_entries')
        .update({ ...payload, status: nextStatus })
        .eq('id', existingId)
      if (error) throw error
      return json({ ok: true, deduped: true }, 200)
    }

    const { error } = await admin
      .from('waitlist_entries')
      .insert({ ...payload, status: nextStatus })
    if (error) throw error

    return json({ ok: true, deduped: false }, 201)
  } catch (error) {
    console.error('[submit-waitlist]', error)
    return json({ error: 'internal' }, 500)
  }
})
