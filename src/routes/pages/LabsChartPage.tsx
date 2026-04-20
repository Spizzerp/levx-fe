import { useState } from 'react'

import { LevXChart } from '@/features/chart/LevXChart'
import { Stub } from '@/ui/Stub'
import { cn } from '@/lib/cn'
import { useMarket } from '@/lib/api/hooks'

const CHIP_BASE = cn(
  'cursor-pointer rounded-full border border-line-strong bg-transparent px-4 py-2.5',
  'font-mono text-label uppercase text-ink-muted',
  'transition-[color,border-color,background] duration-short ease-levx',
  'hover:border-ink hover:text-ink-strong',
)

const CHIP_ACTIVE =
  'border-ink-strong bg-ink-strong text-surface hover:border-ink-strong hover:text-surface'

/**
 * Sandbox for iterating on the chart component in isolation.
 * Loads a fixed mock market and exposes its paths as chip toggles.
 */
export function LabsChartPage() {
  const { data: market, isLoading } = useMarket('btc')
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  if (isLoading || !market) return <Stub title="Loading…" />

  const activeId = selectedPathId ?? market.paths[1]?.id ?? null

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col px-10 pt-14 pb-12">
      <div className="mb-8 flex items-baseline gap-6">
        <span className="text-ink-strong font-mono text-tag uppercase">
          LABS / CHART
        </span>
        <span className="text-ink-dim font-mono text-label tracking-normal uppercase">
          {market.pair} · visx rendering · history + prediction paths + crosshair
        </span>
      </div>

      <div className="mb-12 h-[560px] w-full">
        <LevXChart
          history={market.history}
          predictions={market.paths}
          nowTime={now}
          marketStart={market.startTime}
          marketEnd={market.endTime}
          selectedPathId={activeId}
        />
      </div>

      <div className="flex flex-col gap-4">
        <span className="text-ink-muted font-mono text-tag uppercase">
          SELECT A LINE
        </span>
        <div className="flex flex-wrap gap-2">
          {market.paths.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPathId(p.id)}
              className={cn(CHIP_BASE, activeId === p.id && CHIP_ACTIVE)}
            >
              [ {p.label.toUpperCase()} ]
            </button>
          ))}
          <button type="button" onClick={() => setSelectedPathId('')} className={CHIP_BASE}>
            [ CLEAR ]
          </button>
        </div>
      </div>
    </div>
  )
}
