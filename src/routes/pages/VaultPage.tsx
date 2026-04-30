import { Lock } from 'lucide-react'

import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { cn } from '@/lib/cn'
import { PageLayout } from '@/layouts/PageLayout'

/**
 * Mode 2 (leveraged via levUSD vault) is not yet enabled on-chain.
 * The page renders as a preview with all metrics dimmed and the
 * deposit/withdraw form disabled. The earlier hardcoded VAULT_STATS
 * fixture was removed — showing fake TVL/APR/utilization numbers to
 * waitlist users would mislead them about what's live.
 */
export function VaultPage() {
  return (
    <PageLayout
      title="Vault"
      subtitle="levUSD LP dashboard — Provide liquidity, earn yield"
    >
      {/* Coming-soon banner */}
      <div className="border-line mb-12 flex flex-col items-center gap-3 border border-dashed p-8">
        <Lock size={24} strokeWidth={1.5} className="text-ink-dim" aria-hidden />
        <h2 className="text-ink-strong font-mono text-caption font-bold uppercase tracking-wide">
          Mode 2 — Coming soon
        </h2>
        <p className="text-ink-muted max-w-md text-center font-mono text-caption">
          The levUSD vault enables leveraged wagers via single-sided liquidity. The
          on-chain instructions ship in a future release; depositing isn't possible yet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-14 [@media(min-width:1181px)]:grid-cols-[1fr_400px]">
        {/* Placeholder stats — visually dimmed so it's clear they're not live. */}
        <section className="opacity-50">
          <div className="border-line mb-8 border-0 border-b pb-4">
            <h2 className="text-ink-strong font-mono text-caption font-bold tracking-wide uppercase">
              Vault Stats
            </h2>
          </div>
          <div className="flex flex-col gap-6">
            <PlaceholderRow label="TVL" />
            <PlaceholderRow label="Utilization" />
            <PlaceholderRow label="APR" />
            <PlaceholderRow label="Borrowed" />
            <PlaceholderRow label="Exchange Rate" />
          </div>
        </section>

        {/* Action panel — shape preserved so the layout doesn't reflow when
            Mode 2 ships, but every control is disabled. */}
        <aside className={cn('flex flex-col opacity-50')}>
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
            Coming soon
          </Button>
        </aside>
      </div>
    </PageLayout>
  )
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div className="border-line flex items-center justify-between border-0 border-b pb-6">
      <span className="text-label text-ink-muted font-mono uppercase">{label}</span>
      <span className="text-ink-dim font-mono text-sm tracking-snug">—</span>
    </div>
  )
}
