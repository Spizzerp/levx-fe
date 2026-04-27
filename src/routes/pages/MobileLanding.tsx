import { type ReactNode } from 'react'

import { MarketPreview } from '@/features/market/MarketPreview'
import { WaitlistForm, type WaitlistPayload } from '@/ui/WaitlistForm'
import type { PredictionPath, PricePoint } from '@/types/market'

interface MobileLandingProps {
  show: boolean
  history: PricePoint[]
  predictions: PredictionPath[]
  now: number
  marketStart: number
  marketEnd: number
  checkpointInterval: number
  totalCheckpoints: number
  onWaitlistSubmit: (payload: WaitlistPayload) => Promise<void> | void
  /** Opens the standalone WaitlistModal — wired from the in-rail CTA inside
   *  MarketPreview so users mid-page can pop open the form quickly without
   *  scrolling to the closing block. */
  onCtaClick: () => void
}

/**
 * Vertical-scroll landing for narrow viewports. The desktop landing is a
 * 1400vh scripted choreography (tilt + zoom + 5-stop tour + focus-pull
 * curtain) that doesn't translate to a phone — fixed positions overflow,
 * vw/vh tooltip anchors don't fit, and the 12-viewport scroll budget
 * compresses into illegibility. This component instead presents the same
 * brand language (Bricolage Grotesque title, mono-caps, hairline rules,
 * dither aura) as a vertically-stacked editorial spread:
 *
 *   1. Hero — eyebrow rule, display title, vertical spec list
 *   2. Static market preview (chart + provider rail stacked by MarketPreview's
 *      own `grid-cols-1` default)
 *   3. "How it works" — three numbered callouts (predict / score / edge)
 *   4. "Inside the protocol" — five feature deep-dives
 *   5. Inline waitlist closing block
 */
