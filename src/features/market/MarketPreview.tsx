import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { Label } from '@/ui/Label'
import { SegmentedSlider } from '@/ui/SegmentedSlider'
import { StatusDot } from '@/ui/StatusDot'
import { ChartFrame } from '@/features/chart/ChartFrame'
import { LevXChart } from '@/features/chart/LevXChart'
import { TimeRangePicker, type CandleInterval } from '@/features/chart/TimeRangePicker'
import { PathRow } from '@/features/market/PathRow'
import { cn } from '@/lib/cn'
import {
  formatCountdown,
  formatDeltaBps,
  formatUSD,
  maxLeverageByDuration,
} from '@/lib/format'
import type { PredictionPath, PricePoint } from '@/types/market'

const META_SEP = <span className="text-line-strong mx-0.5">·</span>

interface MockComment {
  id: string
  /** Raw wallet address — shown (shortened) when there's no profile. */
  wallet: string
  /** If present, the comment shows avatar + username instead of the wallet. */
  profile?: {
    username: string
    avatarUrl: string
  }
  when: string
  body: string
}

const MOCK_COMMENTS: MockComment[] = [
  {
    id: 'c-1',
    wallet: '7Fx4K9vN3mPqR2sWxY8zB4jKpN9vMxT3LrQ5zJ9N2',
    profile: {
      username: 'cryptomaxi',
      avatarUrl: 'https://avatars.githubusercontent.com/u/100727247?v=4',
    },
    when: '3h ago',
    body: 'GJR-GARCH looking strong here — volatility pickup clearly priced in.',
  },
  {
    id: 'c-2',
    wallet: '9AbqR2Wxj7fN4pK3mMxT8zB4jKpN9vMxT3LrQ5zMn8',
    profile: {
      username: 'volbolt',
      avatarUrl: 'https://avatars.githubusercontent.com/u/113235023?v=4',
    },
    when: '5h ago',
    body: "Merton-JD's tail scenarios feel more realistic given the macro setup. Loading the dip.",
  },
  {
    id: 'c-3',
    wallet: '3QrxY2tW8j7fN4pK3mMxT8zB4jKpN9vMxT3LrQ5xY3',
    when: '8h ago',
    body: 'Entered a 10x position on Chronos-2 early this morning. Trend is your friend.',
  },
]

