import { useEffect, useRef, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnchorProvider, BN, parseIdlErrors, translateError } from '@coral-xyz/anchor'
import { PublicKey, Keypair, SYSVAR_RENT_PUBKEY, SystemProgram, Transaction } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token'

import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'

import { ChevronDown, Info } from 'lucide-react'

import { Button } from '@/ui/Button'
import { ChartFrame } from '@/features/chart/ChartFrame'
import { Input } from '@/ui/Input'
import { Label } from '@/ui/Label'
import { LevXChart } from '@/features/chart/LevXChart'
import { PageLayout } from '@/layouts/PageLayout'
import { SegmentedSlider } from '@/ui/SegmentedSlider'
import { cn } from '@/lib/cn'
import { formatAiPathLabel } from '@/lib/pathLabels'
import type { PathTone, PredictionPath, PricePoint } from '@/types/market'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { useProgram, getReadOnlyProgram } from '@/lib/solana/program'
import {
  deriveMarketGroupLinkPda,
  deriveMarketGroupPda,
  deriveMarketPda,
  deriveProtocolPda,
} from '@/lib/solana/pda'
import { logTransactionError } from '@/lib/solana/logTransactionError'
import { resolveBaseMintLabel } from '@/lib/api/pairLabels'
import { toast } from '@/stores/toastStore'
import { useWalletStore } from '@/stores/walletStore'
import { usePythFeed, useLatestPrice } from '@/lib/pyth/hooks'
import { useBenchmarksHistory, useLazyHistoryTrigger } from '@/lib/pyth/useBenchmarksHistory'
import { isBytes32Hex, normalizeBytes32Hex } from '@/lib/marketGroups'

/* ── Pair config ─────────────────────────────────────────── */

interface PairOption {
  label: string
  baseMint: string
  quoteMint: string
  /** 64-char hex feed id (no 0x). Always present — gating submit on this. */
  feedIdHex: string
}

/* ── Duration units ──────────────────────────────────────── */

type DurationUnit = 'days' | 'months' | 'years'

const DURATION_UNITS: { id: DurationUnit; label: string; toHours: (n: number) => number }[] = [
  { id: 'days', label: 'Days', toHours: (n) => n * 24 },
  { id: 'months', label: 'Months', toHours: (n) => n * 30 * 24 },
  { id: 'years', label: 'Years', toHours: (n) => n * 365 * 24 },
]

// Mirrors `validate_checkpoint_schedule` in programs/levx/src/instructions/create_market.rs.
// Chunked path uploads now allow up to 12 chunks × 40 checkpoint prices.
const MIN_CHECKPOINTS = 4
const MAX_CHECKPOINTS = 480
const CHECKPOINT_OPTIONS = [
  4, 8, 12, 16, 24, 36, 42, 48, 60, 72, 84, 90, 96, 120, 144, 150, 180, 240, 300, 360, 365, 480,
] as const

