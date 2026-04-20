import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let mockPathname = '/'
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: mockPathname }),
}))

vi.mock('@/layouts/Nav', () => ({
  Nav: () => <div data-testid="nav-marker">NAV</div>,
}))

vi.mock('@/features/wallet/WrongNetworkBanner', () => ({
  WrongNetworkBanner: () => null,
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
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders Nav on non-landing routes', () => {
    mockPathname = '/markets'
    render(
      <CommonLayout>
        <div data-testid="child">child</div>
      </CommonLayout>,
    )
    expect(screen.getByTestId('nav-marker')).toBeInTheDocument()
  })
})
