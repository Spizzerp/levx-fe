import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Compass,
  FileText,
  Layers,
  LinkIcon,
  Map,
  AppWindow,
  MessageCircle,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { ChartFrame } from '@/features/chart/ChartFrame'
import { cn } from '@/lib/cn'
import { SIDEBAR_SECTIONS } from './data'
import type { DocId } from './types'

function GitHubIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.65.5.5 5.77.5 12.28c0 5.21 3.29 9.62 7.86 11.18.57.11.78-.25.78-.57 0-.28-.01-1.02-.02-2-3.2.71-3.87-1.58-3.87-1.58-.52-1.36-1.28-1.72-1.28-1.72-1.05-.73.08-.72.08-.72 1.15.08 1.76 1.22 1.76 1.22 1.03 1.8 2.7 1.28 3.35.98.1-.76.4-1.28.73-1.58-2.55-.3-5.23-1.31-5.23-5.82 0-1.29.45-2.34 1.18-3.16-.12-.3-.51-1.5.11-3.12 0 0 .97-.32 3.17 1.2A10.72 10.72 0 0 1 12 5.7c.98 0 1.97.14 2.89.4 2.2-1.52 3.16-1.2 3.16-1.2.63 1.62.23 2.82.12 3.12.74.82 1.18 1.87 1.18 3.16 0 4.52-2.68 5.52-5.24 5.81.41.37.78 1.09.78 2.19 0 1.58-.01 2.86-.01 3.25 0 .32.2.68.79.57 4.55-1.56 7.83-5.97 7.83-11.18C23.5 5.77 18.35.5 12 .5Z"
      />
    </svg>
  )
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  overview: <BookOpen size={16} />,
  guide: <Compass size={16} />,
  protocol: <Layers size={16} />,
  resources: <FileText size={16} />,
  links: <LinkIcon size={16} />,
}

// Hero quick-links
const QUICK_LINKS: { label: string; desc: string; to: DocId; icon: React.ReactNode }[] = [
  {
    label: 'Getting Started',
    desc: 'Explore the current devnet beta app and market flow.',
    to: 'getting-started',
    icon: <Compass size={18} />,
  },
  {
    label: 'Quantum Path Engine',
    desc: 'Scoring, amplitudes, thin-market pricing, and correlated paths.',
    to: 'quantum-scoring-engine',
    icon: <BrainCircuit size={18} />,
  },
  {
    label: 'Roadmap',
    desc: 'Mode 1 hardening, Mode 2 liquidity, and mainnet readiness.',
    to: 'roadmap',
    icon: <Map size={18} />,
  },
]

const QUICK_LINK_PILL_CLASSES = [
  'w-[72%] self-start',
  'w-[86%] self-start',
  'w-full self-start',
] as const