function formatInterval(sec: number): string {
  if (sec >= 3600 && sec % 3600 === 0) return `${sec / 3600}h`
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60}m`
  return `${sec}s`
}

function clampCheckpointCount(count: number): number {
  return Math.max(MIN_CHECKPOINTS, Math.min(MAX_CHECKPOINTS, Math.round(count)))
}

function nearestCheckpointOption(count: number): number {
  const clamped = clampCheckpointCount(count)
  return CHECKPOINT_OPTIONS.reduce((best, option) =>
    Math.abs(option - clamped) < Math.abs(best - clamped) ? option : best,
  )
}

function naturalCheckpointTarget(durationHours: number): number {
  const durationSeconds = Math.max(1, Math.round(durationHours * 3600))
  const daySeconds = 24 * 3600
  const naturalInterval =
    durationSeconds <= daySeconds
      ? 3600
      : durationSeconds <= 3 * daySeconds
        ? 2 * 3600
        : durationSeconds <= 14 * daySeconds
          ? 4 * 3600
          : durationSeconds <= 60 * daySeconds
            ? 12 * 3600
            : daySeconds

  return nearestCheckpointOption(Math.floor(durationSeconds / naturalInterval))
}

/* ── AI provider options ─────────────────────────────────── */

const AI_PROVIDERS = [{ id: 'internal-levx', label: 'Internal LevX', type: 'Ensemble' }] as const

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
    const slope = 0.2 - t * 0.4 // +0.20 → -0.20

    // Assign tone from slope magnitude
    const tone: PathTone =
      slope > 0.12
        ? 'ultra-bull'
        : slope > 0.04
          ? 'bull'
          : slope > -0.04
            ? 'neutral'
            : slope > -0.12
              ? 'bear'
              : 'ultra-bear'
    // Paths start from the market open time, anchored at base price
    const data: PricePoint[] = Array.from({ length: totalCheckpoints + 1 }, (_, i) => {
      const p = i / totalCheckpoints
      const wiggle = i === 0 ? 0 : Math.sin((i + idx * 3 + seed) * 0.4) * basePrice * 0.012
      const drift = i === 0 ? 0 : Math.cos(i * 0.17 + idx * 1.3) * basePrice * 0.008
      return {
        time: startTime + i * intervalMs,
        value: basePrice * (1 + slope * p) + wiggle + drift,
      }
    })

    return {
      id: `preview-${idx}`,
      label: formatAiPathLabel(tone),
      tone,
      origin: 'ai' as const,
      // Fresh markets start at uniform probability, so 1 / (1 / count) = count.
      multiplier: count > 0 ? count : 0,
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
      createdAtCheckpoint: 0,
      firstActiveCheckpoint: 0,
      totalWagered: 0,
      totalLeveragedExposure: 0,
      lmsrSharesOutstanding: 0,
      totalTimeWeightedExposure: 0,
      currentImpliedProbability: Math.round(10_000 / count),
      initialAmplitude: 1_000_000,
    }
  })
}

/* ── Helpers ─────────────────────────────────────────────── */

/**
 * Decode a Pyth feed id (0x-prefixed or bare 64-char hex) into the
 * 32-byte array the IDL expects. Throws on malformed input — callers
 * should validate up front and surface a friendly toast rather than
 * relying on the throw.
 */
function feedIdToBytes(hexFeedId: string): number[] {
  const hex = hexFeedId.startsWith('0x') ? hexFeedId.slice(2) : hexFeedId
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`Pyth feed id must be 64 hex chars (got ${hex.length})`)
  }
  const bytes: number[] = []
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

/** Inverse of `feedIdToBytes`: 32-byte array → 64-char lowercase hex. */
function bytesToFeedIdHex(bytes: number[] | Uint8Array): string {
  const arr = Array.from(bytes)
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** True iff the input is a 64-char hex string (with optional `0x`). */
function isValidFeedIdHex(input: string): boolean {
  const hex = input.trim().startsWith('0x') ? input.trim().slice(2) : input.trim()
  return /^[0-9a-fA-F]{64}$/.test(hex)
}

/* ── Provider select dropdown ────────────────────────────── */

function ProviderSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
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
          'text-label text-ink font-mono tracking-wide uppercase',
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
        <div
          className={cn(
            'z-overlay absolute top-[calc(100%+6px)] left-0 min-w-[360px]',
            'border-line-strong bg-surface-1 rounded-lg border py-1',
            'shadow-[0_4px_20px_rgba(0,0,0,0.6)]',
          )}
        >
          {AI_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                'flex w-full items-center justify-between px-3 py-2',
                'text-label font-mono tracking-wide uppercase',
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
              <span className="text-ink-dim text-label tracking-wider">{p.type}</span>
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
      <span
        className={cn(
          'z-toast pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2',
          'border-line-strong bg-surface-1 w-56 rounded border px-3 py-2',
          'text-label text-ink-muted font-mono leading-relaxed',
          'duration-short ease-levx opacity-0 transition-opacity',
          'group-hover:opacity-100',
        )}
      >
        {text}
      </span>
    </span>
  )
}

/** Format a unix-ms timestamp as a local yyyy-MM-ddTHH:mm string for datetime-local inputs. */
/**
 * Read `protocol_state.supported_pairs[..numSupportedPairs]` and shape
 * each as a PairOption usable by the Create form. Pair labels for
 * unknown mints fall back to a truncated render via `pairLabels`.
 *
 * 60s stale cache is sufficient — the operator only changes this when
 * they explicitly run `add_supported_pair` and a refresh after that
 * call is acceptable latency. PR2's event invalidation isn't wired
 * here because `add_supported_pair` doesn't emit a tracked event;
 * this hook is the source of truth.
 */
function useOnChainSupportedPairs() {
  return useQuery<PairOption[]>({
    queryKey: ['protocolSupportedPairs'],
    queryFn: async () => {
      const program = getReadOnlyProgram()
      const [protocolPda] = deriveProtocolPda()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ps: any = await program.account.protocolState.fetch(protocolPda)
      const num: number = ps.numSupportedPairs as number
      const out: PairOption[] = []
      for (let i = 0; i < num; i++) {
        const tp = ps.supportedPairs[i]
        if (!tp || !tp.active) continue
        const baseMint: PublicKey = tp.baseMint
        const quoteMint: PublicKey = tp.quoteMint
        const feedHex = bytesToFeedIdHex(tp.pythFeedId as number[])
        const label = resolveBaseMintLabel(baseMint).pair
        out.push({
          label,
          baseMint: baseMint.toBase58(),
          quoteMint: quoteMint.toBase58(),
          feedIdHex: feedHex,
        })
      }
      return out
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

function toLocalDatetime(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

import { CU_LIMITS, GRADIENT, SCALE } from '@/lib/constants'

import { CHIP, CHIP_ACTIVE, CHIP_INACTIVE } from '@/ui/styles'

/* ── Page ────────────────────────────────────────────────── */

export function AdminPage() {
  const navigate = useNavigate()
  const { group: groupSearchParam } = useSearch({ from: '/admin/create' })
  const program = useProgram()
  const publicKey = useWalletStore((s) => s.publicKey)
  const isAdmin = useIsAdmin()

  // Form state
  const [selectedPair, setSelectedPair] = useState(0)
  const [startTimeInput, setStartTimeInput] = useState(() =>
    toLocalDatetime(Date.now() + 5 * 60 * 1000),
  )
  const [durationValue, setDurationValue] = useState(7)
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days')
  const durationHours = DURATION_UNITS.find((u) => u.id === durationUnit)!.toHours(durationValue)
  const autoCheckpointTarget = useMemo(
    () => naturalCheckpointTarget(durationHours),
    [durationHours],
  )
  const [checkpointTarget, setCheckpointTarget] = useState(() => naturalCheckpointTarget(7 * 24))
  const previousAutoCheckpointTarget = useRef(checkpointTarget)
  const [lambda, setLambda] = useState('0')
  const [decoherenceRate, setDecoherenceRate] = useState('0.5')
  const [minimumProbability, setMinimumProbability] = useState('0.01')
  const [nudgeRate, setNudgeRate] = useState('0.05')
  const [pathMaxAge, setPathMaxAge] = useState('1800')
  const [numPaths, setNumPaths] = useState(5)
  const [groupKeyHashInput, setGroupKeyHashInput] = useState(() => groupSearchParam ?? '')

  // Tx state
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    setCheckpointTarget((current) => {
      const wasStillAuto = current === previousAutoCheckpointTarget.current
      previousAutoCheckpointTarget.current = autoCheckpointTarget
      return wasStillAuto ? autoCheckpointTarget : clampCheckpointCount(current)
    })
  }, [autoCheckpointTarget])

  useEffect(() => {
    setGroupKeyHashInput(groupSearchParam ?? '')
  }, [groupSearchParam])

  // Drive the pair dropdown solely from on-chain protocol_state.supportedPairs.
  // Hardcoded pairs were a bootstrap convenience but their (baseMint, quoteMint)
  // mints don't necessarily match what's registered on-chain — and create_market
  // enforces both sides match a registered pair, so anything else just errors.
  const { data: onChainPairs = [] } = useOnChainSupportedPairs()
  const availablePairs = useMemo<PairOption[]>(() => {
    const merged: PairOption[] = [...onChainPairs]
    return merged
  }, [onChainPairs])

  const pair = availablePairs[selectedPair] ?? availablePairs[0]
  const pairLabel = pair?.label ?? ''
  // Hex prefix matches feedIdForPair() outputs ("0x…") so usePythFeed
  // and useBenchmarksHistory keep accepting the same shape.
  const feedId = pair?.feedIdHex ? `0x${pair.feedIdHex}` : null

  // Live price feed
  usePythFeed(feedId)
  const latestTick = useLatestPrice(feedId)

  // Historical candles for chart backdrop
  const {
    data: benchmarks,
    isLoading: isBenchmarksLoading,
    fetchOlder,
    hasMoreHistory,
    isFetchingOlder,
  } = useBenchmarksHistory({
    pair: pairLabel,
    interval: '1h',
  })

  const onChartViewportChange = useLazyHistoryTrigger({
    history: benchmarks,
    hasMoreHistory,
    isFetchingOlder,
    fetchOlder,
  })

  // Compute chart time boundaries from form state
  const now = Date.now()
  const chartMarketStart = new Date(startTimeInput).getTime() || now
  const chartMarketEnd = chartMarketStart + durationHours * 3600 * 1000
  const durationSeconds = Math.max(1, Math.round(durationHours * 3600))
  const checkpointInterval = Math.max(1, Math.ceil(durationSeconds / checkpointTarget))
  const totalCheckpoints = Math.floor(durationSeconds / checkpointInterval)
  const checkpointsValid =
    totalCheckpoints >= MIN_CHECKPOINTS && totalCheckpoints <= MAX_CHECKPOINTS

  // Use benchmarks as history; fallback to empty
  const chartHistory = useMemo(() => benchmarks ?? [], [benchmarks])

  // Derive base price from latest tick or last benchmark candle.
  // PythTick exposes the price as `value` (not `price`) — see src/lib/pyth/types.ts.
  const basePrice = latestTick?.value ?? chartHistory[chartHistory.length - 1]?.value ?? 0

  // Build preview AI paths (stable seed from pair index so they don't flicker)
  const previewPaths = useMemo(
    () =>
      basePrice > 0
        ? buildPreviewPaths(
            numPaths,
            basePrice,
            chartMarketStart,
            checkpointInterval,
            totalCheckpoints,
            selectedPair,
          )
        : [],
    [numPaths, basePrice, chartMarketStart, checkpointInterval, totalCheckpoints, selectedPair],
  )

  if (!isAdmin) {
    return (
      <PageLayout title="Admin" subtitle="Connect an admin wallet to access this page.">
        {null}
      </PageLayout>
    )
  }

  async function handleCreateMarket() {
    if (!program || !publicKey || !pair) return
    if (!pair.feedIdHex || !isValidFeedIdHex(pair.feedIdHex)) {
      toast.error('No valid Pyth feed configured for this pair')
      return
    }
    setIsPending(true)

    try {
      const [protocolPda] = deriveProtocolPda()

      // Read protocol state to get next market_id and the canonical collateral mint
      const protocolAcc = await program.account.protocolState.fetch(protocolPda)
      const nextMarketId = protocolAcc.totalMarketsCreated.toNumber()
      const [marketPda] = deriveMarketPda(nextMarketId)

      // Pre-flight: the program enforces `has_one = collateral_mint` on
      // protocol_state, so the pair's quote mint must equal the protocol's
      // configured collateral mint. Catch the mismatch here with a clear
      // toast instead of letting it bubble up as InvalidCollateralMint (6029).
      const protocolCollateralMint = (protocolAcc.collateralMint as PublicKey).toBase58()
      if (pair.quoteMint !== protocolCollateralMint) {
        toast.error(
          `Pair quote mint (${pair.quoteMint.slice(0, 6)}…) ` +
            `doesn't match protocol collateral mint (${protocolCollateralMint.slice(0, 6)}…). ` +
            `Either pick a pair whose quote mint is the protocol collateral, ` +
            `or call update_collateral_mint.`,
        )
        setIsPending(false)
        return
      }

      // The on-chain `validate_checkpoint_schedule` rejects counts <4 or >480
      // with CheckpointMismatch (6008). Catch it here with a clear message
      // instead of letting it surface as a generic simulation failure.
      if (!checkpointsValid) {
        toast.error('Checkpoint count out of range', {
          message:
            `Got ${totalCheckpoints}; must be between ${MIN_CHECKPOINTS} and ${MAX_CHECKPOINTS}. ` +
            `Adjust the duration or checkpoint count.`,
        })
        setIsPending(false)
        return
      }

      const startTime = Math.floor(new Date(startTimeInput).getTime() / 1000)
      const endTime = startTime + durationHours * 3600

      const vaultKeypair = Keypair.generate()
      const quoteMint = new PublicKey(pair.quoteMint)
      const creatorTokenAccount = await getAssociatedTokenAddress(quoteMint, publicKey)
      const normalizedGroupKeyHash = groupKeyHashInput.trim()
        ? normalizeBytes32Hex(groupKeyHashInput)
        : null

      const params = {
        baseMint: new PublicKey(pair.baseMint),
        quoteMint,
        pythFeedId: feedIdToBytes(pair.feedIdHex),
        startTime: new BN(startTime),
        endTime: new BN(endTime),
        checkpointInterval,
        actionAlpha: new BN(Math.round(0.7 * SCALE)),
        actionBeta: new BN(Math.round(0.3 * SCALE)),
        decoherenceRate: new BN(Math.round(parseFloat(decoherenceRate) * SCALE)),
        minimumProbability: new BN(Math.round(parseFloat(minimumProbability) * SCALE)),
        nudgeRate: new BN(Math.round(parseFloat(nudgeRate) * SCALE)),
        pathMaxAge: new BN(parseInt(pathMaxAge)),
        targetNumPaths: numPaths,
        lambda: new BN(Math.round(parseFloat(lambda) * SCALE)),
        referenceAction: new BN(1 * SCALE),
        weightQv: new BN(Math.round(0.25 * SCALE)),
        weightDd: new BN(Math.round(0.25 * SCALE)),
        weightEndpoint: new BN(Math.round(0.25 * SCALE)),
        weightDisplacement: new BN(Math.round(0.25 * SCALE)),
        lmsrAlpha: new BN(1_000_000),
      }

      const marketGroupPda = normalizedGroupKeyHash
        ? deriveMarketGroupPda(normalizedGroupKeyHash)[0]
        : null
      const marketGroupLinkPda = normalizedGroupKeyHash
        ? deriveMarketGroupLinkPda(nextMarketId)[0]
        : null

      const ix = normalizedGroupKeyHash
        ? await program.methods
            .createMarketUnderGroup(params)
            .accountsPartial({
              protocolState: protocolPda,
              marketGroup: marketGroupPda!,
              market: marketPda,
              marketGroupLink: marketGroupLinkPda!,
              vault: vaultKeypair.publicKey,
              collateralMint: quoteMint,
              insuranceFund: protocolAcc.insuranceFund,
              creatorTokenAccount,
              creator: publicKey,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .instruction()
        : await program.methods
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

      // Idempotent ATA creation for the creator. If the admin wallet has never
      // held USDC, the ATA doesn't exist and create_market hits AccountNotInitialized.
      const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        creatorTokenAccount,
        publicKey,
        quoteMint,
      )

      const finalIxs = await buildTransaction({
        instructions: [createAtaIx, ix],
        computeUnitLimit: CU_LIMITS.createMarket,
        priorityFeeMicroLamports,
      })
      const tx = new Transaction().add(...finalIxs)
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx, [vaultKeypair])
      } catch (sendErr) {
        await logTransactionError('admin.createMarket sendAndConfirm failed', sendErr, {
          connection: provider.connection,
          details: {
            adminWallet: publicKey.toBase58(),
            marketId: nextMarketId,
            pair: pair.label,
            baseMint: pair.baseMint,
            quoteMint: pair.quoteMint,
            protocolPda: protocolPda.toBase58(),
            marketPda: marketPda.toBase58(),
            marketGroupPda: marketGroupPda?.toBase58(),
            marketGroupLinkPda: marketGroupLinkPda?.toBase58(),
            vault: vaultKeypair.publicKey.toBase58(),
            creatorTokenAccount: creatorTokenAccount.toBase58(),
            instructionLabels: [
              '0: setComputeUnitLimit',
              '1: setComputeUnitPrice',
              '2: createAssociatedTokenAccountIdempotent',
              normalizedGroupKeyHash ? '3: createMarketUnderGroup' : '3: createMarket',
            ],
          },
        })
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }

      toast.success('Market created', { txSig: sig })
      void navigate({ to: '/market/$id', params: { id: String(nextMarketId) } })
    } catch (err) {
      toast.error('Failed to create market', { message: (err as Error).message })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <PageLayout title="Create" subtitle="Set market details and create" className="max-w-none">
      {/* ── Pair selection (above chart) ───────────────────── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {availablePairs.map((p, i) => (
          <button
            key={`${p.baseMint}-${p.quoteMint}`}
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
              onViewportChange={onChartViewportChange}
              height={520}
              market={{
                startTime: chartMarketStart,
                checkpointInterval,
                totalCheckpoints: totalCheckpoints,
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
                      'text-label font-mono tracking-wide',
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
                    'border-line border',
                    'duration-short ease-levx transition-[border-color]',
                    'hover:border-line-strong',
                  )}
                >
                  <span className="text-ink-dim text-label w-5 shrink-0 font-mono">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: GRADIENT.css }}
                  />
                  <ProviderSelect value={AI_PROVIDERS[0].id} onChange={() => undefined} />
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
                'text-ink-strong font-mono text-sm',
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
                'text-ink-strong font-mono text-sm',
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

          {/* Checkpoint schedule */}
          <div className="mb-12">
            <div className="mb-3.5 flex items-baseline justify-between">
              <Label>Checkpoint schedule</Label>
              <span
                className={cn(
                  'text-body-sm font-mono font-bold',
                  checkpointsValid ? 'text-ink-strong' : 'text-accent',
                )}
              >
                {totalCheckpoints}
              </span>
            </div>
            <SegmentedSlider
              value={checkpointTarget}
              min={MIN_CHECKPOINTS}
              max={MAX_CHECKPOINTS}
              values={CHECKPOINT_OPTIONS}
              onChange={setCheckpointTarget}
              formatAriaValue={(value) => `${value} checkpoints`}
            />
            <div className="text-ink-dim text-caption mt-2.5 flex justify-between font-mono uppercase">
              <span>{MIN_CHECKPOINTS} MIN</span>
              <span>{MAX_CHECKPOINTS} MAX</span>
            </div>
            <div className="text-caption mt-3 font-mono tracking-wide">
              <span className={cn(checkpointsValid ? 'text-ink-strong' : 'text-accent')}>
                {totalCheckpoints}
              </span>
              <span className="text-ink-muted"> checkpoints · </span>
              <span className="text-ink-strong">{formatInterval(checkpointInterval)}</span>
              <span className="text-ink-muted"> apart</span>
              {!checkpointsValid && (
                <span className="text-accent">
                  {' '}
                  (must be {MIN_CHECKPOINTS}–{MAX_CHECKPOINTS})
                </span>
              )}
            </div>
          </div>

          {/* Protocol params */}
          <Label className="mb-3 block">Protocol parameters</Label>
          <div className="mb-12 grid grid-cols-2 gap-x-6 gap-y-8">
            <div>
              <span className="text-label text-ink-muted flex items-center font-mono uppercase">
                Lambda
                <InfoTip text="0 = pure LMSR pricing. Higher values blend quantum eigendecomposition, making path prices correlated based on trajectory similarity." />
              </span>
              <Input value={lambda} onChange={(e) => setLambda(e.target.value)} />
            </div>
            <div>
              <span className="text-label text-ink-muted flex items-center font-mono uppercase">
                Decoherence rate
                <InfoTip text="How fast paths decay when predictions deviate from reality. 0.5 = 50% decay per checkpoint. Higher = faster elimination." />
              </span>
              <Input value={decoherenceRate} onChange={(e) => setDecoherenceRate(e.target.value)} />
            </div>
            <div>
              <span className="text-label text-ink-muted flex items-center font-mono uppercase">
                Min probability
                <InfoTip text="Floor probability (0.01 = 1%). When a path's Born probability drops below this, it dissolves and its pool redistributes to survivors." />
              </span>
              <Input
                value={minimumProbability}
                onChange={(e) => setMinimumProbability(e.target.value)}
              />
            </div>
            <div>
              <span className="text-label text-ink-muted flex items-center font-mono uppercase">
                Path max age
                <InfoTip text="Seconds. AI paths must be submitted within this window of market start to be accepted. 1800 = 30 min. Prevents stale predictions." />
              </span>
              <Input value={pathMaxAge} onChange={(e) => setPathMaxAge(e.target.value)} />
            </div>
            <div>
              <span className="text-label text-ink-muted flex items-center font-mono uppercase">
                Nudge rate
                <InfoTip text="LMSR oracle nudge fraction per checkpoint (0.05 = 5%). Zero-sum adjustment that rewards accurate paths and penalises deviating ones." />
              </span>
              <Input value={nudgeRate} onChange={(e) => setNudgeRate(e.target.value)} />
            </div>
          </div>

          <Label className="mb-3 block">Hierarchy</Label>
          <div className="mb-12">
            <Input
              label="Market group hash"
              value={groupKeyHashInput}
              onChange={(e) => setGroupKeyHashInput(e.target.value)}
              placeholder="Optional 32-byte hex group key"
            />
            {groupKeyHashInput && !isBytes32Hex(groupKeyHashInput) && (
              <p className="text-accent text-caption mt-3 font-mono">
                Group hash must be 64 hex chars, optionally 0x-prefixed.
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            variant="primary"
            fullWidth
            disabled={
              isPending ||
              !program ||
              !checkpointsValid ||
              (groupKeyHashInput.trim().length > 0 && !isBytes32Hex(groupKeyHashInput))
            }
            onClick={handleCreateMarket}
          >
            {isPending
              ? 'Creating…'
              : groupKeyHashInput.trim()
                ? 'Create Market Under Group'
                : 'Create Market'}
          </Button>
        </div>
      </div>

      {/* ── Operator: register a new supported pair ── */}
      <AddSupportedPairForm />

      {/* ── Operator: manage existing supported pairs ── */}
      <ManageSupportedPairsTable />
    </PageLayout>
  )
}

/**
 * Operator-only form for `add_supported_pair`. Registers a new
 * `(baseMint, quoteMint, pythFeedId)` triple in `protocolState.supportedPairs[]`,
 * unlocking it for `create_market` calls. Authority must equal the
 * connected wallet (the program checks `protocolState.authority`).
 */
function AddSupportedPairForm() {
  const program = useProgram()
  const { publicKey } = useWalletStore()
  const [baseMint, setBaseMint] = useState('')
  const [quoteMint, setQuoteMint] = useState('')
  const [pythFeedId, setPythFeedId] = useState('')
  const [pending, setPending] = useState(false)

  const handleSubmit = async () => {
    if (!program || !publicKey) return
    if (!isValidFeedIdHex(pythFeedId)) {
      toast.error('Invalid Pyth feed id', {
        message:
          'Must be exactly 64 hex characters (with optional 0x prefix). A typo would silently encode missing bytes as zero and register a broken oracle feed.',
      })
      return
    }
    setPending(true)
    try {
      const baseKey = new PublicKey(baseMint.trim())
      const quoteKey = new PublicKey(quoteMint.trim())
      const feedBytes = feedIdToBytes(pythFeedId.trim())
      const [protocolPda] = deriveProtocolPda()

      const ix = await program.methods
        .addSupportedPair(baseKey, quoteKey, feedBytes)
        .accountsPartial({ protocolState: protocolPda, authority: publicKey })
        .instruction()

      const provider = program.provider as AnchorProvider
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const finalIxs = await buildTransaction({
        instructions: [ix],
        computeUnitLimit: 100_000,
        priorityFeeMicroLamports,
      })
      const tx = new Transaction().add(...finalIxs)
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx)
      } catch (sendErr) {
        await logTransactionError('admin.addSupportedPair sendAndConfirm failed', sendErr, {
          connection: provider.connection,
          details: {
            adminWallet: publicKey.toBase58(),
            baseMint: baseKey.toBase58(),
            quoteMint: quoteKey.toBase58(),
            protocolPda: protocolPda.toBase58(),
            instructionLabels: [
              '0: setComputeUnitLimit',
              '1: setComputeUnitPrice',
              '2: addSupportedPair',
            ],
          },
        })
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }
      toast.success('Supported pair added', { txSig: sig })
      setBaseMint('')
      setQuoteMint('')
      setPythFeedId('')
    } catch (err) {
      toast.error('Failed to add supported pair', { message: (err as Error).message })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="border-line mt-16 border-t pt-12">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-ink-strong text-caption font-mono font-bold tracking-wide uppercase">
          Add supported pair
        </h2>
        <span className="text-ink-dim text-caption font-mono">
          Operator-only · governs `protocol_state.supported_pairs`
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 [@media(min-width:1181px)]:grid-cols-3">
        <Input
          label="Base mint"
          value={baseMint}
          onChange={(e) => setBaseMint(e.target.value)}
          placeholder="So11…Sol mint"
        />
        <Input
          label="Quote mint"
          value={quoteMint}
          onChange={(e) => setQuoteMint(e.target.value)}
          placeholder="USDC mint"
        />
        <Input
          label="Pyth feed id (hex)"
          value={pythFeedId}
          onChange={(e) => setPythFeedId(e.target.value)}
          placeholder="0xef0d…56d"
        />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={pending || !program || !baseMint || !quoteMint || !isValidFeedIdHex(pythFeedId)}
          onClick={handleSubmit}
        >
          {pending ? 'Submitting…' : 'Add pair'}
        </Button>
        {pythFeedId && !isValidFeedIdHex(pythFeedId) && (
          <span className="text-accent text-caption font-mono">
            Feed id must be 64 hex chars (optionally 0x-prefixed)
          </span>
        )}
      </div>
    </section>
  )
}

