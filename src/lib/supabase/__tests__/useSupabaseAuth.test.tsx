import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SupabaseAuthProvider } from '../provider'
import { useSupabaseAuth } from '../hooks'
import { useWalletStore } from '@/stores/walletStore'
import { cacheJWT } from '../auth'
import type { PublicKey } from '@solana/web3.js'

// useWallet is consumed by the provider's `signOverride` fallback path. The
// adapter is supplied by upstream wallet-adapter-react context. Here we mock
// it to a no-op since tests inject signMessage explicitly. Object identity must
// stay stable across renders or the provider's useCallback chain explodes.
const STABLE_WALLET = { signMessage: undefined }
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => STABLE_WALLET,
}))

const PUBKEY_A = 'AliceWalletPubkey1111111111111111111111111111'
const PUBKEY_B = 'BobWalletPubkey1111111111111111111111111111111'

function makeWrapper(signMessage?: (m: Uint8Array) => Promise<Uint8Array>) {
  return function Wrapper({ children }: PropsWithChildren) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return (
      <QueryClientProvider client={qc}>
        <SupabaseAuthProvider signMessage={signMessage}>{children}</SupabaseAuthProvider>
      </QueryClientProvider>
    )
  }
}

const okSign = (_msg: Uint8Array): Promise<Uint8Array> => Promise.resolve(new Uint8Array(64))

function setConnectedWallet(wallet: string | null) {
  useWalletStore.setState({
    publicKey: wallet ? ({ toBase58: () => wallet } as unknown as PublicKey) : null,
    connected: wallet !== null,
    connecting: false,
    wrongNetwork: false,
    cluster: 'devnet',
  })
}

describe('useSupabaseAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    useWalletStore.setState({
      publicKey: null, connected: false, connecting: false, wrongNetwork: false, cluster: null,
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('warm path: valid cached JWT restores silently', async () => {
    cacheJWT({ jwt: 'cached.jwt', expiresAt: Date.now() + 3600_000, wallet: PUBKEY_A })
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: makeWrapper() })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.jwt).toBe('cached.jwt')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cold path: no cache stays idle until authenticate() is called manually', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nonce: 'n1', message: 'sign me', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jwt: 'fresh.jwt', expiresAt: new Date(Date.now() + 86400_000).toISOString() }),
      })

    const sign = vi.fn(okSign)
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: makeWrapper(sign) })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.wallet).toBe(PUBKEY_A))

    expect(result.current.status).toBe('idle')
    expect(sign).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.authenticate()
    })

    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.jwt).toBe('fresh.jwt')
  })

  it('user rejects sig → status=error', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nonce: 'n1', message: 'sign', expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    })
    const reject = vi.fn().mockRejectedValueOnce(new Error('User rejected'))
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: makeWrapper(reject) })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.wallet).toBe(PUBKEY_A))
    await act(async () => {
      await expect(result.current.authenticate()).rejects.toThrow('User rejected')
    })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('disconnect: cache is purged and status returns to idle', async () => {
    cacheJWT({ jwt: 'old', expiresAt: Date.now() + 3600_000, wallet: PUBKEY_A })
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: makeWrapper() })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    act(() => setConnectedWallet(null))
    await waitFor(() => expect(result.current.status).toBe('idle'))
    expect(localStorage.getItem('levx_jwt:' + PUBKEY_A)).toBeNull()
  })

  it('switching wallets clears the prior JWT and leaves the new wallet signed out', async () => {
    cacheJWT({ jwt: 'old-a', expiresAt: Date.now() + 3600_000, wallet: PUBKEY_A })
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: makeWrapper() })

    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.jwt).toBe('old-a')

    act(() => setConnectedWallet(PUBKEY_B))
    await waitFor(() => expect(result.current.wallet).toBe(PUBKEY_B))

    expect(result.current.status).toBe('idle')
    expect(result.current.jwt).toBeNull()
    expect(localStorage.getItem('levx_jwt:' + PUBKEY_A)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('in-flight guard: parallel authenticate() calls only fire one nonce request', async () => {
    // Edge Function nonce response — held until we resolve `release` below
    // so we can simulate a second authenticate() landing while the first is
    // still mid-flight (the strict-mode double-fire scenario).
    let releaseFirst: () => void = () => {}
    const firstNonce = new Promise<Response>((resolve) => {
      releaseFirst = () => resolve({
        ok: true,
        json: async () => ({
          nonce: 'n1', message: 'sign', expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      } as unknown as Response)
    })
    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(firstNonce)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jwt: 'fresh.jwt', expiresAt: new Date(Date.now() + 86400_000).toISOString() }),
      })

    const sign = vi.fn(okSign)
    const { result } = renderHook(() => useSupabaseAuth(), { wrapper: makeWrapper(sign) })
    act(() => setConnectedWallet(PUBKEY_A))
    await waitFor(() => expect(result.current.wallet).toBe(PUBKEY_A))

    await act(async () => {
      void result.current.authenticate()
      void result.current.authenticate()
      void result.current.authenticate()
      void result.current.authenticate()
    })
    // Now release the held nonce so the original flow completes.
    await act(async () => {
      releaseFirst()
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    // The user should have been prompted to sign exactly once, not 4 times.
    expect(sign).toHaveBeenCalledTimes(1)
    // Total fetch calls: 1 nonce + 1 verify = 2. Without the guard, the parallel
    // calls would have queued additional nonce requests.
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
  })
})
