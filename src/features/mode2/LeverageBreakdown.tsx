import { useId } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/cn'
import type { BreakdownTotals, PathBreakdown } from './breakdown'
import { formatLeverage, formatSignedUsdc, formatUsdc } from './format'
import type { PathDirection } from './format'

interface LeverageBreakdownProps {
  marketLabel: string
  windowLabel: string
  rows: PathBreakdown[]
  pathLabels: Record<number, { name: string; direction: PathDirection }>
  /** The names of the selected paths the cohort does not hold. */
  unavailable: string[]
  totals: BreakdownTotals
}

type RowTone = 'plain' | 'strong' | 'win' | 'dim'

const TONE_CLASSES: Record<RowTone, string> = {
  plain: 'text-caption text-ink-strong',
  strong: 'text-ui font-bold text-ink-strong',
  win: 'text-ui font-bold text-success',
  dim: 'text-micro text-ink-muted',
}

/** A term and its value; the value is named by the term, so it reads as one row. */
function Row({
  label,
  tone = 'plain',
  children,
}: {
  label: string
  tone?: RowTone
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt id={id} className="text-ink-muted text-caption font-sans">
        {label}
      </dt>
      <dd aria-labelledby={id} className={cn('text-right font-mono', TONE_CLASSES[tone])}>
        {children}
      </dd>
    </div>
  )
}

const usdc = (micro: bigint): string => `${formatUsdc(micro)} USDC`

/** `10.00 at 2× + 10.00 at 3×`: each part's principal and its offer's leverage. */
function madeOf(row: PathBreakdown): string {
  const units = row.parts.reduce((sum, part) => sum + part.units, 0)
  const unit = row.principal / BigInt(units)
  return row.parts
    .map((part) => `${formatUsdc(unit * BigInt(part.units))} at ${part.leverage}×`)
    .join(' + ')
}

function PathDetails({
  row,
  label,
  open,
}: {
  row: PathBreakdown
  label: { name: string; direction: PathDirection }
  open: boolean
}) {
  const nameId = useId()
  return (
    <details
      open={open}
      aria-labelledby={nameId}
      className="group border-line border-t last-of-type:border-b"
    >
      <summary
        className={cn(
          'flex items-center justify-between gap-4',
          'py-2.5',
          'text-caption',
          'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
        )}
      >
        <span id={nameId} className="text-ink-strong font-semibold">
          {label.name} · {label.direction}
        </span>
        <span className="text-success flex items-center gap-2 font-mono">
          max win {formatSignedUsdc(row.maxWin)}
          <ChevronDown
            size={12}
            aria-hidden
            className="text-ink-dim duration-short ease-levx transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <dl className="border-line mb-2 border-l-2 pb-2.5 pl-3">
        <Row label="Leverage">{formatLeverage(row.leverage)}</Row>
        {row.parts.length > 1 && (
          <Row label="Made of" tone="dim">
            {madeOf(row)}
          </Row>
        )}
        <Row label="Principal">{usdc(row.principal)}</Row>
        <Row label="Value with leverage" tone="strong">
          {usdc(row.valueWithLeverage)}
        </Row>
        <Row label="Max win" tone="win">
          {formatSignedUsdc(row.maxWin)} USDC
        </Row>
        <Row label="Fee (taken from the payout)">{usdc(row.fee)}</Row>
        <Row label="Max loss">{usdc(row.maxLoss)}</Row>
      </dl>
    </details>
  )
}

/**
 * The order's breakdown: the market and its window, one dropdown per cohort path (the first open),
 * the selected paths leverage cannot take, and the totals.
 */
export function LeverageBreakdown({
  marketLabel,
  windowLabel,
  rows,
  pathLabels,
  unavailable,
  totals,
}: LeverageBreakdownProps) {
  return (
    <div className="border-line-strong bg-surface-1 mt-5 rounded-lg border px-3.5 py-3">
      <dl className="mb-1.5">
        <Row label="Market">{marketLabel}</Row>
        <Row label="Duration">{windowLabel}</Row>
      </dl>
      {rows.length > 0 && (
        <div>
          {rows.map((row, index) => (
            <PathDetails
              key={row.slot}
              row={row}
              label={pathLabels[row.pathIndex]}
              open={index === 0}
            />
          ))}
        </div>
      )}
      {unavailable.length > 0 && (
        <dl className="mt-1.5">
          <Row label="Not available with leverage" tone="dim">
            {unavailable.join(', ')}
          </Row>
        </dl>
      )}
      <dl className="mt-2.5">
        <Row label="Total principal">{usdc(totals.principal)}</Row>
        <Row label="Total value with leverage" tone="strong">
          {usdc(totals.valueWithLeverage)}
        </Row>
        <Row label="Total max win" tone="win">
          {formatSignedUsdc(totals.maxWin)} USDC
        </Row>
        <Row label="Total fee">{usdc(totals.fee)}</Row>
        <Row label="Total max loss">{usdc(totals.maxLoss)}</Row>
      </dl>
    </div>
  )
}
