import { useMemo, useState } from 'react'

import { Link } from '@tanstack/react-router'

import { Button } from '@/components/Button'
import { ChartFrame } from '@/components/ChartFrame'
import { LevXChart } from '@/components/LevXChart'
import { buildAiPathFixture } from '@/tests/fixtures/aiPaths'
import type { PricePoint } from '@/types/market'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const CHECKPOINT_INTERVAL_SEC = 3600
const TOTAL_CHECKPOINTS = 168
const BASE_PRICE = 65_000

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalRandom(rng: () => number): number {
  const u1 = rng() || 1e-10
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

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
  const [now] = useState(() => Date.now())
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

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center px-6 py-4">
        <img src="/logo_color.png" alt="LevX" className="h-12 w-auto" />
      </div>

      <div className="flex min-h-screen items-center justify-center px-10 pt-28 pb-10">
        <div className="w-full max-w-[960px]">
          <h1 className="text-ink-strong font-display mb-8 text-center text-3xl font-medium tracking-tight">
            Predict the path not the outcome
          </h1>
          <ChartFrame glow className="pointer-events-none select-none">
            <LevXChart
              height={560}
              history={history}
              predictions={predictions}
              nowTime={now}
              marketStart={marketStart}
              marketEnd={marketEnd}
              pair={null}
              selectionInteractive={false}
              market={{
                startTime: marketStart,
                checkpointInterval: CHECKPOINT_INTERVAL_SEC,
                totalCheckpoints: TOTAL_CHECKPOINTS,
              }}
            />
          </ChartFrame>
          <div className="mt-8 flex justify-center">
            <Link to="/markets">
              <Button variant="primary">Launch</Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
