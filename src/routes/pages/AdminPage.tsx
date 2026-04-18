import { useEffect, useRef, useMemo, useState } from 'react'
import { AnchorProvider, BN, parseIdlErrors, translateError } from '@coral-xyz/anchor'
import { PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'

import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'

import { ChevronDown, Info } from 'lucide-react'

import { Button } from '@/components/Button'
import { ChartFrame } from '@/components/ChartFrame'
import { Input } from '@/components/Input'
import { Label } from '@/components/Label'
import { LevXChart } from '@/components/LevXChart'
import { PageLayout } from '@/layouts/PageLayout'
import { cn } from '@/lib/cn'
import type { PathTone, PredictionPath, PricePoint } from '@/types/market'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { useProgram } from '@/lib/solana/program'
import { deriveMarketPda, deriveProtocolPda } from '@/lib/solana/pda'
import { toast } from '@/stores/toastStore'
import { useWalletStore } from '@/stores/walletStore'
import type { SupportedPair } from '@/lib/pyth/feedIds'
import { usePythFeed, useLatestPrice } from '@/lib/pyth/hooks'
import { useBenchmarksHistory } from '@/lib/pyth/useBenchmarksHistory'
import { feedIdForPair } from '@/lib/pyth/feedIds'

/* ── Pair config ─────────────────────────────────────────── */

const PAIRS: { label: SupportedPair; baseMint: string; quoteMint: string }[] = [
  {
    label: 'SOL/USDC',
    baseMint: 'So11111111111111111111111111111111111111112',
    quoteMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // devnet USDC
  },
  {
    label: 'BTC/USDC',
    baseMint: '3BZPwbcqB5kKScF3TEXxwNfx5ipV13kbRVDvfVp5c6fv', // devnet wrapped BTC
    quoteMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
  },
  {
    label: 'ETH/USDC',
    baseMint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // devnet wrapped ETH
    quoteMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
  },
]

/* ── Duration units ──────────────────────────────────────── */

type DurationUnit = 'days' | 'months' | 'years'

const DURATION_UNITS: { id: DurationUnit; label: string; toHours: (n: number) => number }[] = [
  { id: 'days', label: 'Days', toHours: (n) => n * 24 },
  { id: 'months', label: 'Months', toHours: (n) => n * 30 * 24 },
  { id: 'years', label: 'Years', toHours: (n) => n * 365 * 24 },
]

const INTERVAL_PRESETS = [
  { label: '15m', sec: 900 },
  { label: '30m', sec: 1800 },
  { label: '1h', sec: 3600 },
  { label: '2h', sec: 7200 },
  { label: '4h', sec: 14400 },
]

/* ── AI provider options ─────────────────────────────────── */

const AI_PROVIDERS = [
  { id: 'chronos-2', label: 'Chronos-2', type: 'Foundation' },
  { id: 'timesfm-2.5', label: 'TimesFM 2.5', type: 'Foundation' },
  { id: 'gjr-garch', label: 'GJR-GARCH', type: 'Statistical' },
  { id: 'merton-jd', label: 'Merton Jump-Diffusion', type: 'Statistical' },
  { id: 'copula-ensemble', label: 'Copula Ensemble', type: 'Ensemble' },
  { id: 'monte-carlo', label: 'Monte Carlo K-Means', type: 'Simulation' },
]

/* ── Preview path generation ─────────────────────────────── */

/**
 * Build N randomized preview paths rooted at `basePrice`.
 * Slopes are evenly interpolated from +0.20 to -0.20 so every path
 * is visually distinct regardless of count. Tones assigned by slope sign.
 */
function buildPreviewPaths(
  count: number,
  basePrice: number,
  startTime: number,
  intervalSec: number,
  totalCheckpoints: number,
  seed: number,
): PredictionPath[] {
  const intervalMs = intervalSec * 1000

  return Array.from({ length: count }, (_, idx) => {
    // Evenly space slopes from +0.20 (most bullish) to -0.20 (most bearish)
    const t = count === 1 ? 0.5 : idx / (count - 1) // 0..1
    const slope = 0.20 - t * 0.40 // +0.20 → -0.20

    // Assign tone from slope magnitude
    const tone: PathTone =
      slope > 0.12 ? 'ultra-bull' :
      slope > 0.04 ? 'bull' :
      slope > -0.04 ? 'neutral' :
      slope > -0.12 ? 'bear' :
      'ultra-bear'
    // Paths start from the market open time, anchored at base price
    const data: PricePoint[] = Array.from({ length: totalCheckpoints + 1 }, (_, i) => {
      const p = i / totalCheckpoints
      const wiggle = i === 0 ? 0 : Math.sin((i + idx * 3 + seed) * 0.4) * basePrice * 0.012
      const drift = i === 0 ? 0 : Math.cos((i * 0.17) + idx * 1.3) * basePrice * 0.008
      return {
        time: startTime + i * intervalMs,
        value: basePrice * (1 + slope * p) + wiggle + drift,
      }
    })

    return {
      id: `preview-${idx}`,
      label: `Path ${String.fromCharCode(65 + idx)}`,
      tone,
      origin: 'ai' as const,
      multiplier: 0,
      data,
      pathIndex: idx,
      predictedPrices: data.map((d) => d.value),
      numCheckpoints: totalCheckpoints,
      generationTimestamp: startTime,
      creator: '',
      cumulativeAction: 0,
      compositeScore: 0,
      peakAmplitude: 1_000_000,
      amplitudeAtDecoherence: 0,
      dissolved: false,
      dissolvedAtCheckpoint: 0,
      checkpointsProcessed: 0,
      totalWagered: 0,
      totalLeveragedExposure: 0,
      lmsrSharesOutstanding: 0,
      totalTimeWeightedExposure: 0,
      currentImpliedProbability: Math.round(10_000 / count),
    }
  })
}

/* ── Helpers ─────────────────────────────────────────────── */

function feedIdToBytes(hexFeedId: string): number[] {
  const hex = hexFeedId.startsWith('0x') ? hexFeedId.slice(2) : hexFeedId
  const bytes: number[] = []
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

/* ── Provider select dropdown ────────────────────────────── */

function ProviderSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = AI_PROVIDERS.find((p) => p.id === value) ?? AI_PROVIDERS[0]

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative flex-1" style={{ zIndex: open ? 50 : 'auto' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between',
          'font-mono text-[11px] text-ink uppercase tracking-wide',
          'cursor-pointer',
        )}
      >
        {selected.label}
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={cn(
            'text-ink-dim duration-short ease-levx transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className={cn(
          'absolute left-0 top-[calc(100%+6px)] z-overlay min-w-[360px]',
          'border-line-strong bg-surface-1 rounded-lg border py-1',
          'shadow-[0_4px_20px_rgba(0,0,0,0.6)]',
        )}>
          {AI_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                'flex w-full items-center justify-between px-3 py-2',
                'font-mono text-[11px] uppercase tracking-wide',
                'duration-short ease-levx transition-[background-color,color]',
                p.id === value ? 'text-ink-strong' : 'text-ink-muted',
                'hover:bg-surface-2 hover:text-ink-strong',
              )}
              onClick={() => {
                onChange(p.id)
                setOpen(false)
              }}
            >
              <span>{p.label}</span>
              <span className="text-ink-dim text-[9px] tracking-wider">{p.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Info tooltip ────────────────────────────────────────── */

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1.5 inline-flex cursor-help">
      <Info size={12} strokeWidth={1.5} className="text-ink-dim" />
      <span className={cn(
        'pointer-events-none absolute bottom-full left-1/2 z-toast mb-2 -translate-x-1/2',
        'w-56 rounded border border-line-strong bg-surface-1 px-3 py-2',
        'font-mono text-[10px] leading-relaxed text-ink-muted',
        'opacity-0 transition-opacity duration-short ease-levx',
        'group-hover:opacity-100',
      )}>
        {text}
      </span>
    </span>
  )
}

