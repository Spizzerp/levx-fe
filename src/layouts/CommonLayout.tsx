import type { PropsWithChildren } from 'react'
import { FileText } from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'

import { Nav } from '@/layouts/Nav'
import { StreamingBanner } from '@/ui/StreamingBanner'
import { ToastContainer } from '@/ui/ToastContainer'
import { WrongNetworkBanner } from '@/features/wallet/WrongNetworkBanner'
import { KeeperHealthDot } from '@/features/wallet/KeeperHealthDot'

const KEEPER_HEALTH_ROUTES = [
  '/markets',
  '/market/',
  '/portfolio',
  '/positions',
  '/leaderboard',
  '/vault',
  '/admin',
] as const

function shouldShowKeeperHealth(pathname: string): boolean {
  return KEEPER_HEALTH_ROUTES.some((route) =>
    route.endsWith('/')
      ? pathname.startsWith(route)
      : pathname === route || pathname.startsWith(`${route}/`),
  )
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function CommonLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation()
  const showMainLayout = pathname !== '/' && !pathname.startsWith('/docs')
  const showKeeperHealth = shouldShowKeeperHealth(pathname)

  return (
    <>
      {showMainLayout && <StreamingBanner />}
      {showMainLayout && <Nav />}
      <WrongNetworkBanner />
      <div style={{ isolation: 'isolate' }} className="flex-1">
        {children}
      </div>
      {showMainLayout && (
        <footer className="mt-auto border-t border-ink-dim/25">
          <div className="mx-auto grid max-w-[1680px] grid-cols-3 items-center px-10 py-4">
            <span className="text-ink-dim font-mono text-xs justify-self-start">
              Not Your Business LLC ©
            </span>
            <div className="flex items-center gap-4 justify-self-center">
              <a
                href="https://x.com/LevXtrade"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LevX on X"
                className="text-ink-dim hover:text-ink-strong duration-short ease-levx transition-colors"
              >
                <XIcon size={15} />
              </a>
              <Link
                to="/docs"
                aria-label="LevX docs"
                className="text-ink-dim duration-short ease-levx hover:text-ink-strong transition-colors"
              >
                <FileText size={15} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
            <div className="flex items-center justify-self-end">
              {showKeeperHealth && <KeeperHealthDot />}
            </div>
          </div>
        </footer>
      )}
      <ToastContainer />
    </>
  )
}
