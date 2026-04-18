import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/env'
import { getActiveJWT } from './auth'

let clientRef: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (clientRef) return clientRef
  clientRef = createClient(env.APP_SUPABASE_URL, env.APP_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    accessToken: async () => {
      const rec = getActiveJWT()
      return rec?.jwt ?? null
    },
  })
  return clientRef
}
