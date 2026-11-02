import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/cn'
import type { Mode2StatusTone } from '@/lib/mode2Status'
import { Label } from '@/ui/Label'
import { Mode2StatusBadge } from '@/ui/Mode2StatusBadge'
import { formatLeverage, formatSignedUsdc, formatUsdc } from './format'
import type { PathDirection } from './format'
import { Row } from './LeverageBreakdown'
import type { PathPosition, PositionStatus, PositionSummary } from './position'

type PathLabel = { name: string; direction: PathDirection }

interface Mode2PositionCardProps {
  summary: PositionSummary
  pathLabels: Record<number, PathLabel>
}

const CHIP_TONES: Record<PositionStatus, Mode2StatusTone> = {
  waiting: 'neutral',
  running: 'safe',
  'result-in': 'warning',
  paid: 'safe',
  voided: 'muted',
}

function chipText({ status, checkpoint, totalCheckpoints }: PositionSummary): string {
  switch (status) {
    case 'waiting':
      return 'Waiting for the start'
    case 'running':
      return `Running · checkpoint ${checkpoint} of ${totalCheckpoints}`
    case 'result-in':
      return 'Result in'
    case 'paid':
      return 'Paid'
    case 'voided':
      return 'Voided'
  }
}

/** The summary's label, its amount (with the change against the principal when `delta`) and a note. */
interface SummaryContent {
  label: string
  amount: bigint | null
  delta: boolean
  note: string | null
}

/** The estimate needs four observations (spec §6.3). */
const ESTIMATE_CHECKPOINT = 4

function summaryContent(summary: PositionSummary): SummaryContent {
  switch (summary.status) {
    case 'waiting':
    case 'running':
      // From checkpoint 4 the estimate itself belongs here; until it ships, no line.
      return {
        label: 'Principal',
        amount: summary.principal,
        delta: false,
        note: summary.checkpoint < ESTIMATE_CHECKPOINT ? 'Estimate from checkpoint 4' : null,
      }
    case 'result-in':
      return {
        label: 'Final result',
        amount: summary.finalPayout,
        delta: true,
        note: 'Paid to your wallet automatically after the review period',
      }
    case 'paid':
      return { label: 'Paid to your wallet', amount: summary.paid, delta: true, note: null }
    case 'voided':
      // The keeper refunds the open receipt and closes it; `paid` is set once it is closed.
      return {
        label:
          summary.paid === null ? 'Refund on its way to your wallet' : 'Refunded to your wallet',
        amount: summary.principal,
        delta: false,
        note: null,
      }
  }
}

const usdc = (micro: bigint): string => `${formatUsdc(micro)} USDC`

const changeTone = (change: bigint): string => (change < 0n ? 'text-accent' : 'text-success')

function Summary({ summary }: { summary: PositionSummary }) {
  const labelId = useId()
  const { label, amount, delta, note } = summaryContent(summary)
  const change = amount === null ? 0n : amount - summary.principal
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="border-line-strong bg-surface-1 mt-4 rounded-lg border p-3.5"
    >
      <Label id={labelId}>{label}</Label>
      {amount !== null && (
        <div className="mt-1 flex items-baseline gap-2 font-mono">
          <span className="text-ink-strong text-heading font-bold">{usdc(amount)}</span>
          {delta && <span className={changeTone(change)}>{formatSignedUsdc(change)}</span>}
        </div>
      )}
      {note !== null && <p className="text-ink-muted text-micro mt-1.5">{note}</p>}
    </div>
  )
}

/** The path's payout and its change once the result is in, else its principal and leverage. */
function PathHeadline({ path }: { path: PathPosition }) {
  if (path.finalPayout === null) {
    return (
      <span className="text-ink">
        {formatUsdc(path.principal)} at {formatLeverage(path.leverage)}
      </span>
    )
  }
  const change = path.finalPayout - path.principal
  return (
    <span className={changeTone(change)}>
      {formatUsdc(path.finalPayout)} ({formatSignedUsdc(change)})
    </span>
  )
}

function PathDetails({
  path,
  label,
  open,
}: {
  path: PathPosition
  label: PathLabel | undefined
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
          {label ? `${label.name} · ${label.direction}` : `Path ${path.pathIndex}`}
        </span>
        <span className="flex items-center gap-2 font-mono">
          <PathHeadline path={path} />
          <ChevronDown
            size={12}
            aria-hidden
            className="text-ink-dim duration-short ease-levx transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <dl className="border-line mb-2 border-l-2 pb-2.5 pl-3">
        <Row label="Leverage">{formatLeverage(path.leverage)}</Row>
        <Row label="Principal">{usdc(path.principal)}</Row>
        <Row label="Value with leverage" tone="strong">
          {usdc(path.valueWithLeverage)}
        </Row>
        <Row label="Max win" tone="win">
          {formatSignedUsdc(path.maxWin)} USDC
        </Row>
        <Row label="Fee (taken from the payout)">{usdc(path.fee)}</Row>
        <Row label="Max loss">{usdc(path.maxLoss)}</Row>
        {path.finalPayout !== null && (
          <Row label="Final result" tone="strong">
            {usdc(path.finalPayout)}
          </Row>
        )}
      </dl>
    </details>
  )
}

/**
 * The trader's leveraged positions after opening (spec §6.2): the status chip, the summary for that
 * status, and one dropdown per path (the first open).
 */
export function Mode2PositionCard({ summary, pathLabels }: Mode2PositionCardProps) {
  const headerId = useId()
  return (
    <section aria-labelledby={headerId} className="border-line border p-5">
      <div className="flex items-center justify-between gap-3">
        <Label id={headerId}>Leveraged positions</Label>
        <Mode2StatusBadge tone={CHIP_TONES[summary.status]}>{chipText(summary)}</Mode2StatusBadge>
      </div>
      <Summary summary={summary} />
      {summary.paths.length > 0 && (
        <div className="mt-3.5">
          {summary.paths.map((path, index) => (
            <PathDetails
              key={path.slot}
              path={path}
              label={pathLabels[path.pathIndex]}
              open={index === 0}
            />
          ))}
        </div>
      )}
    </section>
  )
}
