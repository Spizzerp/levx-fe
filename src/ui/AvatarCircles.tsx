import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'

import { cn } from '@/lib/cn'

export interface AvatarCircle {
  id: string
  label: string
  wallet?: string
  username?: string
  pnl?: number
  imageUrl?: string | null
  fallback?: ReactNode
}

interface AvatarCirclesProps {
  avatars: AvatarCircle[]
  numPeople?: number
  className?: string
}

function formatOverflowCount(count: number): string {
  if (count >= 1000) {
    return new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(count)
  }
  return String(Math.max(0, count))
}

function formatPnl(value: number | undefined): string {
  const amount = value ?? 0
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`
}

export function AvatarCircles({ avatars, numPeople = 0, className }: AvatarCirclesProps) {
  const [expanded, setExpanded] = useState(false)
  if (avatars.length === 0 && numPeople <= 0) return null
  const expandable = numPeople > 0
  const showDetails = !expandable || expanded
  const overflowLabel = `${numPeople.toLocaleString()} more ${
    numPeople === 1 ? 'participant' : 'participants'
  }`

  return (
    <motion.div
      layout
      className={cn(
        'z-10 flex items-center rtl:space-x-reverse',
        expanded ? 'gap-1.5' : '-space-x-2',
        expandable && 'cursor-pointer',
        className,
      )}
      onClick={() => {
        if (expandable && !expanded) setExpanded(true)
      }}
      aria-expanded={expandable ? expanded : undefined}
    >
      {avatars.map((avatar) => (
        <motion.div
          layout
          key={avatar.id}
          className="group relative shrink-0"
        >
          <Link
            to="/profile"
            search={avatar.wallet ? { wallet: avatar.wallet } : {}}
            title={avatar.label}
            aria-label={avatar.label}
            onClick={(event) => {
              if (expandable && !expanded) {
                event.preventDefault()
                setExpanded(true)
              }
            }}
            className={cn(
              'border-line-strong bg-surface-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border',
              'duration-short ease-levx transition-transform hover:-translate-y-0.5',
            )}
          >
            {avatar.imageUrl ? (
              <img
                src={avatar.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              avatar.fallback
            )}
          </Link>
          {showDetails && (
            <div
              className={cn(
                'pointer-events-none absolute right-1/2 bottom-[calc(100%+10px)] z-overlay translate-x-1/2',
                'border-line-strong bg-surface text-ink-strong rounded-md border px-3 py-2',
                'font-mono whitespace-nowrap shadow-none',
                'opacity-0 translate-y-1 duration-short ease-levx transition-[opacity,transform]',
                'group-hover:translate-y-0 group-hover:opacity-100',
              )}
            >
              <div className="text-caption font-bold">{avatar.label}</div>
              <div
                className={cn(
                  'text-label mt-2 font-bold',
                  (avatar.pnl ?? 0) >= 0 ? 'text-success' : 'text-accent',
                )}
              >
                PNL {formatPnl(avatar.pnl)}
              </div>
            </div>
          )}
        </motion.div>
      ))}
      {numPeople > 0 && (
        <motion.button
          layout
          type="button"
          title={expanded ? 'Collapse participants' : overflowLabel}
          aria-label={expanded ? 'Collapse participants' : overflowLabel}
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((current) => !current)
          }}
          className={cn(
            'border-line-strong bg-surface-1 text-ink-strong flex size-8 shrink-0 items-center justify-center rounded-full border',
            'font-mono text-xs leading-none font-bold',
          )}
        >
          {expanded ? '−' : `+${formatOverflowCount(numPeople)}`}
        </motion.button>
      )}
    </motion.div>
  )
}
