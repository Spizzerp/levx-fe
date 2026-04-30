import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/ui/Button'
import { ConnectGate } from '@/features/wallet/ConnectGate'
import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import { useUserPosition } from '@/lib/chain'
import { useClaim } from '@/lib/solana/transactions'
import type { Market } from '@/types/market'

interface VoidMarketPanelProps {
  market: Market
  className?: string
}

/**
 * Surfaced when a market has been voided (oracle failure, governance
 * emergency, etc.). The protocol's `claim` instruction returns the
 * user's full collateral as a refund — same on-chain path as a winning
 * Settled claim, just with a different payout calculation.
 *
 * Only renders the Reclaim button when the user has a position; the
 * void notice itself shows for all viewers.
 */
export function VoidMarketPanel({ market, className }: VoidMarketPanelProps) {
  const { data: position } = useUserPosition(market.id)
  const claim = useClaim()
  const [pending, setPending] = useState(false)

  const handleReclaim = () => {
    if (!position) return
    setPending(true)
    claim.mutate(
      { marketId: position.marketIdNum, pathIndex: position.pathIndex },
      { onSettled: () => setPending(false) },
    )
  }

  return (
    <div className={cn('border-accent flex flex-col gap-4 border p-5', className)}>
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} strokeWidth={1.75} className="text-accent" aria-hidden />
        <span className="text-ink-strong font-mono text-caption uppercase tracking-wide">
          Market voided
        </span>
      </div>
      <p className="text-ink-muted font-mono text-caption">
        This market was voided before settlement (typically oracle gaps or governance
        emergency). Your collateral is refundable. Entry fees are not refunded — those
        were paid to the protocol when you placed the wager.
      </p>

      {position && !position.claimed && (
        <ConnectGate>
          <Button
            variant="primary"
            fullWidth
            onClick={handleReclaim}
            disabled={pending || claim.isPending}
          >
            {pending ? 'Reclaiming…' : `Reclaim ${formatUSD(position.collateral)} USDC`}
          </Button>
        </ConnectGate>
      )}
      {position?.claimed && (
        <span className="text-ink-dim font-mono text-caption uppercase">
          Refund already claimed.
        </span>
      )}
    </div>
  )
}
