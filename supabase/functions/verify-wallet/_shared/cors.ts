
const RAW = Deno.env.get('APP_ORIGIN') ?? '*'
const ALLOWED = ['http://localhost:3030'].concat(
  RAW.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

/**
 * Build CORS headers for a single request. Matches the incoming `Origin`
 * against the comma-separated `APP_ORIGIN` env var (e.g.
 * `https://levx.trade,https://www.levx.trade`). Echoes back the matched
 * origin — never `*` — so credentials-bearing requests aren't rejected.
 *
 * Falls back to the first allowed origin when there's no match (CORS
 * still fails, but we don't leak `*` for production where the env is set).
 */
export function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow = ALLOWED.includes('*')
    ? '*'
    : ALLOWED.includes(origin)
      ? origin
      : (ALLOWED[0] ?? '*')

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'apikey, Content-Type, Authorization, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
