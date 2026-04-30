import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/env', () => ({
  env: {
    APP_SUPABASE_URL: 'http://localhost:54321',
    APP_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}))

const jwtRef: { current: { jwt: string; expiresAt: number; wallet: string } | null } = {
  current: null,
}
vi.mock('@/lib/supabase/auth', () => ({
  getActiveJWT: () => jwtRef.current,
}))

import { FaucetRateLimitError, requestTestUsdc } from '@/lib/supabase/faucet'

const VALID_JWT = { jwt: 'fake.jwt.token', expiresAt: Date.now() + 60_000, wallet: '8ZF…' }

describe('requestTestUsdc', () => {
  beforeEach(() => {
    jwtRef.current = null
    vi.restoreAllMocks()
  })

  it('throws a clear error when no JWT is cached', async () => {
    await expect(requestTestUsdc()).rejects.toThrow(/Sign in with your wallet/i)
  })

  it('returns the success payload on 200', async () => {
    jwtRef.current = VALID_JWT
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sig: 'tx-sig',
          amount: '1000000000',
          mint: 'mint-pubkey',
          ata: 'ata-pubkey',
        }),
        { status: 200 },
      ),
    )

    const result = await requestTestUsdc()
    expect(result.sig).toBe('tx-sig')
    expect(result.amount).toBe('1000000000')

    // Verify the JWT was attached.
    const callInit = fetchSpy.mock.calls[0][1] as RequestInit
    expect((callInit.headers as Record<string, string>).Authorization).toBe(`Bearer ${VALID_JWT.jwt}`)
  })

  it('throws FaucetRateLimitError on 429 with retryAfter', async () => {
    jwtRef.current = VALID_JWT
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'rate_limited', retryAfter: 3600 }),
        { status: 429 },
      ),
    )

    try {
      await requestTestUsdc()
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(FaucetRateLimitError)
      expect((e as FaucetRateLimitError).retryAfter).toBe(3600)
    }
  })

  it('throws a friendly auth-expired message on 401', async () => {
    jwtRef.current = VALID_JWT
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_jwt' }), { status: 401 }),
    )

    await expect(requestTestUsdc()).rejects.toThrow(/disconnect and reconnect/i)
  })

  it('surfaces the on-chain error detail when mint fails', async () => {
    jwtRef.current = VALID_JWT
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'mint_failed', detail: 'BlockhashNotFound' }),
        { status: 502 },
      ),
    )

    await expect(requestTestUsdc()).rejects.toThrow(/BlockhashNotFound/)
  })
})
