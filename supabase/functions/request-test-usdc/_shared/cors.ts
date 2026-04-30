// @ts-nocheck — Supabase Edge (Deno).
const ORIGIN = Deno.env.get('APP_ORIGIN') ?? '*'

// `apikey` and `x-client-info` are sent by both raw `fetch` callers (the
// FE wraps requests with `apikey: env.APP_SUPABASE_ANON_KEY`) and the
// `supabase-js` client; without them the preflight rejects the request
// before our handler ever runs.
export const corsHeaders = {
  'Access-Control-Allow-Origin':  ORIGIN,
  'Access-Control-Allow-Headers': 'apikey, Content-Type, Authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
