import { useState, type FormEvent } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

import { useComments, usePostComment, useSupabaseAuth } from '@/lib/supabase/hooks'
import { useWalletStore } from '@/stores/walletStore'
import { Button } from '@/ui/Button'
import { cn } from '@/lib/cn'

type Props = { marketId: string }

export function MarketComments({ marketId }: Props) {
  const connected = useWalletStore((s) => s.connected)
  const walletPubkey = useWalletStore((s) => s.publicKey)
  const wallet = walletPubkey?.toBase58() ?? null
  const { status } = useSupabaseAuth()
  const { setVisible } = useWalletModal()

  const { data: comments, isLoading, error } = useComments(marketId)
  const post = usePostComment(marketId, wallet)

  const [body, setBody] = useState('')

  const canPost = connected && status === 'authenticated' && body.trim().length > 0

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canPost) return
    post.mutate({ body: body.trim() }, { onSuccess: () => setBody('') })
  }

  return (
    <section className={cn('flex flex-col gap-4 rounded-lg border border-line p-5')}>
      <h3 className="text-body font-mono uppercase tracking-wide">Comments</h3>

      {isLoading && <p className="text-caption text-ink-muted">Loading…</p>}
      {error && <p className="text-caption text-accent">Failed to load comments.</p>}

      <ul className="flex flex-col gap-3">
        {(comments ?? []).map((c) => (
          <li key={c.id} className="rounded-md border border-line-weak p-3">
            <div className="flex justify-between text-caption text-ink-muted">
              <span className="font-mono">{c.wallet.slice(0, 4)}…{c.wallet.slice(-4)}</span>
              <span>
                {new Date(c.created_at).toLocaleString()}
                {c.edited_at && <span className="ml-2 italic">(edited)</span>}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-ink">{c.body}</p>
          </li>
        ))}
        {(comments ?? []).length === 0 && !isLoading && (
          <li className="text-caption text-ink-muted">No comments yet. Be the first.</li>
        )}
      </ul>

      {!connected ? (
        <Button variant="dashed" fullWidth onClick={() => setVisible(true)} type="button">
          Connect wallet to post
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your take…"
            maxLength={2000}
            rows={3}
            className={cn(
              'rounded-md border border-line bg-transparent p-3',
              'text-ink focus:border-ink-strong focus:outline-none',
            )}
          />
          <div className="flex items-center justify-between">
            <span className="text-caption text-ink-muted">{body.length}/2000</span>
            <Button
              type="submit"
              variant="primary"
              disabled={!canPost || post.isPending}
            >
              {post.isPending ? 'Posting…' : 'Post'}
            </Button>
          </div>
          {post.error && (
            <p className="text-caption text-accent">
              {post.error.message.startsWith('rate_limit')
                ? 'Slow down — wait a few seconds before posting again.'
                : post.error.message.startsWith('permission_denied')
                ? 'Permission denied.'
                : 'Failed to post. Try again.'}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
