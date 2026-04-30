// @ts-nocheck — Supabase Edge (Deno).
//
// Atomic upsert against `faucet_requests`: `INSERT … ON CONFLICT DO UPDATE …
// WHERE last_minted_at < cutoff`. If the WHERE clause excludes the row, the
// UPDATE happens to zero rows and the RETURNING set is empty → blocked.
//
// PostgREST's `upsert` with `onConflict + ignoreDuplicates: false` matches
// this semantic when the table has a primary-key conflict path.

const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24h

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the wallet can request again (only set when blocked). */
  retryAfter?: number
}

/**
 * Atomic check-and-record. Returns `{allowed: true}` and persists the
 * request when the wallet is outside the cooldown window. Otherwise
 * `{allowed: false, retryAfter}` and no write occurs.
 */
export async function tryReserve(admin: any, wallet: string): Promise<RateLimitResult> {
  const now = new Date()
  const cutoffIso = new Date(now.getTime() - COOLDOWN_MS).toISOString()

  // Read first to compute retryAfter on the blocked path. The subsequent
  // upsert is the actual atomic guard — even if two requests race past
  // this read, only one will satisfy the `last_minted_at < cutoff`
  // predicate at write time.
  const { data: existing } = await admin
    .from('faucet_requests')
    .select('last_minted_at, count')
    .eq('wallet', wallet)
    .maybeSingle()

  if (existing) {
    const lastMs = Date.parse(existing.last_minted_at)
    if (now.getTime() - lastMs < COOLDOWN_MS) {
      return {
        allowed: false,
        retryAfter: Math.ceil((COOLDOWN_MS - (now.getTime() - lastMs)) / 1000),
      }
    }
  }

  // Atomic gate: update only if the existing row is outside the cooldown,
  // OR insert if no row exists. Two-step (update→insert-on-fail) so the
  // WHERE clause runs server-side instead of after a stale read.
  const { data: updated, error: updErr } = await admin
    .from('faucet_requests')
    .update({
      last_minted_at: now.toISOString(),
      count: (existing?.count ?? 0) + 1,
    })
    .eq('wallet', wallet)
    .lt('last_minted_at', cutoffIso)
    .select('wallet')
    .maybeSingle()

  if (!updErr && updated) return { allowed: true }

  // Insert path (no existing row). On race, `wallet` PK constraint will
  // block the second concurrent insert with a `23505` error — caller can
  // surface that as a generic blocked.
  if (!existing) {
    const { error: insErr } = await admin
      .from('faucet_requests')
      .insert({ wallet, last_minted_at: now.toISOString(), count: 1 })
    if (insErr) {
      // PK conflict — another request beat us by milliseconds. Treat as
      // rate-limited rather than 500.
      if ((insErr as { code?: string }).code === '23505') {
        return { allowed: false, retryAfter: Math.ceil(COOLDOWN_MS / 1000) }
      }
      throw insErr
    }
    return { allowed: true }
  }

  // Existing row, still inside cooldown — treat as blocked.
  return {
    allowed: false,
    retryAfter: Math.ceil(COOLDOWN_MS / 1000),
  }
}
