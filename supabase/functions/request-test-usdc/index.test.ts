// @ts-nocheck — Supabase Edge (Deno).
//
// Unit tests for the rate-limit helper. The full handler depends on
// Solana RPC + a real keypair, so we test the rate-limit semantics
// directly here and rely on manual smoke testing for the on-chain leg.
//
// The fake admin emulates Postgres semantics relevant to
// `try_reserve_faucet_slot`: a serialized row lock so concurrent calls
// see each other's writes. That's the load-bearing primitive — if it
// regresses, two parallel requests will both pass the cooldown check.

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { tryReserve, releaseReservation } from './_shared/rateLimit.ts'

interface Row {
  wallet: string
  last_minted_at: string
  count: number
}

const COOLDOWN_SECS = 24 * 60 * 60

/**
 * Fake admin client. Models the `try_reserve_faucet_slot` Postgres
 * function and the table-level `from(...)` operations the rollback
 * path uses.
 */
function makeFakeAdmin(seed: Row[] = []) {
  const rows = new Map<string, Row>()
  for (const r of seed) rows.set(r.wallet, r)

  function rpc(name: string, params: { p_wallet: string; p_cooldown_seconds: number }) {
    if (name !== 'try_reserve_faucet_slot') {
      return Promise.resolve({ data: null, error: { message: 'unknown rpc' } })
    }
    const { p_wallet, p_cooldown_seconds } = params
    const now = Date.now()
    const cutoff = now - p_cooldown_seconds * 1000

    const existing = rows.get(p_wallet)
    if (existing) {
      const lastMs = Date.parse(existing.last_minted_at)
      if (lastMs >= cutoff) {
        const elapsed = Math.floor((now - lastMs) / 1000)
        return Promise.resolve({
          data: [
            {
              allowed: false,
              retry_after: Math.max(p_cooldown_seconds - elapsed, 0),
              prior_last_minted_at: null,
            },
          ],
          error: null,
        })
      }
      const prior = existing.last_minted_at
      existing.last_minted_at = new Date(now).toISOString()
      existing.count = existing.count + 1
      return Promise.resolve({
        data: [{ allowed: true, retry_after: null, prior_last_minted_at: prior }],
        error: null,
      })
    }
    rows.set(p_wallet, { wallet: p_wallet, last_minted_at: new Date(now).toISOString(), count: 1 })
    return Promise.resolve({
      data: [{ allowed: true, retry_after: null, prior_last_minted_at: null }],
      error: null,
    })
  }

  function from(_: string) {
    let filterWallet: string | null = null
    let updatePayload: Partial<Row> | null = null
    let intent: 'select' | 'update' | 'delete' = 'select'

    const builder = {
      select: () => builder,
      eq: (_col: string, val: string) => {
        filterWallet = val
        if (intent === 'delete') {
          if (filterWallet) rows.delete(filterWallet)
          return Promise.resolve({ error: null })
        }
        if (intent === 'update') {
          const row = rows.get(filterWallet ?? '')
          if (row) Object.assign(row, updatePayload ?? {})
          return Promise.resolve({ error: null })
        }
        return builder
      },
      maybeSingle: async () => ({ data: rows.get(filterWallet ?? '') ?? null, error: null }),
      update: (payload: Partial<Row>) => {
        intent = 'update'
        updatePayload = payload
        return builder
      },
      delete: () => {
        intent = 'delete'
        return builder
      },
    }
    return builder
  }

  return {
    rpc,
    from,
    _rows: rows,
  }
}

const WALLET = '8ZFozhni5F3RkPXMRCvQevVcHYRXYr7VwYmwRDjrfZG3'

Deno.test('tryReserve allows a fresh wallet', async () => {
  const admin = makeFakeAdmin()
  const r = await tryReserve(admin, WALLET)
  assertEquals(r.allowed, true)
  assertEquals(r.priorLastMintedAt, null)
  assertEquals(admin._rows.size, 1)
})

