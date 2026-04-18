import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import {
  cacheJWT, loadCachedJWT, clearJWT, getActiveJWT, __setActiveWallet,
  requestNonce, verifyAndGetJWT,
} from '../auth'

const PUBKEY_A = 'AliceWalletPubkey1111111111111111111111111111'
const PUBKEY_B = 'BobWalletPubkey22222222222222222222222222222'
const ONE_HOUR_MS = 60 * 60 * 1000

describe('auth cache', () => {
  beforeEach(() => {
    localStorage.clear()
    __setActiveWallet(null)
    vi.useRealTimers()
  })

  it('stores and retrieves a record keyed by wallet', () => {
    const exp = Date.now() + ONE_HOUR_MS
    cacheJWT({ jwt: 'abc', expiresAt: exp, wallet: PUBKEY_A })
    expect(loadCachedJWT(PUBKEY_A)).toEqual({ jwt: 'abc', expiresAt: exp, wallet: PUBKEY_A })
  })

  it('returns null for a different wallet', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_A })
    expect(loadCachedJWT(PUBKEY_B)).toBeNull()
  })

  it('returns null for an expired record', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() - 1000, wallet: PUBKEY_A })
    expect(loadCachedJWT(PUBKEY_A)).toBeNull()
  })

  it('clearJWT purges that wallet only', () => {
    cacheJWT({ jwt: 'a', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_A })
    cacheJWT({ jwt: 'b', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_B })
    clearJWT(PUBKEY_A)
    expect(loadCachedJWT(PUBKEY_A)).toBeNull()
    expect(loadCachedJWT(PUBKEY_B)?.jwt).toBe('b')
  })

  it('getActiveJWT returns null when no active wallet is set', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_A })
    expect(getActiveJWT()).toBeNull()
  })

  it('getActiveJWT returns the record for the active wallet', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() + ONE_HOUR_MS, wallet: PUBKEY_A })
    __setActiveWallet(PUBKEY_A)
    expect(getActiveJWT()?.jwt).toBe('abc')
  })

  it('getActiveJWT honors the 60s expiry margin', () => {
    cacheJWT({ jwt: 'abc', expiresAt: Date.now() + 30_000, wallet: PUBKEY_A })
    __setActiveWallet(PUBKEY_A)
    expect(getActiveJWT()).toBeNull()
  })
})

describe('auth edge function calls', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })

  afterAll(() => {
    globalThis.fetch = realFetch
  })

  it('requestNonce posts to /functions/v1/verify-wallet/nonce and returns payload', async () => {
    const payload = {
      nonce: 'abc', message: 'hello sign this', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: async () => payload,
    })
    const out = await requestNonce()
    expect(out).toEqual(payload)
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toMatch(/\/functions\/v1\/verify-wallet\/nonce$/)
    expect(call[1].method).toBe('POST')
  })

  it('verifyAndGetJWT posts pubkey/nonce/signature and returns JWT envelope', async () => {
    const payload = { jwt: 'eyJ...', expiresAt: new Date(Date.now() + 3600_000).toISOString() }
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: async () => payload,
    })
    const out = await verifyAndGetJWT({ pubkey: PUBKEY_A, nonce: 'abc', signature: 'sig' })
    expect(out.jwt).toBe('eyJ...')
    expect(out.wallet).toBe(PUBKEY_A)
    expect(typeof out.expiresAt).toBe('number')
  })

  it('verifyAndGetJWT throws on non-ok response', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 401, json: async () => ({ error: 'invalid_signature' }),
    })
    await expect(verifyAndGetJWT({ pubkey: PUBKEY_A, nonce: 'n', signature: 's' })).rejects.toThrow(/invalid_signature/)
  })
})
