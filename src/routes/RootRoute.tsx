import { Outlet } from '@tanstack/react-router'

import { CommonLayout } from '@/layouts/CommonLayout'

export function RootRouteComponent() {
  return (
    <CommonLayout>
      <Outlet />
    </CommonLayout>
  )
}