Deno.test('tryReserve blocks a wallet that already minted within the cooldown', async () => {
  const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1h ago
  const admin = makeFakeAdmin([{ wallet: WALLET, last_minted_at: recent, count: 1 }])
  const r = await tryReserve(admin, WALLET)
  assertEquals(r.allowed, false)
  assertNotEquals(r.retryAfter, undefined)
  assertEquals(r.retryAfter! > 0 && r.retryAfter! <= COOLDOWN_SECS, true)
})

Deno.test('tryReserve allows a wallet whose last mint is past the cooldown', async () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h ago
  const admin = makeFakeAdmin([{ wallet: WALLET, last_minted_at: old, count: 3 }])
  const r = await tryReserve(admin, WALLET)
  assertEquals(r.allowed, true)
  assertEquals(r.priorLastMintedAt, old)
  assertEquals(admin._rows.size, 1)
  assertEquals(admin._rows.get(WALLET)!.count, 4)
})

Deno.test('tryReserve at exactly cooldown=24h is still blocked (strict inequality)', async () => {
  const exact = new Date(Date.now() - 24 * 60 * 60 * 1000 + 1000).toISOString() // 1s before 24h
  const admin = makeFakeAdmin([{ wallet: WALLET, last_minted_at: exact, count: 1 }])
  const r = await tryReserve(admin, WALLET)
  assertEquals(r.allowed, false)
})

Deno.test('releaseReservation deletes the row when there was no prior reservation', async () => {
  const admin = makeFakeAdmin()
  const reserved = await tryReserve(admin, WALLET)
  assertEquals(reserved.allowed, true)
  assertEquals(reserved.priorLastMintedAt, null)
  assertEquals(admin._rows.size, 1)

  await releaseReservation(admin, WALLET, reserved.priorLastMintedAt ?? null)
  assertEquals(admin._rows.size, 0)
  // After rollback, the next request must be allowed (i.e. the wallet
  // isn't blocked for the cooldown despite an upstream mint failure).
  const retry = await tryReserve(admin, WALLET)
  assertEquals(retry.allowed, true)
})

Deno.test('releaseReservation restores the prior last_minted_at on update path', async () => {
  // Wallet successfully minted 25h ago (so the next reserve succeeds
  // via the UPDATE path), then mint fails and we roll back.
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  const admin = makeFakeAdmin([{ wallet: WALLET, last_minted_at: old, count: 3 }])
  const reserved = await tryReserve(admin, WALLET)
  assertEquals(reserved.allowed, true)
  assertEquals(reserved.priorLastMintedAt, old)

  await releaseReservation(admin, WALLET, reserved.priorLastMintedAt ?? null)
  assertEquals(admin._rows.get(WALLET)!.last_minted_at, old)
})

Deno.test('tryReserve calls the atomic Postgres RPC (concurrency-hardened)', async () => {
  // The whole point of this PR's fix: tryReserve must not implement
  // the cooldown check in JS. If somebody refactors back to the racy
  // read-then-update pattern, this test breaks.
  let rpcCalls = 0
  const admin = {
    rpc(name: string) {
      assertEquals(name, 'try_reserve_faucet_slot')
      rpcCalls++
      return Promise.resolve({
        data: [{ allowed: true, retry_after: null, prior_last_minted_at: null }],
        error: null,
      })
    },
  }
  await tryReserve(admin as never, WALLET)
  assertEquals(rpcCalls, 1)
})

Deno.test('tryReserve surfaces RPC errors instead of silently allowing', async () => {
  const admin = {
    rpc() {
      return Promise.resolve({ data: null, error: { message: 'connection refused' } })
    },
  }
  let threw = false
  try {
    await tryReserve(admin as never, WALLET)
  } catch (e) {
    threw = true
    assertEquals(/connection refused/.test((e as Error).message ?? String(e)), true)
  }
  assertEquals(threw, true)
})
