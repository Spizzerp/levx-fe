import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { checkUsernameAvailability, useSaveProfile } from '../hooks'
import {
  __resetSupabaseMock,
  mockFrom,
  mockStorageRemove,
  mockStorageUpload,
} from '../__mocks__/supabase-js'

function wrapper({ children }: PropsWithChildren) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function mockMaybeSingle(data: unknown, error: unknown = null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data, error }),
      }),
    }),
  }
}

function mockProfileUpsert(row: unknown, error: unknown = null) {
  return {
    upsert: vi.fn(() => ({
      select: () => ({
        single: () => Promise.resolve({ data: row, error }),
      }),
    })),
  }
}

describe('profile hooks', () => {
  beforeEach(() => {
    __resetSupabaseMock()
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReset()
    mockStorageUpload.mockClear()
    mockStorageRemove.mockClear()
  })

  it('checkUsernameAvailability allows the current wallet to keep its username', async () => {
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockMaybeSingle({ wallet_address: 'wallet-a' }),
    )

    await expect(checkUsernameAvailability('alice', 'wallet-a')).resolves.toBe(true)
  })

  it('checkUsernameAvailability rejects usernames owned by another wallet', async () => {
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockMaybeSingle({ wallet_address: 'wallet-b' }),
    )

    await expect(checkUsernameAvailability('alice', 'wallet-a')).resolves.toBe(false)
  })

  it('useSaveProfile uploads a new cropped avatar before upserting the profile row', async () => {
    const savedRow = {
      user_id: 'user-1',
      wallet_address: 'wallet-a',
      wallet_name: 'Phantom',
      username: 'alice',
      display_name: 'Alice',
      bio: 'bio',
      x_id: 'alice',
      avatar_kind: 'image',
      avatar_sigil_idx: 2,
      avatar_image_path: 'wallet-a/avatar.png',
      created_at: '2026-04-21T00:00:00Z',
      updated_at: '2026-04-21T00:01:00Z',
    }
    const profileTable = mockProfileUpsert(savedRow)
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValue(profileTable)

    const { result } = renderHook(() => useSaveProfile(), { wrapper })
    result.current.mutate({
      walletAddress: 'wallet-a',
      walletName: 'Phantom',
      username: 'alice',
      displayName: 'Alice',
      bio: 'bio',
      xId: 'alice',
      avatarSigilIdx: 2,
      avatarKind: 'image',
      avatarPreview: 'data:image/png;base64,ZmFrZQ==',
      existingProfile: null,
    })

    await waitFor(() => expect(result.current.data?.avatar_image_path).toBe('wallet-a/avatar.png'))
    expect(mockStorageUpload).toHaveBeenCalledTimes(1)
    expect(profileTable.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar_kind: 'image',
        avatar_image_path: 'wallet-a/avatar.png',
      }),
      { onConflict: 'wallet_address' },
    )
  })

  it('useSaveProfile removes the old image when switching back to a sigil avatar', async () => {
    const savedRow = {
      user_id: 'user-1',
      wallet_address: 'wallet-a',
      wallet_name: 'Phantom',
      username: 'alice',
      display_name: 'Alice',
      bio: 'bio',
      x_id: 'alice',
      avatar_kind: 'sigil',
      avatar_sigil_idx: 4,
      avatar_image_path: null,
      created_at: '2026-04-21T00:00:00Z',
      updated_at: '2026-04-21T00:01:00Z',
    }
    const profileTable = mockProfileUpsert(savedRow)
    ;(mockFrom as unknown as ReturnType<typeof vi.fn>).mockReturnValue(profileTable)

    const { result } = renderHook(() => useSaveProfile(), { wrapper })
    result.current.mutate({
      walletAddress: 'wallet-a',
      walletName: 'Phantom',
      username: 'alice',
      displayName: 'Alice',
      bio: 'bio',
      xId: 'alice',
      avatarSigilIdx: 4,
      avatarKind: 'sigil',
      avatarPreview: null,
      existingProfile: {
        user_id: 'user-1',
        wallet_address: 'wallet-a',
        wallet_name: 'Phantom',
        username: 'alice',
        display_name: 'Alice',
        bio: 'bio',
        x_id: 'alice',
        avatar_kind: 'image',
        avatar_sigil_idx: 1,
        avatar_image_path: 'wallet-a/avatar.png',
        created_at: '2026-04-21T00:00:00Z',
        updated_at: '2026-04-21T00:00:30Z',
      },
    })

    await waitFor(() => expect(result.current.data?.avatar_kind).toBe('sigil'))
    expect(mockStorageRemove).toHaveBeenCalledWith(['wallet-a/avatar.png'])
    expect(profileTable.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar_kind: 'sigil',
        avatar_image_path: null,
      }),
      { onConflict: 'wallet_address' },
    )
  })
})
