import { useNavigate } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/ui/Button'
import { cn } from '@/lib/cn'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { useMarkets } from '@/lib/api/hooks'
import { formatUSD } from '@/lib/format'
import { useCloseMarket } from '@/lib/solana'
import type { Market } from '@/types/market'

function canCloseMarket(market: Market): boolean {
  return (market.state === 'settled' || market.state === 'void') && market.traders === 0
}

export function AdminMarketsPage() {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const { data: markets, isLoading } = useMarkets()
  const closeMarket = useCloseMarket()

  const handleCloseMarket = (market: Market) => {
    const label = market.pair || `Market ${market.marketId}`
    if (!window.confirm(`Close ${label}?`)) return
    closeMarket.mutate({ marketId: market.marketId, vault: market.vault })
  }

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
          {markets.map((m) => {
            const closeable = canCloseMarket(m)
            const closing = closeMarket.isPending && closeMarket.variables?.marketId === m.marketId
            return (
              <div
                key={m.id}
                className={cn(
                  'flex items-center gap-6 rounded-xl border border-line px-6 py-4 text-left',
                  'duration-short ease-levx transition-[border-color,background-color]',
                  'hover:border-line-strong hover:bg-surface-1',
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-6 text-left focus-visible:outline-none"
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
                {(m.state === 'settled' || m.state === 'void') && (
                  <Button
                    variant="destructive"
                    className="min-h-9 px-4 py-2"
                    disabled={!closeable || closing}
                    title={
                      closeable ? 'Close market' : 'All positions must be claimed or exited first'
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCloseMarket(m)
                    }}
                  >
                    <Trash2 size={14} strokeWidth={2} className="mr-2" />
                    {closing ? 'Closing' : 'Close'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
