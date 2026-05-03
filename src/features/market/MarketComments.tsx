import { useMemo, useState, type FormEvent } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { MessageSquare, Send } from 'lucide-react'

import {
  useComments,
  usePostComment,
  useProfiles,
  useSupabaseAuth,
  getProfileImageUrl,
} from '@/lib/supabase/hooks'
import { SIGILS } from '@/ui/Sigils'
import { useWalletStore } from '@/stores/walletStore'
import { Button } from '@/ui/Button'
import { cn } from '@/lib/cn'
import type { Profile } from '@/lib/supabase/types'

type Props = { marketId: string }

/** Time-ago formatter: "2m ago", "3h ago", "1d ago", etc. */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

/** Renders a profile avatar: custom image or sigil glyph. */
function CommentAvatar({ profile }: { profile?: Profile }) {
  if (profile?.avatar_kind === 'image' && profile.avatar_image_path) {
    const url = getProfileImageUrl(profile.avatar_image_path)
    if (url) {
      return <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
    }
  }

  const idx = profile?.avatar_sigil_idx ?? 4
  const Glyph = SIGILS[idx] ?? SIGILS[0]
  return <Glyph size={22} tone="strong" />
}

export function MarketComments({ marketId }: Props) {
  const connected = useWalletStore((s) => s.connected)
  const walletPubkey = useWalletStore((s) => s.publicKey)
  const wallet = walletPubkey?.toBase58() ?? null
  const { status } = useSupabaseAuth()
  const { setVisible } = useWalletModal()

  const { data: comments, isLoading, error } = useComments(marketId)
  const post = usePostComment(marketId, wallet)

  const [body, setBody] = useState('')

  // Collect unique wallet addresses from comments to batch-fetch profiles
  const walletAddresses = useMemo(() => (comments ?? []).map((c) => c.wallet), [comments])
  const { data: profileMap } = useProfiles(walletAddresses)

  const canPost = connected && status === 'authenticated' && body.trim().length > 0

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canPost) return
    post.mutate({ body: body.trim() }, { onSuccess: () => setBody('') })
  }

  const commentCount = (comments ?? []).length

  return (
    <section className="flex flex-col gap-0">
      {/* Header */}
      <div className={cn('flex items-center gap-3 py-4', 'border-line border-b')}>
        <MessageSquare size={16} strokeWidth={1.5} className="text-ink-dim" />
        <h3 className="text-ui text-ink-muted font-mono tracking-wide uppercase">Comments</h3>
        {commentCount > 0 && (
          <span
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5',
              'bg-line-strong text-micro text-ink-muted font-mono font-bold',
            )}
          >
            {commentCount}
          </span>
        )}
      </div>

      {/* Comment list */}
      <div className="flex flex-col">
        {isLoading && (
          <div className="flex flex-col gap-4 py-6">
            {[0, 1].map((i) => (
              <div key={i} className="flex animate-pulse items-start gap-3">
                <div className="bg-line h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="bg-line h-3 w-24 rounded" />
                  <div className="bg-line h-3 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-caption text-accent py-6 font-mono">Failed to load comments.</p>
        )}

        {(comments ?? []).map((c) => {
          const profile = profileMap?.[c.wallet]
          const displayName =
            profile?.display_name || `${c.wallet.slice(0, 4)}…${c.wallet.slice(-4)}`
          const username = profile?.username

          return (
            <article
              key={c.id}
              className={cn(
                'group flex items-start gap-3 py-4',
                'border-line border-b',
                'transition-colors duration-150',
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden',
                  'border-line-strong bg-surface-1 rounded-full border',
                )}
              >
                <CommentAvatar profile={profile} />
              </div>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-caption text-ink-strong truncate font-mono font-bold">
                    {displayName}
                  </span>
                  {username && (
                    <span className="text-label text-ink-dim font-mono tracking-wide">
                      @{username}
                    </span>
                  )}
                  <span className="text-label text-ink-dim ml-auto shrink-0 font-mono whitespace-nowrap">
                    {timeAgo(c.created_at)}
                    {c.edited_at && <span className="ml-1 italic opacity-60">(edited)</span>}
                  </span>
                </div>
                <p className="text-body-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {c.body}
                </p>
              </div>
            </article>
          )
        })}

        {commentCount === 0 && !isLoading && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MessageSquare size={28} strokeWidth={1} className="text-ink-dim opacity-40" />
            <p className="text-caption text-ink-dim font-mono tracking-wide uppercase">
              No comments yet
            </p>
            <p className="text-label text-ink-dim font-mono">Be the first to share your take.</p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="pt-4">
        {!connected ? (
          <Button variant="dashed" fullWidth onClick={() => setVisible(true)} type="button">
            Connect wallet to comment
          </Button>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div
              className={cn(
                'relative flex items-start gap-3 rounded-xl',
                'border-line bg-surface-1/50 border',
                'transition-[border-color] duration-150',
                'focus-within:border-ink-strong',
              )}
            >
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share your take…"
                maxLength={2000}
                rows={2}
                className={cn(
                  'flex-1 resize-none bg-transparent p-4',
                  'text-body-sm text-ink placeholder:text-ink-dim',
                  'focus:outline-none',
                )}
              />
              <button
                type="submit"
                disabled={!canPost || post.isPending}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center self-end',
                  'mr-2 mb-2 rounded-lg',
                  'transition-all duration-150',
                  canPost && !post.isPending
                    ? 'from-brand-from to-brand-to text-surface bg-gradient-to-r hover:opacity-90'
                    : 'bg-line text-ink-dim cursor-not-allowed',
                )}
                aria-label="Post comment"
              >
                <Send size={14} strokeWidth={2} className={post.isPending ? 'animate-pulse' : ''} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-label text-ink-dim font-mono">{body.length}/2000</span>
              {post.isPending && (
                <span className="text-label text-ink-muted animate-pulse font-mono">Posting…</span>
              )}
            </div>

            {post.error && (
              <p className="text-caption text-accent font-mono">
                {post.error.message.startsWith('rate_limit')
                  ? 'Slow down — wait a few seconds before posting again.'
                  : post.error.message.startsWith('permission_denied')
                    ? 'Permission denied.'
                    : 'Failed to post. Try again.'}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
