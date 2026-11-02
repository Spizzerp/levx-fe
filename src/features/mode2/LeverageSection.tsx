import { ConnectGate } from '@/features/wallet/ConnectGate'
import { RequestUsdcButton } from '@/features/wallet/RequestUsdcButton'
import { UsdcBalance } from '@/features/wallet/UsdcBalance'
import { useUsdcBalance } from '@/lib/api/useUsdcBalance'
import { cn } from '@/lib/cn'
import type { Market, PredictionPath } from '@/types/market'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { Label } from '@/ui/Label'
import { SegmentedSlider } from '@/ui/SegmentedSlider'
import { positionCount } from './admission'
import { ADMIT_FEE_LAMPORTS, useOpenMode2Positions, useWalletFunds } from './api'
import { CLOSE_MARGIN_MS, entryState } from './entryWindow'
import {
  formatCountdownShort,
  formatLeverage,
  formatMarketSpan,
  formatMarketWindow,
  pathLabelsOf,
} from './format'
import { LeverageBreakdown } from './LeverageBreakdown'
import type { Mode2Forecasts, Mode2MarketView } from './types'
import { useLeverageOrder } from './useLeverageOrder'

interface LeverageSectionProps {
  market: Market
  view: Mode2MarketView
  forecasts: Mode2Forecasts | null
  selectedPaths: PredictionPath[]
  nowMs: number
}

const MICRO_PER_USDC = 1_000_000

/**
 * The trade panel's leverage section (spec §4.1–§4.5): the entry window, the 0.1-step slider, the
 * principal, the per-path breakdown and the button that opens the positions.
 */
export function LeverageSection({
  market,
  view,
  forecasts,
  selectedPaths,
  nowMs,
}: LeverageSectionProps) {
  const { data: balance } = useUsdcBalance()
  const { lamports, rentLamports } = useWalletFunds()
  const openPositions = useOpenMode2Positions()
  const order = useLeverageOrder(
    view,
    forecasts,
    selectedPaths,
    {
      // Rounded down: never more than the wallet holds.
      usdcMicro: balance ? BigInt(Math.floor(balance.balance * MICRO_PER_USDC)) : null,
      // Without the rent the SOL needed is unknown; the program checks it.
      lamports: rentLamports === null ? null : lamports,
      rentLamports: rentLamports ?? 0,
      feeLamports: ADMIT_FEE_LAMPORTS,
    },
    nowMs,
    market.state,
  )
  const entry = entryState(view, market.state, nowMs)
  const { values, precheck } = order
  const leverageText = formatLeverage(order.leverage)
  const positions = positionCount(order.orders)
  const buttonLabel =
    positions > 1
      ? `Open ${positions} Positions at ${leverageText}`
      : `Open Position at ${leverageText}`
  // One breakdown row per cohort path; a selected path outside the cohort takes no principal.
  const principalLabel = order.rows.length > 1 ? 'Principal per path' : 'Principal'

  return (
    <div>
      {entry.kind === 'open' && (
        <div
          className={cn(
            'flex items-baseline justify-between',
            'px-3 py-2.5',
            'border-success-dim/50 rounded-md border',
            'bg-success/5',
          )}
        >
          <Label className="text-success">Leverage open</Label>
          <span className="text-ink text-caption font-mono">
            closes in{' '}
            <b className="text-success">
              {formatCountdownShort(entry.closesAtMs - CLOSE_MARGIN_MS - nowMs)}
            </b>
          </span>
        </div>
      )}

      {values.length > 0 && (
        <div className="mt-6 mb-8">
          <div className="mb-3.5 flex items-baseline justify-between">
            <Label>Leverage</Label>
            <span className="text-ink-strong text-body-sm font-mono font-bold">{leverageText}</span>
          </div>
          <SegmentedSlider
            value={order.leverage}
            min={values[0]}
            max={values[values.length - 1]}
            values={values}
            disabledValues={order.disabledValues}
            onChange={order.setLeverage}
            formatAriaValue={formatLeverage}
          />
          <div className="text-ink-dim text-caption mt-2.5 flex justify-between font-mono uppercase">
            <span>{values[0]}×</span>
            <span>
              {values[values.length - 1]}× max ·{' '}
              {formatMarketSpan(market.startTime, market.endTime)}
            </span>
          </div>
          {order.disabledReason !== null && (
            <p className="text-warning text-caption mt-2.5 font-mono">{order.disabledReason}</p>
          )}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between gap-3">
        <UsdcBalance />
        <RequestUsdcButton />
      </div>

      <Input
        label={principalLabel}
        value={order.principalText}
        onChange={(e) => order.setPrincipalText(e.target.value)}
        onBlur={order.commitPrincipal}
        unit="USDC"
        inputMode="decimal"
        borderless
      />
      <p className="text-ink-muted text-caption font-mono">In steps of 10 USDC</p>

      <LeverageBreakdown
        marketLabel={market.pair}
        windowLabel={formatMarketWindow(market.startTime, market.endTime)}
        rows={order.rows}
        pathLabels={pathLabelsOf(selectedPaths)}
        unavailable={order.unavailable.map((path) => path.label)}
        totals={order.totals}
      />

      {view.receipt === null && (
        <p className="text-ink-muted text-caption mt-3 font-mono">
          A small SOL deposit opens your position record; it comes back when you are paid
        </p>
      )}

      <ConnectGate>
        <Button
          variant="primary"
          fullWidth
          className="mt-5"
          disabled={!precheck.ok || openPositions.isPending}
          onClick={() =>
            openPositions.mutate({ view, orders: order.orders, leverage: order.leverage })
          }
        >
          {openPositions.isPending ? 'Confirming…' : buttonLabel}
        </Button>
      </ConnectGate>
      {/* The slider already names a reason it shows. */}
      {!precheck.ok && precheck.message !== order.disabledReason && (
        <p className="text-warning text-caption mt-2 font-mono">{precheck.message}</p>
      )}
    </div>
  )
}