export function DocsHome() {
  return (
    <div className="mx-auto max-w-[900px] pb-24">
      {/* Hero */}
      <div className="mb-16">
        <p className="text-success text-nano mb-4 font-mono tracking-wider uppercase">
          LevX Documentation
        </p>
        <h1
          className={cn(
            'text-ink-strong mb-4',
            'font-display text-[52px] leading-none font-medium tracking-tighter',
            "[font-variation-settings:'ROND'_100]",
          )}
        >
          Predict with LevX
        </h1>
        <p className="text-ink-muted font-editorial text-[20px] leading-snug tracking-tight whitespace-nowrap md:whitespace-normal">
          A path-prediction market protocol on Solana. Predict the route, not just the destination.
        </p>
      </div>

      {/* Quick-link pill stack */}
      <div className="mb-12 flex flex-col gap-4">
        {QUICK_LINKS.map((item, index) => (
          <Link
            key={item.to}
            to="/docs/$id"
            params={{ id: item.to }}
            className={cn(
              'group flex min-h-16 items-center gap-4',
              'px-5 py-3',
              'border-line bg-surface rounded-full border',
              'duration-short ease-levx transition-colors',
              'hover:bg-surface-1',
              'md:w-full md:self-stretch',
              QUICK_LINK_PILL_CLASSES[index],
            )}
          >
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center',
                'border-line rounded-full border',
                'text-ink-dim group-hover:text-ink-strong',
                'duration-short ease-levx transition-colors',
              )}
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-ink-strong mb-1 font-sans text-[15px] font-medium">
                {item.label}
              </div>
              <p className="text-ink-dim text-body-sm font-sans leading-relaxed">{item.desc}</p>
            </div>
            <ArrowRight
              size={15}
              className={cn(
                'text-ink-dim shrink-0 -translate-x-1 opacity-0',
                'duration-short ease-levx transition-all',
                'group-hover:translate-x-0 group-hover:opacity-100',
              )}
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>

      {/* Section bento grid */}
      <ChartFrame glow>
        <div className="bg-line grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-px md:grid-cols-1">
          {SIDEBAR_SECTIONS.filter((s) => s.id !== 'links').map((section) => (
            <div key={section.id} className="bg-surface flex min-w-0 flex-col p-6">
              {/* Section header */}
              <div className="mb-5 flex items-center gap-2.5">
                <span className="text-ink-dim">{SECTION_ICONS[section.id]}</span>
                <span className="text-nano text-ink-dim font-mono tracking-wider uppercase">
                  {section.num}
                </span>
                <span className="text-ink-strong font-sans text-[15px] font-medium">
                  {section.label}
                </span>
              </div>

              {/* Items */}
              <ul className="flex flex-col gap-px">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to="/docs/$id"
                      params={{ id: item.id }}
                      className={cn(
                        'group flex items-center justify-between',
                        'px-3 py-2.5',
                        'border-line hover:bg-surface-1',
                        'duration-short ease-levx transition-colors',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-ink group-hover:text-ink-strong text-body-sm duration-short ease-levx truncate font-sans transition-colors">
                          {item.label}
                        </span>
                        {item.id === 'introduction' && (
                          <span
                            aria-label="Start here"
                            className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase"
                          >
                            <span
                              aria-hidden="true"
                              className="text-brand-to inline-flex shrink-0 items-center motion-safe:animate-pulse"
                            >
                              <ArrowLeft size={10} strokeWidth={2} />
                            </span>
                            <span className="text-brand-gradient">START</span>
                          </span>
                        )}
                      </span>
                      <ArrowRight
                        size={12}
                        className={cn(
                          'text-ink-dim -translate-x-1 opacity-0',
                          'duration-short ease-levx transition-all',
                          'group-hover:translate-x-0 group-hover:opacity-100',
                        )}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ChartFrame>

      {/* Text Links */}
      <div className="mt-12 flex flex-col gap-4">
        <div className="flex items-center gap-3 font-sans text-[15px]">
          <AppWindow size={20} className="text-ink-dim" strokeWidth={1.5} />
          <span className="text-ink-muted">
            Ready to explore the markets?{' '}
            <span className="text-ink-dim font-mono text-caption tracking-wider uppercase">
              COMING SOON
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3 font-sans text-[15px]">
          <GitHubIcon size={20} className="text-ink-dim" />
          <span className="text-ink-muted">
            Want to see the code?{' '}
            <Link
              to="/docs/$id"
              params={{ id: 'github' }}
              className="text-success duration-short ease-levx transition-colors hover:opacity-80"
            >
              GitHub
            </Link>
          </span>
        </div>
        <div className="flex items-center gap-3 font-sans text-[15px]">
          <MessageCircle size={20} className="text-ink-dim" strokeWidth={1.5} />
          <span className="text-ink-muted">
            Have questions or feedback?{' '}
            <Link
              to="/docs/$id"
              params={{ id: 'community' }}
              className="text-success duration-short ease-levx transition-colors hover:opacity-80"
            >
              Community
            </Link>
          </span>
        </div>
      </div>

      {/* Footer strip */}
      <div className="border-line mt-12 flex items-center justify-between border-t pt-8">
        <span className="text-ink-dim text-nano font-mono tracking-wider">v1 - Solana Devnet</span>
        <span className="text-ink-dim text-nano font-mono tracking-wider">NotYourBusiness LLC</span>
      </div>
    </div>
  )
}