/** Format a unix-ms timestamp as a local yyyy-MM-ddTHH:mm string for datetime-local inputs. */
function toLocalDatetime(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

import { CU_LIMITS, GRADIENT, SCALE } from '@/lib/constants'

import { CHIP, CHIP_ACTIVE, CHIP_INACTIVE } from '@/components/styles'

/* ── Page ────────────────────────────────────────────────── */

export function AdminPage() {
  const program = useProgram()
  const publicKey = useWalletStore((s) => s.publicKey)
  const isAdmin = useIsAdmin()

  // Form state
  const [selectedPair, setSelectedPair] = useState(0)
  const [startTimeInput, setStartTimeInput] = useState(() => toLocalDatetime(Date.now() + 5 * 60 * 1000))
  const [durationValue, setDurationValue] = useState(7)
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days')
  const durationHours = DURATION_UNITS.find((u) => u.id === durationUnit)!.toHours(durationValue)
  const [checkpointInterval, setCheckpointInterval] = useState(3600)
  const [lambda, setLambda] = useState('0')
  const [decoherenceRate, setDecoherenceRate] = useState('0.5')
  const [minimumProbability, setMinimumProbability] = useState('0.01')
  const [nudgeRate, setNudgeRate] = useState('0.05')
  const [pathMaxAge, setPathMaxAge] = useState('1800')
  const [numPaths, setNumPaths] = useState(5)
  const [pathProviders, setPathProviders] = useState<string[]>(() =>
    Array.from({ length: 7 }, (_, i) => AI_PROVIDERS[i % AI_PROVIDERS.length].id),
  )

  // Tx state
  const [isPending, setIsPending] = useState(false)

  const pair = PAIRS[selectedPair]
  const pairLabel = pair.label
  const feedId = feedIdForPair(pairLabel)

  // Live price feed
  usePythFeed(feedId)
  const latestTick = useLatestPrice(feedId)

  // Historical candles for chart backdrop
  const { data: benchmarks, isLoading: isBenchmarksLoading } = useBenchmarksHistory({
    pair: pairLabel,
    interval: '1h',
  })

  // Compute chart time boundaries from form state
  const now = Date.now()
  const chartMarketStart = new Date(startTimeInput).getTime() || now
  const chartMarketEnd = chartMarketStart + durationHours * 3600 * 1000
  const chartTotalCheckpoints = Math.floor((durationHours * 3600) / checkpointInterval)

  // Use benchmarks as history; fallback to empty
  const chartHistory = useMemo(() => benchmarks ?? [], [benchmarks])

  // Derive base price from latest tick or last benchmark candle.
  // PythTick exposes the price as `value` (not `price`) — see src/lib/pyth/types.ts.
  const basePrice = latestTick?.value ?? chartHistory[chartHistory.length - 1]?.value ?? 0

  // Build preview AI paths (stable seed from pair index so they don't flicker)
  const previewPaths = useMemo(
    () =>
      basePrice > 0
        ? buildPreviewPaths(numPaths, basePrice, chartMarketStart, checkpointInterval, chartTotalCheckpoints, selectedPair)
        : [],
    [numPaths, basePrice, chartMarketStart, checkpointInterval, chartTotalCheckpoints, selectedPair],
  )

  if (!isAdmin) {
    return (
      <PageLayout title="Admin" subtitle="Connect an admin wallet to access this page.">
        {null}
      </PageLayout>
    )
  }

  async function handleCreateMarket() {
    if (!program || !publicKey) return
    if (!feedId) {
      toast.error('No Pyth feed configured for this pair')
      return
    }
    setIsPending(true)

    try {
      const [protocolPda] = deriveProtocolPda()

      // Read protocol state to get next market_id
      const protocolAcc = await program.account.protocolState.fetch(protocolPda)
      const nextMarketId = protocolAcc.totalMarketsCreated.toNumber()
      const [marketPda] = deriveMarketPda(nextMarketId)

      const startTime = Math.floor(new Date(startTimeInput).getTime() / 1000)
      const endTime = startTime + durationHours * 3600

      const vaultKeypair = Keypair.generate()
      const quoteMint = new PublicKey(pair.quoteMint)
      const creatorTokenAccount = await getAssociatedTokenAddress(quoteMint, publicKey)

      const params = {
        baseMint: new PublicKey(pair.baseMint),
        quoteMint,
        pythFeedId: feedIdToBytes(feedId),
        startTime: new BN(startTime),
        endTime: new BN(endTime),
        checkpointInterval,
        actionAlpha: new BN(Math.round(0.7 * SCALE)),
        actionBeta: new BN(Math.round(0.3 * SCALE)),
        decoherenceRate: new BN(Math.round(parseFloat(decoherenceRate) * SCALE)),
        minimumProbability: new BN(Math.round(parseFloat(minimumProbability) * SCALE)),
        nudgeRate: new BN(Math.round(parseFloat(nudgeRate) * SCALE)),
        pathMaxAge: new BN(parseInt(pathMaxAge)),
        lambda: new BN(Math.round(parseFloat(lambda) * SCALE)),
        referenceAction: new BN(1 * SCALE),
        weightQv: new BN(Math.round(0.25 * SCALE)),
        weightDd: new BN(Math.round(0.25 * SCALE)),
        weightEndpoint: new BN(Math.round(0.25 * SCALE)),
        weightDisplacement: new BN(Math.round(0.25 * SCALE)),
      }

      const ix = await program.methods
        .createMarket(params)
        .accountsPartial({
          protocolState: protocolPda,
          market: marketPda,
          vault: vaultKeypair.publicKey,
          collateralMint: quoteMint,
          insuranceFund: protocolAcc.insuranceFund,
          creatorTokenAccount,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()

      const provider = program.provider as AnchorProvider
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const finalIxs = await buildTransaction({
        instructions: [ix],
        computeUnitLimit: CU_LIMITS.createMarket,
        priorityFeeMicroLamports,
      })
      const tx = new Transaction().add(...finalIxs)
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx, [vaultKeypair])
      } catch (sendErr) {
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }

      toast.success('Market created', { txSig: sig })
    } catch (err) {
      toast.error('Failed to create market', { message: (err as Error).message })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <PageLayout title="Create" subtitle="Set market details and create" className="max-w-none">

      {/* ── Pair selection (above chart) ───────────────────── */}
      <div className="mb-4 flex gap-2">
        {PAIRS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            className={cn(CHIP, i === selectedPair ? CHIP_ACTIVE : CHIP_INACTIVE)}
            onClick={() => setSelectedPair(i)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_420px] items-start gap-10">
      {/* ── Left column (chart + path providers) ──────────── */}
      <div className="flex flex-col gap-6">
        <ChartFrame glow>
          <LevXChart
            history={chartHistory}
            predictions={previewPaths}
            nowTime={now}
            marketStart={chartMarketStart}
            marketEnd={chartMarketEnd}
            pair={pairLabel}
            isLoading={isBenchmarksLoading}
            error={null}
            height={520}
            market={{
              startTime: chartMarketStart,
              checkpointInterval,
              totalCheckpoints: chartTotalCheckpoints,
            }}
          />
        </ChartFrame>

        {/* ── AI path provider assignment ─────────────────── */}
        <div>
          <div className="mb-5 flex items-center justify-between">
            <Label>AI path providers</Label>
            <div className="flex gap-1.5">
              {[3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border',
                    'font-mono text-[9px] tracking-wide',
                    'duration-short ease-levx transition-[border-color,color]',
                    'cursor-pointer',
                    n === numPaths
                      ? 'border-ink-strong text-ink-strong'
                      : 'border-line-strong text-ink-muted hover:border-ink hover:text-ink',
                  )}
                  onClick={() => setNumPaths(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2" style={{ position: 'relative' }}>
            {previewPaths.map((path, idx) => (
              <div
                key={path.id}
                className={cn(
                  'relative flex items-center gap-4 rounded-lg px-4 py-2.5',
                  'border border-line',
                  'duration-short ease-levx transition-[border-color]',
                  'hover:border-line-strong',
                )}
              >
                <span className="text-ink-dim font-mono text-[10px] w-5 shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: GRADIENT.css }}
                />
                <ProviderSelect
                  value={pathProviders[idx] ?? AI_PROVIDERS[0].id}
                  onChange={(id) => {
                    const next = [...pathProviders]
                    next[idx] = id
                    setPathProviders(next)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Market config form (right) ───────────────────── */}
      <div>
        {/* Start time */}
        <Label className="mb-3">Market start</Label>
        <div className="mb-12 flex items-end gap-3">
          <input
            type="datetime-local"
            value={startTimeInput}
            onChange={(e) => setStartTimeInput(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className={cn(
              'border-line-strong flex-1 border-b bg-transparent py-2',
              'font-mono text-sm text-ink-strong',
              'focus:border-ink-strong focus:outline-none',
            )}
          />
          <button
            type="button"
            className={cn(CHIP, CHIP_INACTIVE, 'shrink-0')}
            onClick={() => setStartTimeInput(toLocalDatetime(Date.now() + 5 * 60 * 1000))}
          >
            Now + 5min
          </button>
        </div>

        {/* Duration */}
        <Label className="mb-3">Market duration</Label>
        <div className="mb-12 flex items-end gap-3">
          <input
            type="number"
            min={1}
            max={durationUnit === 'years' ? 1 : durationUnit === 'months' ? 12 : 365}
            value={durationValue}
            onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
            className={cn(
              'border-line-strong w-20 border-b bg-transparent py-2 text-center',
              'font-mono text-sm text-ink-strong',
              'focus:border-ink-strong focus:outline-none',
            )}
          />
          <div className="flex gap-2">
            {DURATION_UNITS.map((u) => (
              <button
                key={u.id}
                type="button"
                className={cn(CHIP, u.id === durationUnit ? CHIP_ACTIVE : CHIP_INACTIVE)}
                onClick={() => {
                  setDurationUnit(u.id)
                  if (u.id === 'years') setDurationValue(Math.min(durationValue, 1))
                  if (u.id === 'months') setDurationValue(Math.min(durationValue, 12))
                }}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Checkpoint interval */}
        <Label>Checkpoint interval</Label>
        <div className="mt-3 mb-12 flex gap-2">
          {INTERVAL_PRESETS.map((p) => (
            <button
              key={p.sec}
              type="button"
              className={cn(CHIP, p.sec === checkpointInterval ? CHIP_ACTIVE : CHIP_INACTIVE)}
              onClick={() => setCheckpointInterval(p.sec)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Protocol params */}
        <Label className="block mb-3">Protocol parameters</Label>
        <div className="mb-12 grid grid-cols-2 gap-x-6 gap-y-8">
          <div>
            <span className="text-label text-ink-muted font-mono uppercase flex items-center">
              Lambda
              <InfoTip text="0 = pure LMSR pricing. Higher values blend quantum eigendecomposition, making path prices correlated based on trajectory similarity." />
            </span>
            <Input value={lambda} onChange={(e) => setLambda(e.target.value)} />
          </div>
          <div>
            <span className="text-label text-ink-muted font-mono uppercase flex items-center">
              Decoherence rate
              <InfoTip text="How fast paths decay when predictions deviate from reality. 0.5 = 50% decay per checkpoint. Higher = faster elimination." />
            </span>
            <Input value={decoherenceRate} onChange={(e) => setDecoherenceRate(e.target.value)} />
          </div>
          <div>
            <span className="text-label text-ink-muted font-mono uppercase flex items-center">
              Min probability
              <InfoTip text="Floor probability (0.01 = 1%). When a path's Born probability drops below this, it dissolves and its pool redistributes to survivors." />
            </span>
            <Input value={minimumProbability} onChange={(e) => setMinimumProbability(e.target.value)} />
          </div>
          <div>
            <span className="text-label text-ink-muted font-mono uppercase flex items-center">
              Path max age
              <InfoTip text="Seconds. AI paths must be submitted within this window of market start to be accepted. 1800 = 30 min. Prevents stale predictions." />
            </span>
            <Input value={pathMaxAge} onChange={(e) => setPathMaxAge(e.target.value)} />
          </div>
          <div>
            <span className="text-label text-ink-muted font-mono uppercase flex items-center">
              Nudge rate
              <InfoTip text="LMSR oracle nudge fraction per checkpoint (0.05 = 5%). Zero-sum adjustment that rewards accurate paths and penalises deviating ones." />
            </span>
            <Input value={nudgeRate} onChange={(e) => setNudgeRate(e.target.value)} />
          </div>
        </div>

        {/* Submit */}
        <Button
          variant="primary"
          fullWidth
          disabled={isPending || !program}
          onClick={handleCreateMarket}
        >
          {isPending ? 'Creating…' : 'Create Market'}
        </Button>

      </div>
      </div>
    </PageLayout>
  )
}
