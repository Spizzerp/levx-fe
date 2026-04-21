import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'

import { useNavigate } from '@tanstack/react-router'

import { MarketPreview } from '@/features/market/MarketPreview'

/**
 * Typewriter headline — reveals one character at a time after an optional
 * delay, then leaves a blinking cursor at the end. Respects
 * prefers-reduced-motion (shows the full string immediately) via the CSS
 * rule on `.typing-cursor`, since the JS interval itself is near-harmless
 * but we still want to not make the cursor strobe.
 */
function TypingHeadline({
  text,
  startAfter = 0,
  speed = 55,
  className,
}: {
  text: string
  startAfter?: number
  speed?: number
  className?: string
}) {
  // `started` guards the cursor + text so nothing renders during the pre-roll.
  // Without it, the blinking cursor would appear alone before `startAfter`
  // elapses and look like a stray glyph on the empty page.
  const [started, setStarted] = useState(false)
  const [chars, setChars] = useState(0)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    const startTimer = setTimeout(() => {
      setStarted(true)
      intervalId = setInterval(() => {
        setChars((n) => {
          if (n >= text.length) {
            if (intervalId) clearInterval(intervalId)
            return n
          }
          return n + 1
        })
      }, speed)
    }, startAfter)

    return () => {
      clearTimeout(startTimer)
      if (intervalId) clearInterval(intervalId)
    }
  }, [text, startAfter, speed])

  return (
    <h1 className={className} aria-label={text}>
      {started && (
        <>
          <span aria-hidden="true">{text.slice(0, chars)}</span>
          <span aria-hidden="true" className="typing-cursor" />
        </>
      )}
    </h1>
  )
}

/** X (Twitter) glyph — mirrors the one used in CommonLayout's footer. */
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
import { mulberry32, normalRandom } from '@/lib/rng'
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'
import type { PricePoint } from '@/types/market'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const CHECKPOINT_INTERVAL_SEC = 3600
const TOTAL_CHECKPOINTS = 168
const BASE_PRICE = 65_000

function buildMockHistory(now: number): PricePoint[] {
  const rng = mulberry32(0xbee5)
  const points: PricePoint[] = []
  let price = BASE_PRICE
  for (let i = 0; i < TOTAL_CHECKPOINTS; i++) {
    const time = now - (TOTAL_CHECKPOINTS - i) * HOUR_MS
    if (i > 0) {
      const z = normalRandom(rng)
      price = price * (1 + 0.0001 + 0.004 * z)
    }
    points.push({ time, value: price })
  }
  return points
}

export function LandingPage() {
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())
  // Flips true after the card's 1.4s rise animation so the chart's dashed
  // marker lines (NOW / OPENS / END) appear only once the card is settled.
  const [markersReady, setMarkersReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMarkersReady(true), 1500)
    return () => clearTimeout(t)
  }, [])
  const { history, predictions, marketStart, marketEnd } = useMemo(() => {
    const marketStart = now - 2 * DAY_MS
    const marketEnd = now + 5 * DAY_MS
    const history = buildMockHistory(now)
    // Anchor predictions at the history price at marketStart so the paths
    // fan out from the point where the price line crosses the start marker.
    const startPoint = history.find((p) => p.time >= marketStart) ?? history[history.length - 1]
    const predictions = buildAiPathFixture({
      startTime: marketStart,
      checkpointInterval: CHECKPOINT_INTERVAL_SEC,
      totalCheckpoints: TOTAL_CHECKPOINTS,
      basePrice: startPoint?.value ?? BASE_PRICE,
    })
    return { history, predictions, marketStart, marketEnd }
  }, [now])

  const goToApp = () => navigate({ to: '/markets' })

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      <div className="landing-dither" aria-hidden="true" />

      <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-6 py-4">
        <img src="/logo_color.png" alt="LevX" className="h-12 w-auto" />
        <div className="flex items-center gap-4">
          <a
            href="https://x.com/LevXtrade"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LevX on X"
            className="text-ink-strong duration-short ease-levx transition-opacity hover:opacity-70"
          >
            <XIcon size={16} />
          </a>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LevX docs"
            className="text-ink-strong duration-short ease-levx transition-opacity hover:opacity-70"
          >
            <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="relative flex h-full flex-col items-center justify-between px-6 pt-32 pb-6 sm:px-10 sm:pt-40 sm:pb-10">
        {/* Typewriter headline — starts after the card's 1.4s rise animation
            finishes so the two animations don't overlap. */}
        <TypingHeadline
          text="Predict the path, not the outcome"
          startAfter={1500}
          className="text-ink-strong font-display text-display-sm text-center font-medium tracking-tight"
        />

        {/* zoom: 0.7 uniformly scales the card's rendered size AND its layout
            footprint — text, padding, chart, rail width all shrink by the
            same factor, unlike tweaking max-w + chartHeight piecemeal. */}
        <div
          className={`border-line-strong bg-surface landing-rise mx-auto w-full max-w-[1440px] rounded-2xl border-2 p-5 sm:p-7${
            markersReady ? '' : ' hide-chart-markers'
          }`}
          style={{ zoom: 0.7 }}
        >
          <MarketPreview
            pair="BTC/USDC"
            history={history}
            predictions={predictions}
            now={now}
            marketStart={marketStart}
            marketEnd={marketEnd}
            checkpointInterval={CHECKPOINT_INTERVAL_SEC}
            totalCheckpoints={TOTAL_CHECKPOINTS}
            chartHeight={420}
            onCtaClick={goToApp}
          />
        </div>
      </div>
    </main>
  )
}