function shortWallet(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`
}

interface MarketPreviewProps {
  /** "BTC/USDC" — rendered with a space separator in the header. */
  pair: string
  history: PricePoint[]
  predictions: PredictionPath[]
  now: number
  marketStart: number
  marketEnd: number
  checkpointInterval: number
  totalCheckpoints: number
  /** Meta-strip display values. Defaults to plausible mock numbers. */
  pool?: number
  traders?: number
  checkpointsCompleted?: number
  entryFeeBps?: number
  /** Chart canvas height in px. */
  chartHeight?: number
  /** Wired to both the in-rail submit button and any wallet prompts. */
  onCtaClick?: () => void
}

/**
 * Static visual clone of MarketPage — same layout, same tokens, same child
 * components — intended for the landing page hero. All interactive state
 * (selected paths, leverage, collateral, time range) is local and inert; no
 * wallet, Pyth feed, Supabase, or on-chain transactions are touched.
 *
 * Wrap in a container (border/padding) at the call-site.
 */
export function MarketPreview({
  pair,
  history,
  predictions,
  now,
  marketStart,
  marketEnd,
  checkpointInterval,
  totalCheckpoints,
  pool = 248_901,
  traders = 1204,
  checkpointsCompleted = 48,
  entryFeeBps = 100,
  chartHeight = 420,
  onCtaClick,
}: MarketPreviewProps) {
  const [candleInterval, setCandleInterval] = useState<CandleInterval>('1h')
  const [selectedPathIds, setSelectedPathIds] = useState<Set<string>>(new Set())
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null)
  const [leverage, setLeverage] = useState(12)
  const [collateral, setCollateral] = useState('25.00')

  // Duration-derived cap — keeps the preview consistent with the on-chain
  // program's rules (e.g. 20× max on a 7-day market).
  const durationMs = Math.max(0, marketEnd - marketStart)
  const maxLeverage = maxLeverageByDuration(durationMs)

  const latestPrice = history[history.length - 1]?.value ?? 0
  // Approx "24h ago" using the mock series — history is hourly, so 25 points back.
  const dayAgoPrice = history[Math.max(0, history.length - 25)]?.value ?? latestPrice
  const deltaBps = dayAgoPrice > 0 ? ((latestPrice - dayAgoPrice) / dayAgoPrice) * 10_000 : 0
  const deltaColor = deltaBps >= 0 ? 'text-success' : 'text-accent'

  const numWagerable = selectedPathIds.size
  const msRemaining = Math.max(0, marketEnd - now)
  const ctaLabel =
    numWagerable === 0
      ? 'Join Waitlist'
      : numWagerable === 1
        ? 'Open Position'
        : `Open ${numWagerable} Positions`

  return (
    <div
      className={cn(
        'grid grid-cols-1 items-start gap-10',
        // minmax(0,1fr) prevents the left track from expanding past its share
        // when a descendant (LevXChart via visx ParentSize) reports a large
        // intrinsic min-width — without this, the right rail overflows the
        // container on narrower page widths.
        '[@media(min-width:1181px)]:grid-cols-[minmax(0,1fr)_320px] [@media(min-width:1181px)]:gap-10',
      )}
    >
      {/* ── Chart column ─────────────────────────────────────────── */}
      <section>
        {/* Pair identifier + price are wrapped together so the landing's
            TourStop layout measurement can frame the whole "market header"
            as a single target (see data-tour usage in LandingPage). The
            wrapper stays a plain full-width block — the landing trims
            trailing whitespace on the right via `boxAdjust` in the tour
            config, rather than shrinking the wrapper with `w-fit`, to
            avoid altering the dashboard's intrinsic flow. */}
        <div data-tour="price">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-ink-muted font-mono text-xs tracking-widest uppercase">
              {pair.replace('/', ' / ')}
            </span>
            <StatusDot status="active">Active</StatusDot>
          </div>

          {/* Price + 24H delta on the same row, baseline-aligned so the smaller
              caption text hangs off the bottom of the display numerals. */}
          <div className="my-1.5 mb-2.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <h1 className="font-display text-ink-strong text-display-lg leading-none font-medium tracking-tighter [font-variation-settings:'ROND'_100]">
              {formatUSD(latestPrice)}
            </h1>
            <div className="text-ink-muted text-caption flex items-baseline gap-3 font-mono">
              <span className={cn('font-bold', deltaColor)}>{formatDeltaBps(deltaBps)}</span>
              <span>24H</span>
            </div>
          </div>
        </div>

        {/* Meta strip — single row at nano (10px) font size with tight gaps,
            fits inside the shrunk container without wrapping. */}
        <div className="text-ink-dim text-nano mt-6 flex flex-nowrap items-center gap-x-1.5 font-mono tracking-normal whitespace-nowrap uppercase">
          <span>
            MARKET ENDS <span className="text-ink-muted ml-1">{formatCountdown(msRemaining)}</span>
          </span>
          {META_SEP}
          <span>
            POOL <span className="text-ink-muted ml-1">{formatUSD(pool)} USDC</span>
          </span>
          {META_SEP}
          <span>
            CHECKPOINTS{' '}
            <span className="text-ink-muted ml-1">
              {checkpointsCompleted} / {totalCheckpoints}
            </span>
          </span>
          {META_SEP}
          <span>
            TRADERS <span className="text-ink-muted ml-1">{traders.toLocaleString()}</span>
          </span>
          {META_SEP}
          <span>
            ENTRY FEE{' '}
            <span className="text-ink-muted ml-1">{(entryFeeBps / 100).toFixed(1)}%</span>
          </span>
        </div>

        <ChartFrame data-tour="paths" glow className="pointer-events-none mt-6 select-none">
          {/* pair={null} on the chart itself disables LevXChart's Pyth
              subscription so the mock series doesn't get spliced with the
              real live tick (which would otherwise draw a vertical spike
              from ~$61K mock end to the real ~$75K BTC price). */}
          <LevXChart
            height={chartHeight}
            history={history}
            predictions={predictions}
            nowTime={now}
            marketStart={marketStart}
            marketEnd={marketEnd}
            pair={null}
            selectedPathId={hoveredPathId}
            selectedPathIds={selectedPathIds}
            // true = hovered + selected paths paint as solid white overlays
            // (same treatment as MarketPage when the wager rail is active).
            selectionInteractive={true}
            market={{
              startTime: marketStart,
              checkpointInterval,
              totalCheckpoints,
            }}
          />
        </ChartFrame>

        <div className="mt-4">
          {/* Smaller pills than the default MarketPage treatment — scoped to
              the landing preview via className descendant variants so the
              shared TimeRangePicker component stays unchanged elsewhere. */}
          <TimeRangePicker
            value={candleInterval}
            onChange={setCandleInterval}
            className="gap-1 text-[10px] [&>button]:px-2 [&>button]:py-0.5"
          />
        </div>

        {/* Static comments panel — visual clone of MarketComments'
            disconnected state. Mock entries are module-level constants so
            the list is deterministic across renders. */}
        <section className="mt-8 flex flex-col gap-4">
          <h3 className="text-body font-mono tracking-wide uppercase">Comments</h3>

          <ul className="flex flex-col gap-4">
            {MOCK_COMMENTS.map((c) => (
              <li key={c.id}>
                <div className="text-caption text-ink-muted flex items-center gap-2">
                  {c.profile ? (
                    <span className="flex items-center gap-2">
                      <img
                        src={c.profile.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        className="border-line-strong h-5 w-5 rounded-full border object-cover"
                      />
                      <span className="text-ink-strong font-mono">{c.profile.username}</span>
                    </span>
                  ) : (
                    <span className="font-mono">{shortWallet(c.wallet)}</span>
                  )}
                  <span>{c.when}</span>
                </div>
                <p className="text-ink whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* ── Right rail ───────────────────────────────────────────── */}
      {/* Offset pushes the rail's "Select Provider" label down to sit flush
          with the top of the chart container (pair row + price/delta row +
          meta strip + ChartFrame's mt-6 on the left column). */}
      <aside className="flex flex-col [@media(min-width:1181px)]:mt-[130px]">
        <Label>Select Provider</Label>

        <div data-tour="providers" className="border-line mt-5 border-0 border-t">
          {predictions.map((p, idx) => (
            <PathRow
              key={p.id}
              index={idx + 1}
              name={p.label}
              multiplier={`${p.multiplier.toFixed(2)}×`}
              wagered={p.totalWagered}
              active={selectedPathIds.has(p.id)}
              onMouseEnter={() => setHoveredPathId(p.id)}
              onMouseLeave={() => setHoveredPathId(null)}
              onClick={() =>
                setSelectedPathIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(p.id)) next.delete(p.id)
                  else next.add(p.id)
                  return next
                })
              }
            />
          ))}
        </div>

        <Button
          data-tour="drawPath"
          variant="dashed"
          fullWidth
          className="mt-5 gap-2"
          type="button"
        >
          <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
          Draw Custom Path
        </Button>

        <div data-tour="leverage" className="mt-8 mb-8">
          <div className="mb-3.5 flex items-baseline justify-between">
            <Label>Leverage</Label>
            <span className="text-ink-strong text-body-sm font-mono font-bold">
              {Math.min(leverage, maxLeverage)}×
            </span>
          </div>
          <SegmentedSlider
            value={Math.min(leverage, maxLeverage)}
            max={maxLeverage}
            onChange={setLeverage}
          />
          <div className="text-ink-dim text-caption mt-2.5 flex justify-between font-mono uppercase">
            <span>1×</span>
            <span>{maxLeverage}× MAX</span>
          </div>
        </div>

        <Input
          label="Collateral"
          value={collateral}
          onChange={(e) => setCollateral(e.target.value)}
          unit="USDC"
          inputMode="decimal"
          className="mb-8"
        />
        {numWagerable > 1 && (
          <p className="text-ink-muted text-caption -mt-6 mb-6 font-mono">
            Total: {formatUSD((parseFloat(collateral) || 0) * numWagerable)} USDC across{' '}
            {numWagerable} paths
          </p>
        )}

        <Button
          variant="primary"
          fullWidth
          className="mt-2"
          onClick={onCtaClick}
        >
          {ctaLabel}
        </Button>
      </aside>
    </div>
  )
}
