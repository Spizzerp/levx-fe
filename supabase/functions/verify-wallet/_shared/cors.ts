const ORIGIN = Deno.env.get('APP_ORIGIN') ?? '*'

export const corsHeaders = {
  'Access-Control-Allow-Origin':  ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
