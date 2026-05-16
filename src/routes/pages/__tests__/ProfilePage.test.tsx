import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicKey } from '@solana/web3.js'

import { useWalletStore } from '@/stores/walletStore'

const useSearchMock = vi.hoisted(() => vi.fn())
const useLocationMock = vi.hoisted(() => vi.fn())
const useProfileMock = vi.hoisted(() => vi.fn())
const useSaveProfileMock = vi.hoisted(() => vi.fn())
const useSupabaseAuthMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useSearch: useSearchMock,
    useLocation: useLocationMock,
  }
})

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ wallet: { adapter: { name: 'Phantom' } } }),
}))

vi.mock('@/features/chart/ChartFrame', () => ({
  ChartFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/features/profile/ProfilePageSkeleton', () => ({
  ProfilePageSkeleton: () => <div>Loading profile…</div>,
}))

vi.mock('@/layouts/PageLayout', () => ({
  PageLayout: ({
    title,
    subtitle,
    summaryBar,
    children,
  }: {
    title: string
    subtitle?: string
    summaryBar?: React.ReactNode
    children: React.ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {summaryBar}
      {children}
    </div>
  ),
}))

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

vi.mock('@/ui/ImageCropModal', () => ({
  ImageCropModal: () => null,
}))

vi.mock('@/ui/Sigils', () => ({
  SIGILS: Array.from({ length: 9 }, (_, idx) => {
    const Sigil = ({ size = 16 }: { size?: number; tone?: string }) => (
      <svg aria-label={`sigil-${idx}`} width={size} height={size} />
    )
    return Sigil
  }),
}))

vi.mock('@/lib/cn', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('@/lib/cropImage', () => ({
  readFileAsDataUrl: vi.fn(),
}))

vi.mock('@/lib/format', () => ({
  formatAddress: (value: string) => value,
}))

vi.mock('@/stores/toastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/hooks', () => ({
  checkUsernameAvailability: vi.fn(),
  getProfileImageUrl: (path: string | null) => path,
  useProfile: useProfileMock,
  useSaveProfile: useSaveProfileMock,
  useSupabaseAuth: useSupabaseAuthMock,
}))

import { ProfilePage } from '@/routes/pages/ProfilePage'

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSearchMock.mockReturnValue({ wallet: undefined })
    useLocationMock.mockImplementation(
      ({
        select,
      }: {
        select?: (location: { pathname: string; searchStr: string }) => unknown
      } = {}) => {
        const location = { pathname: '/profile', searchStr: '?wallet=not-a-wallet' }
        return select ? select(location) : location
      },
    )
    useProfileMock.mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
    })
    useSaveProfileMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    })
    useSupabaseAuthMock.mockReturnValue({
      status: 'authenticated',
      authenticate: vi.fn(),
    })
    useWalletStore.setState({
      publicKey: new PublicKey('11111111111111111111111111111111'),
      connected: true,
    })
  })

  it('does not fall back to the connected wallet when the wallet search param is malformed', () => {
    render(<ProfilePage />)

    expect(screen.getByText(/\[ connect a wallet to edit your profile \]/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save profile/i })).not.toBeInTheDocument()
  })
})
