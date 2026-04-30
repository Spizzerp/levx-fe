import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/ui/Button'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toastStore'
import { useUsdcBalance } from '@/lib/api/useUsdcBalance'
import { FaucetRateLimitError, requestTestUsdc } from '@/lib/supabase/faucet'
import { useWalletStore } from '@/stores/walletStore'

interface RequestUsdcButtonProps {
  className?: string
  /** Disable the button when the wallet's balance is already comfortable. */
  hideAboveBalance?: number
}

function formatRetryAfter(secs: number): string {
  if (secs >= 3600) return `${Math.ceil(secs / 3600)}h`
  if (secs >= 60) return `${Math.ceil(secs / 60)}m`
  return `${secs}s`
}

export function RequestUsdcButton({ className, hideAboveBalance = 100 }: RequestUsdcButtonProps) {
  const connected = useWalletStore((s) => s.connected)
  const { data: balance } = useUsdcBalance()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)

  if (!connected) return null
  if (balance && balance.balance >= hideAboveBalance) return null

  const handleClick = async () => {
    setPending(true)
    try {
      const result = await requestTestUsdc()
      toast.success(`Sent ${(Number(result.amount) / 1_000_000).toFixed(0)} test USDC`, {
        txSig: result.sig,
      })
      queryClient.invalidateQueries({ queryKey: ['usdcBalance'] })
    } catch (e) {
      if (e instanceof FaucetRateLimitError) {
        toast.error(`Faucet rate-limited`, {
          message: `Try again in ${formatRetryAfter(e.retryAfter)}.`,
        })
      } else {
        toast.error('Could not request test USDC', { message: (e as Error).message })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      disabled={pending}
      className={cn('text-micro min-h-0 h-8 px-3 py-1', className)}
    >
      {pending ? 'Requesting…' : 'Request test USDC'}
    </Button>
  )
}
