import type { PropsWithChildren } from 'react'

export function CommonLayout({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="app-header">LEVX Frontend</header>
      <main className="app-main">{children}</main>
    </div>
  )
}
