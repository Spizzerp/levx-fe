import type { PropsWithChildren } from 'react'

import { Nav } from '@/components/Nav'
import { ToastContainer } from '@/components/ToastContainer'
import { WrongNetworkBanner } from '@/components/WrongNetworkBanner'

export function CommonLayout({ children }: PropsWithChildren) {
  return (
    <>
      <Nav />
      <WrongNetworkBanner />
      <div style={{ isolation: 'isolate' }}>{children}</div>
      <ToastContainer />
    </>
  )
}
