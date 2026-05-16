import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PublicKey } from '@solana/web3.js'

import { useWalletStore } from '@/stores/walletStore'

const setVisible = vi.hoisted(() => vi.fn())
const authenticateMock = vi.hoisted(() => vi.fn())
const postMutateMock = vi.hoisted(() => vi.fn())
const deleteMutateMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible, visible: false }),
}))

vi.mock('@/lib/supabase/hooks', () => ({
  useComments: () => ({ data: [], isLoading: false, error: null }),
  usePostComment: () => ({
    mutate: postMutateMock,
    isPending: false,
    error: null,
  }),
  useDeleteComment: () => ({
    mutate: deleteMutateMock,
    isPending: false,
    error: null,
  }),
  useProfiles: () => ({ data: {} }),
  useSupabaseAuth: () => ({
    status: 'idle',
    authenticate: authenticateMock,
  }),
  getProfileImageUrl: (path: string | null) => path,
}))

vi.mock('@/ui/Modal', () => {
  function Modal({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  }
  Modal.Title = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  Modal.Description = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  return { Modal }
})

vi.mock('@/ui/Button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/stores/toastStore', () => ({
  toast: {
    error: toastErrorMock,
  },
}))

import { MarketComments } from '@/features/market/MarketComments'

describe('MarketComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateMock.mockResolvedValue(undefined)
    useWalletStore.setState({
      publicKey: {
        toBase58: () => 'CommentWallet1111111111111111111111111111',
      } as unknown as PublicKey,
      connected: true,
      connecting: false,
      wrongNetwork: false,
      cluster: 'mainnet',
    })
  })

  it('authenticates on explicit submit when the wallet is connected but no JWT is cached', async () => {
    const user = userEvent.setup()

    render(<MarketComments marketId="market-1" />)

    await user.type(screen.getByPlaceholderText('Share your take…'), 'First comment')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(authenticateMock).toHaveBeenCalledTimes(1)
    expect(postMutateMock).toHaveBeenCalledWith(
      { body: 'First comment' },
      expect.any(Object),
    )
  })

  it('shows a toast and does not post when explicit auth is rejected', async () => {
    const user = userEvent.setup()
    authenticateMock.mockRejectedValueOnce(new Error('User rejected'))

    render(<MarketComments marketId="market-1" />)

    await user.type(screen.getByPlaceholderText('Share your take…'), 'First comment')
    await user.click(screen.getByRole('button', { name: 'Post comment' }))

    expect(authenticateMock).toHaveBeenCalledTimes(1)
    expect(postMutateMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith('Comment not posted', {
      message: 'Finish wallet sign-in to post a comment.',
    })
  })
})
