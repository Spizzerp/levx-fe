import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildMessage } from './_shared/message.ts'

const FN_URL = Deno.env.get('FN_URL') ?? 'http://127.0.0.1:54321/functions/v1/verify-wallet'

async function postJSON(path: string, body: unknown = {}) {
  const res = await fetch(`${FN_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

Deno.test('nonce: returns nonce, message containing that nonce, and expiresAt', async () => {
  const { status, body } = await postJSON('/nonce')
  assertEquals(status, 200)
  assertExists(body.nonce)
  assertExists(body.expiresAt)
  assertExists(body.message)
  assertEquals(body.message, buildMessage(body.nonce))
})

Deno.test('nonce: subsequent calls return different nonces', async () => {
  const a = await postJSON('/nonce')
  const b = await postJSON('/nonce')
  assertEquals(a.status, 200)
  assertEquals(b.status, 200)
  if (a.body.nonce === b.body.nonce) throw new Error('nonces must be unique')
})
