import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildMessage } from './_shared/message.ts'
import nacl from 'npm:tweetnacl@1.0.3'
import bs58 from 'npm:bs58@5.0.0'
import { verify as verifyJWT } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const FN_URL = Deno.env.get('FN_URL') ?? 'http://127.0.0.1:54321/functions/v1/verify-wallet'
const TEST_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'

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

async function testJWTKey() {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(TEST_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

function newKeypair() {
  return nacl.sign.keyPair()
}

function sign(message: string, secretKey: Uint8Array): string {
  const sig = nacl.sign.detached(new TextEncoder().encode(message), secretKey)
  return bs58.encode(sig)
}

async function freshNonce(): Promise<{ nonce: string; message: string }> {
  const { body } = await postJSON('/nonce')
  return { nonce: body.nonce, message: body.message }
}

Deno.test('verify: rejects malformed body', async () => {
  const { status, body } = await postJSON('/verify', { pubkey: 123 })
  assertEquals(status, 400)
  assertEquals(body.error, 'malformed')
})

Deno.test('verify: rejects unknown nonce', async () => {
  const kp = newKeypair()
  const pubkey = bs58.encode(kp.publicKey)
  const message = 'never-issued-by-server'
  const signature = sign(message, kp.secretKey)
  const { status, body } = await postJSON('/verify', {
    pubkey, nonce: 'unknown-nonce-abc', signature,
  })
  assertEquals(status, 400)
  assertEquals(body.error, 'nonce_used_or_expired')
})

Deno.test('verify: rejects bad signature', async () => {
  const { nonce, message } = await freshNonce()
  const kp = newKeypair()
  const otherKp = newKeypair()
  const badSig = sign(message, otherKp.secretKey)
  const { status, body } = await postJSON('/verify', {
    pubkey: bs58.encode(kp.publicKey), nonce, signature: badSig,
  })
  assertEquals(status, 401)
  assertEquals(body.error, 'invalid_signature')
})

Deno.test('verify: rejects double-spend (race)', async () => {
  const { nonce, message } = await freshNonce()
  const kp = newKeypair()
  const pubkey = bs58.encode(kp.publicKey)
  const signature = sign(message, kp.secretKey)

  const [a, b] = await Promise.all([
    postJSON('/verify', { pubkey, nonce, signature }),
    postJSON('/verify', { pubkey, nonce, signature }),
  ])
  const successes = [a, b].filter((r) => r.status === 200).length
  const rejections = [a, b].filter((r) => r.status !== 200).length
  assertEquals(successes, 1)
  assertEquals(rejections, 1)
})

Deno.test('verify: returns a valid JWT for a good signature', async () => {
  const { nonce, message } = await freshNonce()
  const kp = newKeypair()
  const pubkey = bs58.encode(kp.publicKey)
  const signature = sign(message, kp.secretKey)
  const { status, body } = await postJSON('/verify', { pubkey, nonce, signature })
  assertEquals(status, 200)
  assertExists(body.jwt)
  const key = await testJWTKey()
  const payload = await verifyJWT(body.jwt, key)
  assertEquals(payload.wallet, pubkey)
  assertEquals(payload.sub, pubkey)
  assertEquals(payload.role, 'authenticated')
  assertEquals(payload.aud, 'authenticated')
})

Deno.test('verify: second call with the same consumed nonce fails', async () => {
  const { nonce, message } = await freshNonce()
  const kp = newKeypair()
  const pubkey = bs58.encode(kp.publicKey)
  const signature = sign(message, kp.secretKey)
  const first = await postJSON('/verify', { pubkey, nonce, signature })
  assertEquals(first.status, 200)
  const second = await postJSON('/verify', { pubkey, nonce, signature })
  assertEquals(second.status, 400)
  assertEquals(second.body.error, 'nonce_used_or_expired')
})
