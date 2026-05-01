import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

let mockPathname = '/'
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: ComponentPropsWithoutRef<'a'> & { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: mockPathname }),
}))

vi.mock('@/layouts/Nav', () => ({
  Nav: () => <div data-testid="nav-marker">NAV</div>,
}))

vi.mock('@/features/wallet/WrongNetworkBanner', () => ({
  WrongNetworkBanner: () => null,
}))

vi.mock('@/features/wallet/KeeperHealthDot', () => ({
  KeeperHealthDot: () => <div data-testid="keeper-health">Keeper online</div>,
}))

vi.mock('@/ui/ToastContainer', () => ({
  ToastContainer: () => null,
}))

import { CommonLayout } from '@/layouts/CommonLayout'

describe('CommonLayout', () => {
  it('hides Nav on the landing route (/)', () => {
    mockPathname = '/'
    render(
      <CommonLayout>
        <div data-testid="child">child</div>
      </CommonLayout>,
    )
    expect(screen.queryByTestId('nav-marker')).not.toBeInTheDocument()
    expect(screen.queryByTestId('keeper-health')).not.toBeInTheDocument()
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders Nav and keeper health on protocol app routes', () => {
    mockPathname = '/markets'
    render(
      <CommonLayout>
        <div data-testid="child">child</div>
      </CommonLayout>,
    )
    expect(screen.getByTestId('nav-marker')).toBeInTheDocument()
    expect(screen.getByTestId('keeper-health')).toBeInTheDocument()
  })

  it('hides keeper health on docs and non-protocol app routes', () => {
    mockPathname = '/docs'
    const { rerender } = render(
      <CommonLayout>
        <div data-testid="child">child</div>
      </CommonLayout>,
    )
    expect(screen.queryByTestId('keeper-health')).not.toBeInTheDocument()

    mockPathname = '/profile'
    rerender(
      <CommonLayout>
        <div data-testid="child">child</div>
      </CommonLayout>,
    )
    expect(screen.queryByTestId('keeper-health')).not.toBeInTheDocument()
  })
})
