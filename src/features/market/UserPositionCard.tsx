import { Button } from '@/ui/Button'
import { Label } from '@/ui/Label'
import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'
import type { MarketState, UserPosition } from '@/types/market'

interface UserPositionCardProps {
  position: UserPosition
  marketState: MarketState
}

const TONE_COLORS: Record<UserPosition['pathTone'], string> = {
  'ultra-bull': 'text-success',
  bull: 'text-success',
  neutral: 'text-ink-muted',
  bear: 'text-accent',
  'ultra-bear': 'text-accent',
  custom: 'text-[#5B9BF6]',
}

function actionForState(state: MarketState): { label: string; disabled: boolean } | null {
  switch (state) {
    case 'settled':
      return { label: 'Claim Payout', disabled: false }
    case 'void':
      return { label: 'Claim Refund', disabled: false }
    case 'maturing':
      return { label: 'Awaiting Settlement', disabled: true }
    default:
      return null
  }
}

export function UserPositionCard({ position, marketState }: UserPositionCardProps) {
  const action = actionForState(marketState)
  const pnl = position.estimatedPayout - position.collateral
  const pnlPositive = pnl >= 0
  const pnlLabel =
    marketState === 'settled' || marketState === 'void' ? 'Final P&L' : 'Estimated P&L'

  return (
    <div className="border-line border p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <Label>Your Position</Label>
        <span className={cn('font-mono text-xs uppercase', TONE_COLORS[position.pathTone])}>
          {position.pathLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-3 font-mono">
        <div>
          <div className="text-ink-dim text-caption uppercase">Collateral</div>
          <div className="text-ink-strong text-value">{formatUSD(position.collateral)}</div>
        </div>
        <div>
          <div className="text-ink-dim text-caption uppercase">Exposure</div>
          <div className="text-ink-strong text-value">
            {formatUSD(position.exposure)}
            {position.leverage > 1 && (
              <span className="text-ink-dim ml-1 text-caption">· {position.leverage}×</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-ink-dim text-caption uppercase">Entry Mult</div>
          <div className="text-ink-strong text-value">{position.entryMultiplier.toFixed(2)}×</div>
        </div>
        <div>
          <div className="text-ink-dim text-caption uppercase">{pnlLabel}</div>
          <div className={cn('text-value font-bold', pnlPositive ? 'text-success' : 'text-accent')}>
            {pnlPositive ? '+' : ''}
            {formatUSD(pnl)}
          </div>
        </div>
      </div>

      {position.dissolved && (
        <div className="text-accent mt-4 font-mono text-caption uppercase">
          Path Dissolved · Position Worthless
        </div>
      )}

      {action && (
        <Button
          variant="primary"
          fullWidth
          className="mt-5"
          disabled={action.disabled || position.claimed}
        >
          {position.claimed ? 'Claimed' : action.label}
        </Button>
      )}
    </div>
  )
}
