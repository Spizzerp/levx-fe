import { Link } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { formatUSD } from '@/lib/format'

export interface AvatarCircle {
  id: string
  label: string
  wallet: string
  username?: string
  pnl: number
  exposure: number
  imageUrl?: string | null
  fallback: ReactNode
}

interface AvatarCirclesProps {
  avatars: AvatarCircle[]
  numPeople?: number
  className?: string
}

function overflowLabel(numPeople: number): string {
  return `${numPeople} more ${numPeople === 1 ? 'participant' : 'participants'}`
}

function pnlLabel(pnl: number): string {
  if (pnl === 0) return 'PNL $0.00'
  return `PNL ${pnl > 0 ? '+' : '-'}${formatUSD(Math.abs(pnl))}`
}

export function AvatarCircles({ avatars, numPeople = 0, className }: AvatarCirclesProps) {
  const [expanded, setExpanded] = useState(false)
  const popoverId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!expanded) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null
      if (target && rootRef.current?.contains(target)) return
      setExpanded(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [expanded])

  if (avatars.length === 0) return null

  return (
    <div ref={rootRef} className={cn('flex items-center justify-end relative gap-2', className)}>
      <div className="flex -space-x-2">
        {avatars.map((avatar) => (
          <Link
            key={avatar.id}
            to="/profile"
            search={{ wallet: avatar.wallet }}
            aria-label={avatar.label}
            title={avatar.label}
            className={cn(
              'inline-flex items-center justify-center relative overflow-hidden h-9 w-9',
              'rounded-full border-2 border-surface-1 bg-surface-2 text-ink-strong',
              'shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-0.5',
              'focus-visible:ring-focus focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            {avatar.imageUrl ? (
              <img
                src={avatar.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              avatar.fallback
            )}
          </Link>
        ))}
      </div>

      {numPeople > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-controls={expanded ? popoverId : undefined}
          aria-expanded={expanded}
          aria-haspopup="dialog"
          aria-label={overflowLabel(numPeople)}
          title={overflowLabel(numPeople)}
          className={cn(
            'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-full border',
            'border-line bg-surface-2 font-mono text-[11px] text-ink-muted leading-none',
            'transition-colors hover:text-ink-strong focus-visible:ring-focus',
            'focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          +{numPeople}
        </button>
      )}

      {expanded && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Top market participants"
          className={cn(
            'absolute right-0 top-11 z-20 w-72 p-2 rounded-lg border border-line',
            'bg-surface-1 shadow-[0_24px_60px_rgba(0,0,0,0.38)]',
          )}
        >
          {avatars.map((avatar) => (
            <Link
              key={`${avatar.id}-detail`}
              to="/profile"
              search={{ wallet: avatar.wallet }}
              className={cn(
                'flex items-center gap-3 px-2 py-2 rounded-md hover:bg-surface-2',
                'focus-visible:ring-focus focus-visible:outline-none focus-visible:ring-2',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center overflow-hidden h-8 w-8 shrink-0',
                  'rounded-full bg-surface-2 text-ink-strong',
                )}
              >
                {avatar.imageUrl ? (
                  <img
                    src={avatar.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  avatar.fallback
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink-strong">{avatar.label}</span>
                <span className="block truncate font-mono text-[11px] text-ink-dim">
                  {formatUSD(avatar.exposure)} exposure
                </span>
              </span>
              <span
                className={cn(
                  'font-mono text-[11px]',
                  avatar.pnl >= 0 ? 'text-success' : 'text-accent',
                )}
              >
                {pnlLabel(avatar.pnl)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
