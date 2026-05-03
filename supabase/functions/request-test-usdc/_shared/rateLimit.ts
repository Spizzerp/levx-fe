import { SupabaseClient } from 'supabase-js'

//
// Atomic rate-limit reserve. Delegates to the `try_reserve_faucet_slot`
// Postgres function (see migration 0005), which serializes concurrent
// same-wallet calls via `SELECT … FOR UPDATE`. The earlier read-then-
// update implementation was racy at PostgreSQL's default READ COMMITTED:
// two requests landing in the same millisecond could both observe the
// cooldown as elapsed and both succeed → 2× mint per cooldown.

const COOLDOWN_SECS = 24 * 60 * 60 // 24h

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the wallet can request again (only set when blocked). */
  retryAfter?: number
  /**
   * The row's `last_minted_at` BEFORE this reservation took effect, or
   * null if there was no prior row. Pass this to `releaseReservation`
   * if the downstream operation fails — without it we'd block the
   * wallet for the full cooldown despite never minting.
   */
  priorLastMintedAt?: string | null
}

/**
 * Atomic check-and-record. Returns `{allowed: true}` and persists the
 * request when the wallet is outside the cooldown window. Otherwise
 * `{allowed: false, retryAfter}` and no write occurs.
 *
 * All concurrency-correctness lives in the Postgres function — this
 * helper just shapes the result for the caller.
 */
export async function tryReserve(admin: SupabaseClient, wallet: string): Promise<RateLimitResult> {
  const { data, error } = await admin.rpc('try_reserve_faucet_slot', {
    p_wallet: wallet,
    p_cooldown_seconds: COOLDOWN_SECS,
  })
  if (error) throw error

  // Postgres functions returning TABLE come back as either an array
  // (postgrest default) or a single row when `.single()` is used. Be
  // defensive — the function always emits exactly one row.
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    throw new Error('try_reserve_faucet_slot returned no row')
  }

  if (row.allowed) {
    return {
      allowed: true,
      priorLastMintedAt: row.prior_last_minted_at ?? null,
    }
  }
  return {
    allowed: false,
    retryAfter:
      typeof row.retry_after === 'number' && row.retry_after > 0
        ? row.retry_after
        : COOLDOWN_SECS,
  }
}

/**
 * Best-effort rollback of a previously-successful `tryReserve`. Used
 * when the on-chain mint fails after we've already recorded the
 * reservation — without this the user would be blocked for the full
 * cooldown despite never receiving USDC. Restores the prior
 * `last_minted_at` (or deletes the row if there was no prior row) so
 * the next request is gated by the original cooldown, not the failed
 * attempt's timestamp.
 */
export async function releaseReservation(
  admin: SupabaseClient,
  wallet: string,
  priorLastMintedAt: string | null,
): Promise<void> {
  try {
    if (priorLastMintedAt === null) {
      await admin.from('faucet_requests').delete().eq('wallet', wallet)
    } else {
      await admin
        .from('faucet_requests')
        .update({ last_minted_at: priorLastMintedAt })
        .eq('wallet', wallet)
    }
  } catch (e) {
    // Reservation rollback is best-effort. Logged so operators can
    // see when a wallet got stuck due to rollback failure.
    console.warn('[releaseReservation] failed', wallet, e)
  }
}
