import {
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
import { cn } from '@/lib/cn'
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
    label: 'Quantum Engine',
    desc: 'Path scoring, amplitudes, pricing, and the quantum-inspired cache.',
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

export function DocsHome() {
  return (
    <div className="mx-auto max-w-[900px] pt-12 pb-24">
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
          Build on LevX
        </h1>
        <p className="text-ink-muted font-editorial max-w-[520px] text-[20px] leading-snug tracking-tight">
          A path-prediction market protocol on Solana. Predict the route, not just the destination.
        </p>
      </div>

      {/* Quick-link bento row */}
      <div className="border-line bg-line mb-12 grid grid-cols-3 gap-px border md:grid-cols-1">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.to}
            to="/docs/$id"
            params={{ id: item.to }}
            className={cn(
              'group bg-surface flex flex-col gap-3 p-6',
              'duration-short ease-levx transition-colors',
              'hover:bg-surface-1',
            )}
          >
            <div className="text-ink-dim group-hover:text-ink-strong duration-short ease-levx transition-colors">
              {item.icon}
            </div>
            <div>
              <div className="text-ink-strong mb-1 flex items-center gap-2 font-sans text-[15px] font-medium">
                {item.label}
                <ArrowRight
                  size={13}
                  className={cn(
                    'text-ink-dim -translate-x-1 opacity-0',
                    'duration-short ease-levx transition-all',
                    'group-hover:translate-x-0 group-hover:opacity-100',
                  )}
                />
              </div>
              <p className="text-ink-dim text-body-sm font-sans leading-relaxed">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Section bento grid */}
      <div className="border-line bg-line grid grid-cols-2 gap-px border md:grid-cols-1">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.id} className="bg-surface flex flex-col p-6">
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
                      'border-line hover:bg-surface-1',
                      'duration-short ease-levx px-3 py-2.5 transition-colors',
                    )}
                  >
                    <span className="text-ink group-hover:text-ink-strong text-body-sm duration-short ease-levx font-sans transition-colors">
                      {item.label}
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

      {/* Footer strip */}
      <div className="border-line mt-12 flex items-center justify-between border-t pt-8">
        <span className="text-ink-dim text-nano font-mono tracking-wider uppercase">
          v0.1.0 - Solana Devnet
        </span>
        <a
          href="https://github.com/levx-protocol"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'text-ink-dim hover:text-ink-strong',
            'duration-short ease-levx text-nano flex items-center gap-1.5',
            'font-mono tracking-wider uppercase transition-colors',
          )}
        >
          GitHub -&gt;
        </a>
      </div>
    </div>
  )
}
