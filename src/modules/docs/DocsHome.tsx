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
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { ChartFrame } from '@/features/chart/ChartFrame'
import { cn } from '@/lib/cn'
import { HyperText } from '@/ui/HyperText'
import { SIDEBAR_SECTIONS } from './data'
import type { DocId } from './types'

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
          <HyperText>Predict with LevX</HyperText>
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
          {SIDEBAR_SECTIONS.map((section) => (
            <div
              key={section.id}
              className={cn(
                'bg-surface flex min-w-0 flex-col p-6',
                section.id === 'links' && 'col-span-2 md:col-span-1',
              )}
            >
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
              <ul
                className={cn(
                  'flex flex-col gap-px',
                  section.id === 'links' && 'grid grid-cols-3 items-center md:grid-cols-1',
                )}
              >
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
                        section.id === 'links' &&
                          'justify-center text-center md:justify-between md:text-left',
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

      {/* Footer strip */}
      <div className="border-line mt-12 flex items-center justify-between border-t pt-8">
        <span className="text-ink-dim text-nano font-mono tracking-wider">v1 - Solana Devnet</span>
        <span className="text-ink-dim text-nano font-mono tracking-wider">NotYourBusiness LLC</span>
      </div>
    </div>
  )
}
