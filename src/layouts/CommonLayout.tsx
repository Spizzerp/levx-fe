import type { PropsWithChildren } from 'react'

import { Nav } from '@/components/Nav'

export function CommonLayout({ children }: PropsWithChildren) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}
