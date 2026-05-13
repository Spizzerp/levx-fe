import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { summarizeEigenCacheStatus } from '@/lib/solana/eigenCache'
import type { Market } from '@/types/market'

interface MarketMetaPanelProps {
  market: Market
}

/**
 * Collapsible metadata panel (MARKET-05).
 * Default closed so it never dominates the page; opens on trigger click.
 *
 * Fields rendered reflect what's actually present on the current mock `Market`:
 *   - Checkpoint interval (seconds)
 *   - Total checkpoints
 *   - Entry fee (bps → %)
 *   - Pool (USDC)
 *   - LMSR coupling (lambda)
 *   - Decoherence rate
 *
 * Plan 02-05 listed "scoring weights" and "pool composition" conceptually;
 * the mock Market does not carry per-weight or per-token-pool breakdowns.
 * Those fields are deferred until the indexer lands.
 */
export function MarketMetaPanel({ market }: MarketMetaPanelProps) {
  const [open, setOpen] = useState(false)

  const intervalLabel = formatSeconds(market.checkpointInterval)
  const feePct = (market.entryFeeBps / 100).toFixed(2)

  return (
    <section className="border-line border-t">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="market-meta-panel-body"
        className={cn(
          'flex w-full items-center justify-between py-4',
          'text-ui font-mono tracking-wide uppercase',
          'text-ink-muted hover:text-ink-strong',
          'duration-short ease-levx transition-colors',
        )}
      >
        <span>Market details</span>
        <span aria-hidden className="text-ink-dim flex items-center justify-center">
          {open ? <Minus size={18} strokeWidth={1.75} /> : <Plus size={18} strokeWidth={1.75} />}
        </span>
      </button>
      {open && (
        <div
          id="market-meta-panel-body"
          className="border-line grid grid-cols-1 gap-0 border-t sm:grid-cols-2"
        >
          <MetaRow label="Checkpoint interval" value={intervalLabel} />
          <MetaRow label="Total checkpoints" value={String(market.totalCheckpoints)} />
          <MetaRow label="Entry fee" value={`${feePct}%`} />
          <MetaRow label="Pool" value={`${formatUSD(market.pool)} USDC`} />
          <MetaRow label="LMSR coupling" value={market.lambda.toFixed(3)} />
          {market.lambda > 0 && (
            <MetaRow
              label="EigenCache"
              value={summarizeEigenCacheStatus(market.eigenCacheStatus ?? 'disabled')}
            />
          )}
          <MetaRow label="Decoherence rate" value={market.decoherenceRate.toFixed(4)} />
        </div>
      )}
    </section>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line flex items-baseline justify-between gap-4 border-b px-1 py-3 last:border-b-0 sm:even:border-l sm:even:pl-4">
      <span className="text-ink-dim text-caption font-mono tracking-wide uppercase">{label}</span>
      <span className="text-ink-strong text-caption font-mono">{value}</span>
    </div>
  )
}

function formatSeconds(sec: number): string {
  if (sec >= 3600 && sec % 3600 === 0) return `${sec / 3600}h`
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60}m`
  return `${sec}s`
}
