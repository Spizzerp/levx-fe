import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'

import { MarketCard } from '@/features/market/MarketCard'
import { MarketGroupSummary } from '@/features/marketGroups/MarketGroupSummary'
import {
  buildMarketGroupSummaries,
  getMarketsForGroup,
} from '@/features/marketGroups/groupPresentation'
import { PageLayout } from '@/layouts/PageLayout'
import { useMarkets } from '@/lib/chain'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { QueryErrorState } from '@/ui/QueryErrorState'

export function MarketGroupPage() {
  const { groupKeyHash } = useParams({ from: '/markets/group/$groupKeyHash' })
  const navigate = useNavigate()
  const { data: markets, isLoading, isError, refetch } = useMarkets()
  const now = Date.now()

  const childMarkets = useMemo(
    () => getMarketsForGroup(markets, groupKeyHash),
    [markets, groupKeyHash],
  )
  const summary = useMemo(
    () => buildMarketGroupSummaries(childMarkets).find((item) => item.groupKeyHash === groupKeyHash),
    [childMarkets, groupKeyHash],
  )

  return (
    <PageLayout title="Market Group" subtitle="Child markets settle independently.">
      <div className="mb-5">
        <Link
          to="/markets"
          className={cn(
            'text-ink-muted hover:text-ink inline-flex h-10 items-center gap-2',
            'font-mono text-xs uppercase',
            'focus-visible:ring-ink-strong focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          )}
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          Back to markets
        </Link>
      </div>

      {isLoading && (
        <div
          role="status"
          aria-label="Loading market group"
          className="border-line bg-surface/40 h-40 animate-pulse border"
        />
      )}

      {isError && (
        <QueryErrorState
          title="We couldn't load this market group"
          message="The market feed did not return group metadata. Try again."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && !summary && (
        <div className="border-line-strong flex flex-col items-center justify-center gap-4 border border-dashed py-24 text-center">
          <p className="text-ink-muted text-label font-mono uppercase">
            [ No child markets found ]
          </p>
          <Button variant="secondary" onClick={() => void navigate({ to: '/markets' })}>
            Back to markets
          </Button>
        </div>
      )}

      {!isLoading && !isError && summary && (
        <div className="space-y-5">
          <MarketGroupSummary summary={summary} now={now} />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {childMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                now={now}
                onClick={() => void navigate({ to: '/market/$id', params: { id: market.id } })}
              />
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
