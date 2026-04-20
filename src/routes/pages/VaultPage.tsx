import { useState } from 'react'

import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'

const VAULT_STATS = {
  tvl: 2_450_000,
  utilization: 68.4,
  apr: 12.7,
  borrowed: 1_675_800,
  feesEarned: 34_120,
  exchangeRate: 1.0247,
}

type VaultAction = 'deposit' | 'withdraw'

export function VaultPage() {
  const [action, setAction] = useState<VaultAction>('deposit')
  const [amount, setAmount] = useState('')

  const isDeposit = action === 'deposit'

  return (
    <PageLayout
      title="Vault"
      subtitle="levUSD LP dashboard — Provide liquidity, earn yield"
      summaryBar={
        <div className="border-line flex items-center gap-12 border-0 border-b pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              TVL
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {formatUSD(VAULT_STATS.tvl)}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Utilization
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {VAULT_STATS.utilization}%
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              APR
            </div>
            <div className="text-success font-mono text-3xl font-bold tracking-[0.02em]">
              {VAULT_STATS.apr}%
            </div>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-14 [@media(min-width:1181px)]:grid-cols-[1fr_400px]">
        {/* Stats section */}
        <section>
          <div className="border-line mb-8 border-0 border-b pb-4">
            <h2 className="text-ink-strong font-mono text-caption font-bold tracking-wide uppercase">
              Vault Stats
            </h2>
          </div>

          <div className="flex flex-col gap-6">
            <div className="border-line flex items-center justify-between border-0 border-b pb-6">
              <span className="text-label text-ink-muted font-mono uppercase">Borrowed</span>
              <span className="text-ink-strong font-mono text-sm font-bold tracking-snug">
                {formatUSD(VAULT_STATS.borrowed)} USDC
              </span>
            </div>
            <div className="border-line flex items-center justify-between border-0 border-b pb-6">
              <span className="text-label text-ink-muted font-mono uppercase">Fees Earned</span>
              <span className="text-success font-mono text-sm font-bold tracking-snug">
                +{formatUSD(VAULT_STATS.feesEarned)} USDC
              </span>
            </div>
            <div className="border-line flex items-center justify-between border-0 border-b pb-6">
              <span className="text-label text-ink-muted font-mono uppercase">Exchange Rate</span>
              <span className="text-ink-strong font-mono text-sm font-bold tracking-snug">
                1 levUSD = {VAULT_STATS.exchangeRate.toFixed(4)} USDC
              </span>
            </div>
          </div>
        </section>

        {/* Action panel */}
        <aside className="flex flex-col">
          <div className="border-line mb-8 flex gap-0 border-0 border-b">
            {(['deposit', 'withdraw'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAction(tab)}
                className={cn(
                  'flex-1 border-b-2 pb-4 font-mono text-label uppercase',
                  'duration-short ease-levx transition-[color,border-color]',
                  action === tab
                    ? 'border-ink-strong text-ink-strong'
                    : 'border-transparent text-ink-dim hover:text-ink-muted',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <Input
            label={isDeposit ? 'Deposit Amount' : 'Withdraw Amount'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            unit={isDeposit ? 'USDC' : 'levUSD'}
            inputMode="decimal"
            className="mb-8"
          />

          {isDeposit ? (
            <div className="mb-8 flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-caption text-ink-dim font-mono uppercase">You receive</span>
                <span className="text-ink font-mono text-sm tracking-snug">
                  {amount ? formatUSD(Number(amount) / VAULT_STATS.exchangeRate) : '0.00'} levUSD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-ink-dim font-mono uppercase">Exchange rate</span>
                <span className="text-ink font-mono text-sm tracking-snug">
                  1 USDC = {(1 / VAULT_STATS.exchangeRate).toFixed(4)} levUSD
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-8 flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-caption text-ink-dim font-mono uppercase">You receive</span>
                <span className="text-ink font-mono text-sm tracking-snug">
                  {amount ? formatUSD(Number(amount) * VAULT_STATS.exchangeRate) : '0.00'} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-ink-dim font-mono uppercase">Exchange rate</span>
                <span className="text-ink font-mono text-sm tracking-snug">
                  1 levUSD = {VAULT_STATS.exchangeRate.toFixed(4)} USDC
                </span>
              </div>
            </div>
          )}

          <Button variant="primary" fullWidth>
            {isDeposit ? 'Deposit USDC' : 'Withdraw levUSD'}
          </Button>
        </aside>
      </div>
    </PageLayout>
  )
}
