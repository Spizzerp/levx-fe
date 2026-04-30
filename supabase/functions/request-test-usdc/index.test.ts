// @ts-nocheck — Supabase Edge (Deno).
//
// Unit tests for the rate-limit helper. The full handler depends on
// Solana RPC + a real keypair, so we test the rate-limit semantics
// directly here and rely on manual smoke testing for the on-chain leg.

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { tryReserve } from './_shared/rateLimit.ts'

interface Row {
  wallet: string
  last_minted_at: string
  count: number
}

function makeFakeAdmin(seed: Row[] = []) {
  const rows = new Map<string, Row>()
  for (const r of seed) rows.set(r.wallet, r)

  function from(_: string) {
    let filterWallet: string | null = null
    let filterCutoff: string | null = null
    let updatePayload: Partial<Row> | null = null
    let intent: 'select' | 'update' | 'insert' = 'select'

    const builder = {
      select: () => builder,
      eq: (_col: string, val: string) => {
        filterWallet = val
        return builder
      },
      lt: (_col: string, val: string) => {
        filterCutoff = val
        return builder
      },
      maybeSingle: async () => {
        if (intent === 'select') {
          return { data: rows.get(filterWallet ?? '') ?? null, error: null }
        }
        if (intent === 'update') {
          const row = rows.get(filterWallet ?? '')
          if (!row) return { data: null, error: null }
          if (filterCutoff && row.last_minted_at >= filterCutoff) {
            return { data: null, error: null }
          }
          Object.assign(row, updatePayload ?? {})
          return { data: { wallet: row.wallet }, error: null }
        }
        return { data: null, error: null }
      },
      update: (payload: Partial<Row>) => {
        intent = 'update'
        updatePayload = payload
        return builder
      },
      insert: async (payload: Row) => {
        if (rows.has(payload.wallet)) {
          return { error: { code: '23505' } }
        }
        rows.set(payload.wallet, payload)
        return { error: null }
      },
    }
    return builder
  }

  return {
    from,
    _rows: rows,
  }
}

const WALLET = '8ZFozhni5F3RkPXMRCvQevVcHYRXYr7VwYmwRDjrfZG3'

Deno.test('tryReserve allows a fresh wallet', async () => {
  const admin = makeFakeAdmin()
  const r = await tryReserve(admin, WALLET)
  assertEquals(r.allowed, true)
  assertEquals(admin._rows.size, 1)
})

Deno.test('tryReserve blocks a wallet that already minted within the cooldown', async () => {
  const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1h ago
  const admin = makeFakeAdmin([{ wallet: WALLET, last_minted_at: recent, count: 1 }])
  const r = await tryReserve(admin, WALLET)
  assertEquals(r.allowed, false)
  assertNotEquals(r.retryAfter, undefined)
  // ~23h remaining — accept anything ≤ 24h * 3600 = 86_400 seconds.
  assertEquals(r.retryAfter! > 0 && r.retryAfter! <= 24 * 60 * 60, true)
})

Deno.test('tryReserve allows a wallet whose last mint is past the cooldown', async () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h ago
  const admin = makeFakeAdmin([{ wallet: WALLET, last_minted_at: old, count: 3 }])
  const r = await tryReserve(admin, WALLET)
  assertEquals(r.allowed, true)
  // The row should be updated, not duplicated.
  assertEquals(admin._rows.size, 1)
  assertEquals(admin._rows.get(WALLET)!.count, 4)
})

Deno.test('tryReserve at exactly cooldown=24h is still blocked (strict inequality)', async () => {
  const exact = new Date(Date.now() - 24 * 60 * 60 * 1000 + 1000).toISOString() // 1s before 24h
  const admin = makeFakeAdmin([{ wallet: WALLET, last_minted_at: exact, count: 1 }])
  const r = await tryReserve(admin, WALLET)
  assertEquals(r.allowed, false)
})
