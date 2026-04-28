import type { PropsWithChildren } from 'react'
import { FileText } from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'

import { Nav } from '@/layouts/Nav'
import { ToastContainer } from '@/ui/ToastContainer'
import { WrongNetworkBanner } from '@/features/wallet/WrongNetworkBanner'

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function CommonLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation()
  const showChrome = pathname !== '/' && pathname !== '/docs'

  return (
    <>
      {showChrome && <Nav />}
      <WrongNetworkBanner />
      <div style={{ isolation: 'isolate' }} className="flex-1">{children}</div>
      {showChrome && (
        <div className="mt-auto flex items-center justify-center gap-4 py-8">
          <a
            href="https://x.com/LevXtrade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-dim hover:text-ink-strong duration-short ease-levx transition-colors"
          >
            <XIcon size={16} />
          </a>
          <Link
            to="/docs"
            aria-label="LevX docs"
            className="text-ink-dim duration-short ease-levx transition-colors hover:text-ink-strong"
          >
            <FileText size={16} strokeWidth={1.5} />
          </Link>
        </div>
      )}
      <ToastContainer />
    </>
  )
}
