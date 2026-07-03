import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, Layers } from 'lucide-react'
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
import { useNowTick } from '@/lib/hooks/useNowTick'
import { QueryErrorState } from '@/ui/QueryErrorState'

export function MarketGroupPage() {
  const { groupKeyHash } = useParams({ from: '/markets/group/$groupKeyHash' })
  const navigate = useNavigate()
  const { data: markets, isLoading, isError, refetch } = useMarkets()
  const now = useNowTick(1000)

  const childMarkets = useMemo(
    () => getMarketsForGroup(markets, groupKeyHash),
    [markets, groupKeyHash],
  )
  const summary = useMemo(() => buildMarketGroupSummaries(childMarkets)[0], [childMarkets])

  return (
    <PageLayout title="Market Group" subtitle="Child markets settle independently.">
      <div className="mb-5">
        <Link
          to="/markets"
          className={cn(
            'text-ink-muted hover:text-ink inline-flex h-10 items-center gap-2',
            'font-mono text-xs uppercase',
            'focus-visible:ring-ink-strong focus-visible:ring-offset-surface focus-visible:ring-2 focus-visible:ring-offset-2',
          )}
        >
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          Back to markets
        </Link>
      </div>

      {isLoading && (
        <div role="status" aria-label="Loading market group" className="space-y-5">
          <div className="border-line bg-surface/40 h-52 animate-pulse rounded-2xl border" />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="border-line bg-surface/40 h-[290px] animate-pulse rounded-2xl border"
              />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <QueryErrorState
          title="We couldn't load this market group"
          message="The market feed did not return group metadata. Try again."
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && !summary && (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-24 text-center',
            'border-line-strong',
          )}
        >
          <Layers size={28} strokeWidth={1.5} className="text-ink-dim" aria-hidden />
          <div className="space-y-1">
            <p className="text-ink-strong font-display text-2xl">No markets in this group yet</p>
            <p className="text-ink-muted max-w-md font-mono text-xs uppercase">
              This group exists only when at least one indexed child market links to the hash{' '}
              {groupKeyHash.slice(0, 8)}.
            </p>
          </div>
          <Link
            to="/markets"
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full border px-3',
              'border-line-strong text-ink-muted hover:border-ink hover:text-ink',
              'text-label font-mono tracking-wider uppercase',
              'duration-short ease-levx transition-[border-color,color]',
              'focus-visible:ring-ink-strong focus-visible:ring-offset-surface focus-visible:ring-2 focus-visible:ring-offset-2',
            )}
          >
            View all markets
          </Link>
        </div>
      )}

      {!isLoading && !isError && summary && (
        <div className="space-y-5">
          <MarketGroupSummary summary={summary} now={now} />
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-label text-ink-dim font-mono uppercase">Child markets</p>
              <h3 className="text-ink-strong font-display text-2xl">
                {summary.totalMarkets} independent markets
              </h3>
            </div>
            <p className="text-ink-muted max-w-xl font-mono text-xs uppercase md:text-right">
              Grouping is discovery-only. Every child market keeps its own pool, lifecycle, and
              settlement.
            </p>
          </div>
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