export function MobileLanding({
  show,
  history,
  predictions,
  now,
  marketStart,
  marketEnd,
  checkpointInterval,
  totalCheckpoints,
  onWaitlistSubmit,
  onCtaClick,
}: MobileLandingProps) {
  return (
    <div
      className="relative w-full overflow-x-hidden"
      style={{
        opacity: show ? 1 : 0,
        transition: show ? 'opacity 600ms ease-out' : 'none',
      }}
    >
      {/* Hero ------------------------------------------------------- */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-16">
        {/* Brand-green dither aura — single hero-scoped instance so
            sections below scroll on a clean black plane. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ opacity: show ? 1 : 0, transition: 'opacity 1000ms ease-out' }}
        >
          <div className="landing-dither" />
        </div>

        <div className="relative z-10 flex w-full max-w-[480px] flex-col items-center text-center">
          {/* Eyebrow kicker */}
          <div className="flex items-center gap-3">
            <span aria-hidden className="hero-intro__rule" />
            <span className="text-ink-muted text-nano font-mono tracking-[0.32em] uppercase">
              LevX <span className="text-ink-dim">·</span> v1 Devnet
            </span>
            <span aria-hidden className="hero-intro__rule hero-intro__rule--right" />
          </div>

          {/* Display title */}
          <h1
            className="text-ink-strong mt-7 text-[40px] leading-[0.96] tracking-[-0.035em]"
            style={{
              fontFamily: 'var(--font-editorial)',
              fontVariationSettings: '"opsz" 96',
            }}
          >
            <span className="block" style={{ fontWeight: 400 }}>
              Predict the path
            </span>
            <span className="text-ink-muted block" style={{ fontWeight: 360 }}>
              not the outcome
            </span>
          </h1>

          {/* Spec strip — stacked vertically on mobile so the three facts
              get their own breathing room instead of cramming into one row. */}
          <ul className="mt-9 flex flex-col items-center gap-2.5">
            {['Live Scoring', 'AI + Human Predictions', 'No Order Book'].map((label) => (
              <li
                key={label}
                className="text-nano font-mono tracking-[0.28em] text-white uppercase"
              >
                {label}
              </li>
            ))}
          </ul>

          {/* Scroll cue */}
          <div className="mt-14 flex flex-col items-center gap-2.5 opacity-70">
            <span className="text-ink-muted text-nano font-mono tracking-[0.32em] uppercase">
              Scroll
            </span>
            <span className="hero-scroll-rule" />
          </div>
        </div>
      </section>

      {/* Market preview ------------------------------------------- */}
      <section className="relative px-4 pt-6 pb-20">
        <SectionHeader kicker="The Dashboard" title="A live look" />

        {/* Plain bordered card — desktop uses MagicCard for the cursor-
            tracking border spotlight, but on touch there's no cursor,
            so a static 1px line + the existing brand-green glow halo
            reads cleaner than a hover effect that never fires. */}
        <div className="bg-surface landing-card-glow border-line relative mx-auto mt-8 overflow-hidden rounded-2xl border">
          {/* `overflow-x-hidden` on the inner wrapper guards the page
              against MarketPreview's `whitespace-nowrap` meta strip — 5
              facts with separators won't fit at <360px viewports. The
              strip clips into the right edge instead of pushing the
              page wide. The chart itself uses ParentSize so it adapts
              to the available width. */}
          <div className="overflow-x-hidden p-4">
            <MarketPreview
              pair="BTC/USDC"
              history={history}
              predictions={predictions}
              now={now}
              marketStart={marketStart}
              marketEnd={marketEnd}
              checkpointInterval={checkpointInterval}
              totalCheckpoints={totalCheckpoints}
              chartHeight={260}
              onCtaClick={onCtaClick}
            />
          </div>
        </div>
      </section>

      {/* How it works ---------------------------------------------- */}
      <section className="relative px-6 py-20">
        <SectionHeader kicker="How it Works" title="Three moves" />

        <div className="mt-10 flex flex-col gap-6">
          {HOW_IT_WORKS.map((c) => (
            <NumberedBlock key={c.num} num={c.num} kicker={c.kicker} title={c.title} body={c.body} />
          ))}
        </div>
      </section>

      {/* Inside the protocol --------------------------------------- */}
      <section className="relative px-6 py-20">
        <SectionHeader kicker="Inside the Protocol" title="Five capabilities" />

        <div className="mt-10 flex flex-col gap-5">
          {PROTOCOL_FEATURES.map((c) => (
            <FeatureBlock key={c.num} num={c.num} kicker={c.kicker} title={c.title} body={c.body} />
          ))}
        </div>
      </section>

      {/* Waitlist closing block ------------------------------------ */}
      <section className="relative overflow-hidden px-6 pt-20 pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0.4 }}
        >
          <div className="landing-dither" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-[480px] flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <span aria-hidden className="hero-intro__rule" />
            <span className="text-ink-muted text-nano font-mono tracking-[0.32em] uppercase">
              Early Access <span className="text-ink-dim">·</span> v1 Devnet
            </span>
            <span aria-hidden className="hero-intro__rule hero-intro__rule--right" />
          </div>

          <h2
            className="text-ink-strong text-display-sm mt-7 leading-[0.96] tracking-[-0.035em]"
            style={{
              fontFamily: 'var(--font-editorial)',
              fontVariationSettings: '"opsz" 96',
            }}
          >
            <span className="block" style={{ fontWeight: 400 }}>
              Join the waitlist
            </span>
            <span className="text-ink-muted block" style={{ fontWeight: 360 }}>
              Get early access
            </span>
          </h2>

          <ul className="mt-7 flex flex-col items-center gap-2">
            {['Live Scoring', 'AI + Human Predictions', 'No Order Book'].map((label) => (
              <li
                key={label}
                className="text-nano font-mono tracking-[0.28em] text-white/80 uppercase"
              >
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-10 w-full text-left">
            <WaitlistForm onSubmit={onWaitlistSubmit} tone="dark" />
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Editorial helpers ────────────────────────────────────────────

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <span aria-hidden className="hero-intro__rule" />
        <span className="text-ink-muted text-nano font-mono tracking-[0.32em] uppercase">
          {kicker}
        </span>
        <span aria-hidden className="hero-intro__rule hero-intro__rule--right" />
      </div>
      <h2
        className="text-ink-strong mt-5 text-[28px] leading-[0.98] tracking-[-0.02em]"
        style={{
          fontFamily: 'var(--font-editorial)',
          fontVariationSettings: '"opsz" 72',
          fontWeight: 400,
        }}
      >
        {title}
      </h2>
    </div>
  )
}

interface NumberedItem {
  num: string
  kicker: string
  title: string
  body: string
}

const HOW_IT_WORKS: readonly NumberedItem[] = [
  {
    num: '01',
    kicker: 'Predict',
    title: 'Predict the path, not just the price.',
    body: 'AI generates possible futures. You pick the one you believe — or draw your own.',
  },
  {
    num: '02',
    kicker: 'Score',
    title: 'Accuracy pays.',
    body: 'Paths are scored continuously against reality. The closer your prediction tracks what actually happens, the more you earn.',
  },
  {
    num: '03',
    kicker: 'Edge',
    title: 'Beat the AI, keep the edge.',
    body: "Think you see something the models don't? Draw your own line on the chart. If you're right and the crowd is wrong, you earn more per dollar than anyone else.",
  },
] as const

const PROTOCOL_FEATURES: readonly NumberedItem[] = [
  {
    num: '01',
    kicker: 'Token Pairs',
    title: 'Start with the familiar',
    body: 'In its early stages, LevX will support common crypto markets like BTC, SOL, and ETH with USDC or USDT parity.',
  },
  {
    num: '02',
    kicker: 'Quantum Reality',
    title: 'A novel scoring engine.',
    body: 'Visualize the many possible realities you can wager on. Each path is comprised of checkpoints that accrue P&L actively as time persists.',
  },
  {
    num: '03',
    kicker: 'AI Providers',
    title: 'Internal & external models compete',
    body: 'Multiple AI providers offer price paths that users can select and use as a wager base. Multipliers reflect how the market has priced each path.',
  },
  {
    num: '04',
    kicker: 'Custom Path',
    title: 'Draw your own conviction',
    body: "Beat the AI, keep the edge. Think you see something the models don't? Draw your own line. If you're right and the crowd is wrong, you earn more per dollar than anyone else.",
  },
  {
    num: '05',
    kicker: 'Leverage',
    title: 'Size up your bets',
    body: 'Leverage cap scales with market length. Shorter markets carry higher ceilings.',
  },
] as const

function NumberedBlock({ num, kicker, title, body }: NumberedItem) {
  return (
    <Card>
      <header className="border-line/80 flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-ink-muted font-mono text-nano tracking-[0.22em] uppercase">
          {num} <span className="text-ink-dim">·</span> {kicker}
        </span>
        <span
          aria-hidden="true"
          className="bg-brand-to inline-block h-1 w-1 rounded-full"
          style={{ boxShadow: '0 0 6px rgba(92, 247, 139, 0.9)' }}
        />
      </header>
      <div className="px-4 py-4">
        <h3 className="text-ink-strong text-body font-sans leading-snug tracking-tight">
          {title}
        </h3>
        <p className="text-ink-muted text-body-sm mt-2 font-sans leading-normal">
          {body}
        </p>
      </div>
    </Card>
  )
}

function FeatureBlock({ num, kicker, title, body }: NumberedItem) {
  return (
    <Card>
      <header className="border-line/60 flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="bg-brand-to inline-block h-1 w-1 rounded-full"
            style={{ boxShadow: '0 0 6px rgba(92, 247, 139, 0.9)' }}
          />
          <span className="text-ink-muted font-mono text-nano tracking-[0.22em] uppercase">
            {kicker}
          </span>
        </div>
        <span className="text-ink-dim font-mono text-nano tracking-[0.22em]">{num}</span>
      </header>
      <div className="px-4 py-4">
        <h3 className="text-ink-strong text-body font-sans leading-snug tracking-tight">
          {title}
        </h3>
        <p className="text-ink-muted text-body-sm mt-2 font-sans leading-relaxed">
          {body}
        </p>
      </div>
    </Card>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface relative overflow-hidden rounded-lg border border-white/10">
      {children}
    </div>
  )
}
