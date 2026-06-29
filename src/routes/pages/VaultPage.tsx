import { Lock, ShieldCheck } from 'lucide-react'

import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { cn } from '@/lib/cn'
import { useMode2Readiness } from '@/lib/api/hooks'
import { formatAddress, formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'

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

  return (
    <PageLayout
      title="Vault"
      subtitle="Mode 2 readiness — dormant leverage and pair-risk sidecars"
    >
      <div className="border-line mb-10 flex flex-col items-center gap-3 border border-dashed p-8">
        <Lock size={24} strokeWidth={1.5} className="text-ink-dim" aria-hidden />
        <h2 className="text-ink-strong font-mono text-caption font-bold uppercase tracking-wide">
          Mode 2 dormant
        </h2>
        <p className="text-ink-muted max-w-md text-center font-mono text-caption">
          Leverage remains unavailable until governance config, simulator gates, monitoring, and
          audit scope are accepted.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-14 [@media(min-width:1181px)]:grid-cols-[1fr_400px]">
        <section>
          <div className="border-line mb-8 border-0 border-b pb-4">
            <h2 className="text-ink-strong font-mono text-caption font-bold tracking-wide uppercase">
              Dormant Config
            </h2>
          </div>
          <div className="flex flex-col gap-6">
            <MetricRow label="Config account" value={isLoading ? 'Loading' : config ? 'Present' : 'Missing'} />
            <MetricRow label="Config status" value={config?.status ?? '—'} />
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
            <MetricRow label="Max leverage" value={currentParams ? `${currentParams.maxLeverage}×` : '—'} />
            <MetricRow
              label="Activation delay"
              value={config ? formatDelay(config.activationDelaySeconds) : '—'}
            />
          </div>

          <div className="border-line mt-10 border-t pt-8">
            <h2 className="text-ink-strong mb-5 font-mono text-caption font-bold tracking-wide uppercase">
              Pair Risk
            </h2>
            {pairRiskStates.length === 0 ? (
              <p className="text-ink-dim font-mono text-caption uppercase">No pair sidecars found</p>
            ) : (
              <div className="flex flex-col gap-3">
                {pairRiskStates.slice(0, 6).map((state) => (
                  <div
                    key={state.address}
                    className={cn(
                      'border-line flex items-center justify-between',
                      'rounded-lg border px-4 py-3',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-ink-strong font-mono text-sm uppercase">
                        {formatAddress(state.baseMint)} / {formatAddress(state.quoteMint)}
                      </p>
                      <p className="text-ink-dim mt-1 font-mono text-xs uppercase">
                        {state.maxLeverage}× max · ${formatUSD(state.maxPairLeveragedOi)} OI
                      </p>
                    </div>
                    <span className="text-ink-muted font-mono text-xs uppercase">
                      {state.status}
                    </span>
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
              <span className="text-ink-strong font-mono text-label uppercase">Readiness</span>
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
                  'flex-1 border-b-2 border-transparent pb-4 font-mono text-label uppercase',
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
      <span className="text-ink-strong max-w-[220px] truncate text-right font-mono text-sm tracking-snug">
        {value}
      </span>
    </div>
  )
}

function GateRow({ label, ready, muted = false }: { label: string; ready: boolean; muted?: boolean }) {
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