/**
 * Operator-only table that lists every entry in
 * `protocol_state.supported_pairs[..numSupportedPairs]` with a delete
 * action per row. Calls the on-chain `remove_supported_pair(index)`,
 * which swap-removes the slot — the last entry moves into the deleted
 * slot, the tail is zeroed, and the count decrements.
 *
 * Slot indices are NOT stable across removals (per the program's
 * caller-contract documentation), so this table always re-fetches
 * after a successful removal rather than mutating its cached list.
 *
 * Each row's "remove" requires a confirm-click: a 2-step state
 * machine (`confirmingIndex`) gates the actual mutation, so a stray
 * click can't silently nuke a slot.
 */
function ManageSupportedPairsTable() {
  const program = useProgram()
  const { publicKey } = useWalletStore()
  const { data: pairs = [], isLoading } = useOnChainSupportedPairs()
  const queryClient = useQueryClient()
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)

  const handleRemove = async (index: number) => {
    if (!program || !publicKey) return
    if (confirmingIndex !== index) {
      setConfirmingIndex(index)
      return
    }
    setPendingIndex(index)
    try {
      const [protocolPda] = deriveProtocolPda()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ix = await (program.methods as any)
        .removeSupportedPair(index)
        .accountsPartial({ protocolState: protocolPda, authority: publicKey })
        .instruction()

      const provider = program.provider as AnchorProvider
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const finalIxs = await buildTransaction({
        instructions: [ix],
        computeUnitLimit: 50_000,
        priorityFeeMicroLamports,
      })
      const tx = new Transaction().add(...finalIxs)
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx)
      } catch (sendErr) {
        await logTransactionError('admin.removeSupportedPair sendAndConfirm failed', sendErr, {
          connection: provider.connection,
          details: {
            adminWallet: publicKey.toBase58(),
            pairIndex: index,
            protocolPda: protocolPda.toBase58(),
            instructionLabels: [
              '0: setComputeUnitLimit',
              '1: setComputeUnitPrice',
              '2: removeSupportedPair',
            ],
          },
        })
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }
      toast.success('Supported pair removed', { txSig: sig })
      // Indices shift after a swap-remove — invalidate so the table
      // re-fetches fresh state rather than rendering stale slot data.
      queryClient.invalidateQueries({ queryKey: ['protocolSupportedPairs'] })
      setConfirmingIndex(null)
    } catch (err) {
      toast.error('Failed to remove supported pair', {
        message: (err as Error).message,
      })
    } finally {
      setPendingIndex(null)
    }
  }

  return (
    <section className="border-line mt-16 border-t pt-12">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-ink-strong text-caption font-mono font-bold tracking-wide uppercase">
          Manage supported pairs
        </h2>
        <span className="text-ink-dim text-caption font-mono">
          {pairs.length} on-chain · slot indices shift on removal
        </span>
      </div>
      {isLoading && <p className="text-ink-dim text-caption font-mono">Loading on-chain pairs…</p>}
      {!isLoading && pairs.length === 0 && (
        <p className="text-ink-dim text-caption font-mono">
          No supported pairs registered. Use the form above to add one.
        </p>
      )}
      {pairs.length > 0 && (
        <div className="border-line overflow-hidden rounded-lg border">
          <table className="text-caption w-full font-mono">
            <thead className="border-line text-ink-dim border-b">
              <tr>
                <th className="px-4 py-3 text-left">Slot</th>
                <th className="px-4 py-3 text-left">Pair</th>
                <th className="px-4 py-3 text-left">Base mint</th>
                <th className="px-4 py-3 text-left">Quote mint</th>
                <th className="px-4 py-3 text-left">Pyth feed (head)</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p, i) => {
                const isConfirming = confirmingIndex === i
                const isThisPending = pendingIndex === i
                return (
                  <tr
                    key={`${p.baseMint}-${p.quoteMint}-${i}`}
                    className="border-line border-b last:border-b-0"
                  >
                    <td className="text-ink-dim px-4 py-3">{i}</td>
                    <td className="text-ink-strong px-4 py-3">{p.label}</td>
                    <td className="text-ink-dim px-4 py-3">
                      {p.baseMint.slice(0, 6)}…{p.baseMint.slice(-4)}
                    </td>
                    <td className="text-ink-dim px-4 py-3">
                      {p.quoteMint.slice(0, 6)}…{p.quoteMint.slice(-4)}
                    </td>
                    <td className="text-ink-dim px-4 py-3">{p.feedIdHex.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={isConfirming ? 'destructive' : 'ghost'}
                        disabled={
                          !program || isThisPending || (pendingIndex !== null && pendingIndex !== i)
                        }
                        onClick={() => handleRemove(i)}
                      >
                        {isThisPending ? 'Removing…' : isConfirming ? 'Confirm remove' : 'Remove'}
                      </Button>
                      {isConfirming && !isThisPending && (
                        <Button variant="ghost" onClick={() => setConfirmingIndex(null)}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
