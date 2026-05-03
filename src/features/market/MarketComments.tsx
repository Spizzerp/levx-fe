import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
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

/** Minimum rows and max height for the auto-resizing textarea. */
const TEXTAREA_MIN_ROWS = 2
const TEXTAREA_MAX_HEIGHT = 160

export function MarketComments({ marketId }: Props) {
  const connected = useWalletStore((s) => s.connected)
  const walletPubkey = useWalletStore((s) => s.publicKey)
  const wallet = walletPubkey?.toBase58() ?? null
  const { status } = useSupabaseAuth()
  const { setVisible } = useWalletModal()

  const { data: comments, isLoading, error } = useComments(marketId)
  const post = usePostComment(marketId, wallet)

  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize the textarea to fit its content up to TEXTAREA_MAX_HEIGHT
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    // Reset to auto so scrollHeight recalculates correctly on shrink
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }, [])

  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(e.target.value)
      // autoResize on next frame after React has committed the value
      requestAnimationFrame(autoResize)
    },
    [autoResize],
  )

  // Collect unique wallet addresses from comments to batch-fetch profiles
  const walletAddresses = useMemo(() => (comments ?? []).map((c) => c.wallet), [comments])
  const { data: profileMap } = useProfiles(walletAddresses)

  const canPost = connected && status === 'authenticated' && body.trim().length > 0

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canPost) return
    post.mutate(
      { body: body.trim() },
      {
        onSuccess: () => {
          setBody('')
          // Reset height after clearing
          requestAnimationFrame(() => {
            const el = textareaRef.current
            if (el) {
              el.style.height = 'auto'
            }
          })
        },
      },
    )
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
          <button
            type="button"
            onClick={() => setVisible(true)}
            className={cn(
              'group flex w-full flex-col rounded-xl',
              'border border-dashed border-line-strong bg-surface-1/30',
              'transition-all duration-200',
              'hover:border-ink-muted hover:bg-surface-1/50',
            )}
          >
            {/* Fake textarea placeholder */}
            <div className="px-4 pt-3 pb-2 text-left">
              <span className="text-body-sm text-ink-dim italic opacity-50">
                Share your take…
              </span>
            </div>
            {/* Footer bar */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1">
              <span className="text-label text-ink-dim font-mono opacity-40">0/2000</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
                  'bg-gradient-to-r from-brand-from to-brand-to text-surface',
                  'text-label font-mono font-bold tracking-wide uppercase',
                  'transition-opacity duration-150 group-hover:opacity-90',
                )}
              >
                Connect wallet
              </span>
            </div>
          </button>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-0">
            {/* Textarea container */}
            <div
              className={cn(
                'relative flex flex-col rounded-xl',
                'border-line bg-surface-1/50 border',
                'transition-[border-color] duration-150',
                'focus-within:border-ink-strong',
              )}
            >
              <textarea
                ref={textareaRef}
                value={body}
                onChange={handleBodyChange}
                placeholder="Share your take…"
                maxLength={2000}
                rows={TEXTAREA_MIN_ROWS}
                className={cn(
                  'w-full resize-none bg-transparent px-4 pt-3 pb-2',
                  'text-body-sm text-ink placeholder:text-ink-dim',
                  'focus:outline-none',
                )}
                style={{ maxHeight: TEXTAREA_MAX_HEIGHT, overflowY: 'auto' }}
              />

              {/* Footer bar — inside the border container */}
              <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <span className="text-label text-ink-dim font-mono tabular-nums">
                  {body.length}/2000
                </span>

                <div className="flex items-center gap-2">
                  {post.isPending && (
                    <span className="text-label text-ink-muted animate-pulse font-mono">
                      Posting…
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={!canPost || post.isPending}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      'transition-all duration-150',
                      canPost && !post.isPending
                        ? 'from-brand-from to-brand-to text-surface bg-gradient-to-r hover:opacity-90'
                        : 'bg-line text-ink-dim cursor-not-allowed',
                    )}
                    aria-label="Post comment"
                  >
                    <Send
                      size={14}
                      strokeWidth={2}
                      className={post.isPending ? 'animate-pulse' : ''}
                    />
                  </button>
                </div>
              </div>
            </div>

            {post.error && (
              <p className="text-caption text-accent mt-2 font-mono">
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
