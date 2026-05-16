import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Send, Trash2 } from 'lucide-react'

import {
  useComments,
  usePostComment,
  useDeleteComment,
  useProfiles,
  useSupabaseAuth,
  getProfileImageUrl,
} from '@/lib/supabase/hooks'
import { SIGILS } from '@/ui/Sigils'
import { useWalletStore } from '@/stores/walletStore'
import { cn } from '@/lib/cn'
import { Modal } from '@/ui/Modal'
import { Button } from '@/ui/Button'
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
  const { status, authenticate } = useSupabaseAuth()
  const { setVisible } = useWalletModal()

  const { data: comments, isLoading, error } = useComments(marketId)
  const post = usePostComment(marketId, wallet)
  const remove = useDeleteComment(marketId, wallet)

  const [body, setBody] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
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

  const onDelete = (id: string) => {
    remove.mutate(id, {
      onSuccess: () => setDeleteId(null),
    })
  }

  // Collect unique wallet addresses from comments to batch-fetch profiles
  const walletAddresses = useMemo(() => (comments ?? []).map((c) => c.wallet), [comments])
  const { data: profileMap } = useProfiles(walletAddresses)

  const canPost =
    connected && body.trim().length > 0 && status !== 'pending' && !post.isPending

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canPost) return

    if (status !== 'authenticated') {
      try {
        await authenticate()
      } catch {
        return
      }
    }

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
        <h3 className="text-ui text-ink-muted font-mono tracking-wide uppercase">Comments</h3>
        {commentCount > 0 && (
          <>
            <span aria-hidden="true" className="bg-line-strong h-4 w-px" />
            <span className="text-ui text-ink-muted font-mono font-bold">
              {commentCount}
            </span>
          </>
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
                'border-line border-b last:border-b-0',
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

                  <div className="ml-auto flex flex-col items-end gap-1">
                    <span className="text-label text-ink-dim shrink-0 font-mono whitespace-nowrap">
                      {timeAgo(c.created_at)}
                      {c.edited_at && <span className="ml-1 italic opacity-60">(edited)</span>}
                    </span>
                    {/* Delete (only for own comment) — sits below the
                        timestamp so the time stays the dominant read
                        and the destructive action is one row removed. */}
                    {c.wallet === wallet && (
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className={cn(
                          'flex items-center gap-1 font-mono transition-colors',
                          'text-micro text-accent/30 hover:text-accent',
                        )}
                      >
                        <Trash2 size={10} strokeWidth={2} />
                        delete
                      </button>
                    )}
                  </div>
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
          // Unconnected: render the same composer shape as the
          // connected state (dashed border, placeholder, char counter,
          // send icon) but as a single big button. Clicking anywhere —
          // including the send icon — triggers the wallet modal.
          // Visually consistent with the connected composer rather
          // than swapping in a different button style.
          <button
            type="button"
            onClick={() => setVisible(true)}
            aria-label="Connect wallet to comment"
            className={cn(
              'group flex w-full flex-col rounded-xl',
              'border-line-strong bg-surface-1/30 border border-dashed',
              'transition-all duration-200',
              'hover:border-ink-muted hover:bg-surface-1/50',
            )}
          >
            {/* Fake textarea placeholder */}
            <div className="px-4 pt-3 pb-2 text-left">
              <span className="text-body-sm text-ink-dim italic opacity-50">Share your take…</span>
            </div>
            {/* Footer bar — char counter + (disabled-looking) send icon */}
            <div className="flex items-center justify-between px-4 pt-1 pb-3">
              <span className="text-label text-ink-dim font-mono opacity-40">0/2000</span>
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  'border border-dashed border-line-strong bg-transparent text-ink-dim',
                  'transition-colors duration-150',
                  'group-hover:border-ink-strong',
                )}
              >
                <Send size={14} strokeWidth={2} />
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
              <div className="flex items-center justify-between px-4 pt-1 pb-3">
                <span className="text-label text-ink-dim font-mono tabular-nums">
                  {body.length}/2000
                </span>

                <div className="flex items-center gap-2">
                  {post.isPending && (
                    <span className="text-label text-ink-muted animate-pulse font-mono">
                      Posting…
                    </span>
                  )}
                  {!post.isPending && status === 'pending' && (
                    <span className="text-label text-ink-muted animate-pulse font-mono">
                      Signing…
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        size="sm"
        hideHeader
      >
        <div className="flex flex-col gap-6 p-8">
          <div className="flex flex-col gap-1.5 text-center">
            <Modal.Title className="text-ui-lg text-ink font-mono font-bold tracking-tight uppercase">
              Delete Comment?
            </Modal.Title>
            <Modal.Description className="text-body-sm text-ink-dim leading-relaxed">
              Are you sure? This cannot be undone.
            </Modal.Description>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteId(null)}
              disabled={remove.isPending}
              className="min-h-10 px-4 py-2 text-label"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && onDelete(deleteId)}
              disabled={remove.isPending}
              className="min-h-10 px-4 py-2 text-label"
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
