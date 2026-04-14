import { Button } from '@/components/Button'

interface QueryErrorStateProps {
  title?: string
  message?: string
  onRetry: () => void
}

/**
 * Reusable error + retry treatment for TanStack Query failures.
 *
 * Consumed by MarketsPage (Plan 02-04) and MarketPage (Plan 02-05).
 * Tone: calm, not alarming — matches the Nothing aesthetic.
 */
export function QueryErrorState({
  title = 'Something went wrong',
  message = 'We could not load this view. Please try again.',
  onRetry,
}: QueryErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-line flex flex-col items-center justify-center gap-4 border border-dashed px-8 py-24 text-center"
    >
      <p className="text-ink-strong font-mono text-sm tracking-wide uppercase">
        {title}
      </p>
      <p className="text-ink-muted font-mono text-label tracking-wide uppercase">
        {message}
      </p>
      <Button variant="secondary" type="button" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
