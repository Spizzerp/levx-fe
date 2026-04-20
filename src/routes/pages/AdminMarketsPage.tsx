import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { useMarkets } from '@/lib/api/hooks'
import { formatUSD } from '@/lib/format'

export function AdminMarketsPage() {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const { data: markets, isLoading } = useMarkets()

  if (!isAdmin) {
    return (
      <main className="px-10 pt-6 pb-12">
        <h1 className="font-display text-ink-strong mb-4 text-[56px] leading-none font-medium tracking-[-0.01em] [font-variation-settings:'ROND'_100]">
          Admin
        </h1>
        <p className="text-ink-muted font-mono text-xs tracking-normal uppercase">
          Connect an admin wallet to access this page.
        </p>
      </main>
    )
  }

  return (
    <main className="px-10 pt-6 pb-12">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-ink-strong mb-4 text-[56px] leading-none font-medium tracking-[-0.01em] [font-variation-settings:'ROND'_100]">
            Admin
          </h1>
          <p className="text-ink-muted font-mono text-xs tracking-normal uppercase">
            Manage markets
          </p>
        </div>
        {markets && markets.length > 0 && (
          <Button
            variant="primary"
            onClick={() => void navigate({ to: '/admin/create' })}
          >
            <Plus size={14} strokeWidth={2} className="mr-2" />
            New market
          </Button>
        )}
      </header>

      {/* ── Existing markets ───────────────────────────────── */}
      {isLoading && (
        <p className="text-ink-dim font-mono text-label uppercase animate-pulse">
          Loading markets…
        </p>
      )}

      {!isLoading && (!markets || markets.length === 0) && (
        <div className={cn(
          'flex flex-col items-center justify-center gap-4 py-24',
          'border border-dashed border-line-strong rounded-2xl',
        )}>
          <p className="text-ink-muted font-mono text-label uppercase">
            No markets yet
          </p>
          <Button
            variant="secondary"
            onClick={() => void navigate({ to: '/admin/create' })}
          >
            <Plus size={14} strokeWidth={2} className="mr-2" />
            Create your first market
          </Button>
        </div>
      )}

      {markets && markets.length > 0 && (
        <div className="flex flex-col gap-3">
          {markets.map((m) => (
            <button
              key={m.id}
              type="button"
              className={cn(
                'flex items-center gap-6 rounded-xl border border-line px-6 py-4 text-left',
                'duration-short ease-levx transition-[border-color,background-color]',
                'hover:border-line-strong hover:bg-surface-1',
              )}
              onClick={() => void navigate({ to: '/market/$id', params: { id: m.id } })}
            >
              <span className="text-ink-strong font-mono text-sm font-bold tracking-wide uppercase">
                {m.pair || `Market ${m.marketId}`}
              </span>
              <span className={cn(
                'rounded-full border px-2 py-0.5 font-mono text-label uppercase tracking-wider',
                m.state === 'active' ? 'border-success/30 text-success' :
                m.state === 'pending' ? 'border-warning/30 text-warning' :
                m.state === 'settled' ? 'border-ink-dim/30 text-ink-dim' :
                'border-line-strong text-ink-muted',
              )}>
                {m.state}
              </span>
              <span className="text-ink-muted font-mono text-value ml-auto">
                {formatUSD(m.pool)} USDC
              </span>
              <span className="text-ink-dim font-mono text-caption">
                {m.traders} traders
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}
