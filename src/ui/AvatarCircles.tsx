import { Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'

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
  if (avatars.length === 0) return null

  return (
    <div className={cn('relative flex items-center justify-end gap-2', className)}>
      <div className="flex -space-x-2">
        {avatars.map((avatar) => (
          <Link
            key={avatar.id}
            to="/profile"
            search={{ wallet: avatar.wallet }}
            aria-label={avatar.label}
            title={avatar.label}
            className={cn(
              'border-surface-1 bg-surface-2 text-ink-strong relative inline-flex',
              'h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2',
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
          aria-expanded={expanded}
          aria-label={overflowLabel(numPeople)}
          title={overflowLabel(numPeople)}
          className={cn(
            'border-line bg-surface-2 text-ink-muted inline-flex h-8 min-w-8 items-center',
            'justify-center rounded-full border px-2 font-mono text-[11px] leading-none',
            'transition-colors hover:text-ink-strong focus-visible:ring-focus',
            'focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          +{numPeople}
        </button>
      )}

      {expanded && (
        <div
          className={cn(
            'border-line bg-surface-1 absolute right-0 top-11 z-20 w-72 rounded-lg border',
            'p-2 shadow-[0_24px_60px_rgba(0,0,0,0.38)]',
          )}
        >
          {avatars.map((avatar) => (
            <Link
              key={`${avatar.id}-detail`}
              to="/profile"
              search={{ wallet: avatar.wallet }}
              className={cn(
                'hover:bg-surface-2 flex items-center gap-3 rounded-md px-2 py-2',
                'focus-visible:ring-focus focus-visible:outline-none focus-visible:ring-2',
              )}
            >
              <span
                className={cn(
                  'bg-surface-2 text-ink-strong flex h-8 w-8 shrink-0',
                  'items-center justify-center overflow-hidden rounded-full',
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
                <span className="text-ink-strong block truncate text-sm">{avatar.label}</span>
                <span className="text-ink-dim block truncate font-mono text-[11px]">
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
