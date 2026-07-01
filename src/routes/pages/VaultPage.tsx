import { Lock, ShieldCheck } from 'lucide-react'

import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { TokenPairIcon } from '@/ui/TokenPairIcon'
import { cn } from '@/lib/cn'
import { useMode2Readiness } from '@/lib/api/hooks'
import { resolveBaseMintLabel } from '@/lib/api/pairLabels'
import { formatAddress, formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'
import type { PairRiskStatus } from '@/types/market'

/**
 * Mode 2 (leveraged via levUSD vault) is not yet enabled on-chain.
 * This page may show dormant sidecar config, but deposit/withdraw
 * and market leverage controls remain unavailable.
 */
export function VaultPage() {
  const { data: readiness, isLoading } = useMode2Readiness()
  const config = readiness?.leverageConfig ?? null
  const currentParams = config?.currentParams ?? null
  const pairRiskStates = readiness?.pairRiskStates ?? []
  const simulatorHashReady =
    !!config?.simulatorOutputHash && !/^0+$/.test(config.simulatorOutputHash)
  const statusSummary = config
    ? `${formatStatusLabel(config.status)} config · ${pairRiskStates.length} pair${pairRiskStates.length === 1 ? '' : 's'}`
    : 'No leverage config'

  return (
    <PageLayout title="Vault" subtitle="Mode 2 readiness — dormant leverage and pair-risk sidecars">
      <div
        className={cn(
          'border-line from-surface-1 to-surface-2 mb-10 overflow-hidden rounded-[24px] border bg-gradient-to-b p-8',
          'relative',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--ink-strong) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        />
        <div className="relative flex flex-col gap-4 [@media(min-width:900px)]:flex-row [@media(min-width:900px)]:items-center [@media(min-width:900px)]:justify-between">
          <div className="flex items-start gap-4">
            <div className="border-line bg-surface/50 flex h-11 w-11 items-center justify-center rounded-full border">
              <Lock size={20} strokeWidth={1.5} className="text-ink-dim" aria-hidden />
            </div>
            <div>
              <h2 className="text-ink-strong text-caption font-mono font-bold tracking-wide uppercase">
                Leverage unavailable
              </h2>
              <p className="text-ink-muted mt-2 max-w-2xl font-mono text-sm leading-relaxed">
                Mode 2 sidecars are visible for review, but trader leverage, LP deposits,
                liquidations, and leveraged claims remain disabled until governance activates the
                protocol flag.
              </p>
            </div>
          </div>
          <span
            className={cn(
              'border-line-strong w-fit rounded-full border px-3 py-1.5',
              'text-ink-muted font-mono text-[10px] font-bold tracking-wide uppercase',
            )}
          >
            {statusSummary}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-14 [@media(min-width:1181px)]:grid-cols-[1fr_400px]">
        <section>
          <div className="border-line mb-8 border-0 border-b pb-4">
            <h2 className="text-ink-strong text-caption font-mono font-bold tracking-wide uppercase">
              Dormant Config
            </h2>
          </div>
          <div className="flex flex-col gap-6">
            <MetricRow
              label="Config account"
              value={isLoading ? 'Loading' : config ? 'Present' : 'Missing'}
            />
            <MetricRow
              label="Config status"
              value={config ? formatStatusLabel(config.status) : '—'}
            />
            <MetricRow
              label="Simulator hash"
              value={config ? formatHash(config.simulatorOutputHash) : '—'}
            />
            <MetricRow
              label="Max pair OI"
              value={currentParams ? `$${formatUSD(currentParams.maxPairLeveragedOi)}` : '—'}
            />
            <MetricRow
              label="Max market OI"
              value={currentParams ? `$${formatUSD(currentParams.maxMarketLeveragedOi)}` : '—'}
            />
            <MetricRow
              label="Max leverage"
              value={currentParams ? `${currentParams.maxLeverage}×` : '—'}
            />
            <MetricRow
              label="Activation delay"
              value={config ? formatDelay(config.activationDelaySeconds) : '—'}
            />
          </div>

          <div className="border-line mt-10 border-t pt-8">
            <h2 className="text-ink-strong text-caption mb-5 font-mono font-bold tracking-wide uppercase">
              Pair Risk
            </h2>
            {pairRiskStates.length === 0 ? (
              <p className="text-ink-dim text-caption font-mono uppercase">
                No pair sidecars found
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {pairRiskStates.slice(0, 6).map((state) => (
                  <div
                    key={state.address}
                    className={cn(
                      'border-line flex items-center justify-between gap-4',
                      'rounded-lg border px-4 py-3',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <TokenPairIcon
                        base={resolveBaseMintLabel(state.baseMint).base}
                        quote={resolveBaseMintLabel(state.baseMint).quote}
                        size={28}
                      />
                      <div className="min-w-0">
                        <p className="text-ink-strong font-mono text-sm uppercase">
                          {resolveBaseMintLabel(state.baseMint).pair}
                        </p>
                        <p className="text-ink-dim mt-1 font-mono text-xs uppercase">
                          {state.maxLeverage}× max · ${formatUSD(state.maxPairLeveragedOi)} OI
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <PairRiskBadge status={state.status} />
                      <p className="text-ink-strong font-mono text-sm uppercase">
                        {formatAddress(state.baseMint)} / {formatAddress(state.quoteMint)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col">
          <div className="border-line mb-8 rounded-lg border p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck size={15} strokeWidth={1.75} className="text-ink-muted" />
              <span className="text-ink-strong text-label font-mono uppercase">Readiness</span>
            </div>
            <div className="flex flex-col gap-3">
              <GateRow label="Mechanism spec" ready />
              <GateRow label="Sidecar config" ready={!!config} />
              <GateRow label="Simulator hash" ready={simulatorHashReady} />
              <GateRow label="Pair risk state" ready={pairRiskStates.length > 0} />
              <GateRow label="Activation flag" ready={false} muted />
            </div>
          </div>

          <div className="border-line mb-8 flex gap-0 border-0 border-b">
            {(['deposit', 'withdraw'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                disabled
                className={cn(
                  'text-label flex-1 border-b-2 border-transparent pb-4 font-mono uppercase',
                  'text-ink-dim cursor-not-allowed',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <Input
            label="Deposit Amount"
            value=""
            onChange={() => undefined}
            unit="USDC"
            inputMode="decimal"
            className="mb-8"
            disabled
          />
          <Button variant="primary" fullWidth disabled>
            Disabled
          </Button>
        </aside>
      </div>
    </PageLayout>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line flex items-center justify-between border-0 border-b pb-6">
      <span className="text-label text-ink-muted font-mono uppercase">{label}</span>
      <span className="text-ink-strong tracking-snug max-w-[220px] truncate text-right font-mono text-sm">
        {value}
      </span>
    </div>
  )
}

function GateRow({
  label,
  ready,
  muted = false,
}: {
  label: string
  ready: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-muted font-mono text-xs uppercase">{label}</span>
      <span
        className={cn(
          'font-mono text-xs uppercase',
          muted ? 'text-ink-dim' : ready ? 'text-success' : 'text-warning',
        )}
      >
        {ready ? 'Ready' : 'Blocked'}
      </span>
    </div>
  )
}

function PairRiskBadge({ status }: { status: PairRiskStatus }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide uppercase',
        status === 'active' && 'border-success/40 bg-success/10 text-success',
        status === 'drainOnly' && 'border-line-strong bg-surface text-ink-muted',
        (status === 'paused' || status === 'resetPending') &&
          'border-warning/40 bg-warning/10 text-warning',
      )}
    >
      {formatStatusLabel(status)}
    </span>
  )
}

function formatStatusLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function formatHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`
}

function formatDelay(seconds: number): string {
  if (seconds === 0) return '0s'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}
