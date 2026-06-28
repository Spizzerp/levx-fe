import { useNavigate } from '@tanstack/react-router'
import { AnchorProvider, BN, parseIdlErrors, translateError } from '@coral-xyz/anchor'
import { FolderPlus, Link2, Plus, ShieldCheck, Trash2, Unlink2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'

import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { cn } from '@/lib/cn'
import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { useMarkets, useMode2Readiness } from '@/lib/api/hooks'
import { formatUSD } from '@/lib/format'
import { SCALE } from '@/lib/constants'
import { useCloseMarket, useProgram } from '@/lib/solana'
import {
  deriveLeverageConfigPda,
  deriveMarketGroupLinkPda,
  deriveMarketGroupPda,
  deriveMarketPda,
  derivePairRiskStatePda,
  deriveProtocolPda,
} from '@/lib/solana/pda'
import { logTransactionError } from '@/lib/solana/logTransactionError'
import {
  DEFAULT_PUBKEY,
  MARKET_GROUP_KIND_OPTIONS,
  MARKET_GROUP_STATUS_OPTIONS,
  MARKET_GROUP_TIMEFRAME_OPTIONS,
  anchorEnum,
  buildMarketGroupConstraintParams,
  bytes32HexToArray,
  isBytes32Hex,
  normalizeBytes32Hex,
} from '@/lib/marketGroups'
import { toast } from '@/stores/toastStore'
import { useWalletStore } from '@/stores/walletStore'
import type { Market, MarketGroupKind, MarketGroupStatus, PairRiskStatus } from '@/types/market'

function canCloseMarket(market: Market): boolean {
  return (
    (market.state === 'settled' || market.state === 'void') &&
    market.traders === 0 &&
    market.numPaths === 0
  )
}

function closeMarketDisabledReason(market: Market): string {
  if (market.traders > 0) return 'All positions must be claimed or exited first'
  if (market.numPaths > 0) return 'Path accounts and chunks must be closed first'
  return 'Close market'
}

function isPubkey(value: string): boolean {
  try {
    new PublicKey(value)
    return true
  } catch {
    return false
  }
}

function parseBoundedInt(label: string, value: string, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`)
  }
  return parsed
}

function parseUsdcBn(label: string, value: string): BN {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero`)
  }
  return new BN(Math.round(parsed * SCALE))
}

function MarketGroupAdminPanel() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const program = useProgram()
  const publicKey = useWalletStore((s) => s.publicKey)
  const [groupKeyHash, setGroupKeyHash] = useState('')
  const [parentGroupKeyHash, setParentGroupKeyHash] = useState('')
  const [metadataHash, setMetadataHash] = useState('')
  const [groupKind, setGroupKind] = useState<MarketGroupKind>('season')
  const [groupStatus, setGroupStatus] = useState<MarketGroupStatus>('active')
  const [pairConstraintEnabled, setPairConstraintEnabled] = useState(false)
  const [feedConstraintEnabled, setFeedConstraintEnabled] = useState(false)
  const [timeWindowConstraintEnabled, setTimeWindowConstraintEnabled] = useState(false)
  const [timeframeConstraintEnabled, setTimeframeConstraintEnabled] = useState(false)
  const [constraintBaseMint, setConstraintBaseMint] = useState('')
  const [constraintQuoteMint, setConstraintQuoteMint] = useState('')
  const [constraintPythFeedId, setConstraintPythFeedId] = useState('')
  const [constraintStartTime, setConstraintStartTime] = useState('')
  const [constraintEndTime, setConstraintEndTime] = useState('')
  const [constraintTimeframes, setConstraintTimeframes] = useState<number[]>([])
  const [linkMarketId, setLinkMarketId] = useState('')
  const [linkGroupKeyHash, setLinkGroupKeyHash] = useState('')
  const [recoveryMarketId, setRecoveryMarketId] = useState('')
  const [recoveryGroupKeyHash, setRecoveryGroupKeyHash] = useState('')
  const [pendingAction, setPendingAction] = useState<
    'create' | 'link' | 'unlink' | 'close-group' | null
  >(null)
  const constraintValues = useMemo(
    () => ({
      pairEnabled: pairConstraintEnabled,
      feedEnabled: feedConstraintEnabled,
      timeWindowEnabled: timeWindowConstraintEnabled,
      timeframeMaskEnabled: timeframeConstraintEnabled,
      baseMint: constraintBaseMint,
      quoteMint: constraintQuoteMint,
      pythFeedId: constraintPythFeedId,
      startTime: constraintStartTime,
      endTime: constraintEndTime,
      timeframeSeconds: constraintTimeframes,
    }),
    [
      pairConstraintEnabled,
      feedConstraintEnabled,
      timeWindowConstraintEnabled,
      timeframeConstraintEnabled,
      constraintBaseMint,
      constraintQuoteMint,
      constraintPythFeedId,
      constraintStartTime,
      constraintEndTime,
      constraintTimeframes,
    ],
  )
  const constraintError = useMemo(() => {
    try {
      buildMarketGroupConstraintParams(constraintValues)
      return ''
    } catch (err) {
      return (err as Error).message
    }
  }, [constraintValues])

  const canCreateGroup =
    !!program &&
    !!publicKey &&
    isBytes32Hex(groupKeyHash) &&
    (!parentGroupKeyHash || isBytes32Hex(parentGroupKeyHash)) &&
    (!metadataHash || isBytes32Hex(metadataHash)) &&
    !constraintError
  const canLinkMarket =
    !!program &&
    !!publicKey &&
    isBytes32Hex(linkGroupKeyHash) &&
    Number.isInteger(Number(linkMarketId)) &&
    Number(linkMarketId) >= 0
  const canUnlinkMarket =
    !!program &&
    !!publicKey &&
    isBytes32Hex(recoveryGroupKeyHash) &&
    Number.isInteger(Number(recoveryMarketId)) &&
    Number(recoveryMarketId) >= 0
  const canCloseGroup = !!program && !!publicKey && isBytes32Hex(recoveryGroupKeyHash)

  async function handleCreateGroup() {
    if (!program || !publicKey || !canCreateGroup) return
    setPendingAction('create')
    try {
      const normalizedGroupHash = normalizeBytes32Hex(groupKeyHash)
      const normalizedParentHash = parentGroupKeyHash ? normalizeBytes32Hex(parentGroupKeyHash) : ''
      const [protocolPda] = deriveProtocolPda()
      const [marketGroupPda] = deriveMarketGroupPda(normalizedGroupHash)
      const parentGroupPda = normalizedParentHash
        ? deriveMarketGroupPda(normalizedParentHash)[0]
        : null
      const params = {
        groupKeyHash: bytes32HexToArray(normalizedGroupHash),
        parentGroup: parentGroupPda ?? DEFAULT_PUBKEY,
        hasParent: parentGroupPda !== null,
        kind: anchorEnum(groupKind),
        status: anchorEnum(groupStatus),
        ...buildMarketGroupConstraintParams(constraintValues),
        metadataHash: bytes32HexToArray(metadataHash || '00'.repeat(32)),
      }
      const ix = await program.methods
        .createMarketGroup(params)
        .accountsPartial({
          protocolState: protocolPda,
          marketGroup: marketGroupPda,
          parentGroupAccount: parentGroupPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction()
      const provider = program.provider as AnchorProvider
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const tx = new Transaction().add(
        ...(await buildTransaction({
          instructions: [ix],
          computeUnitLimit: 100_000,
          priorityFeeMicroLamports,
        })),
      )
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx)
      } catch (sendErr) {
        await logTransactionError('admin.createMarketGroup sendAndConfirm failed', sendErr, {
          connection: provider.connection,
          details: {
            adminWallet: publicKey.toBase58(),
            groupKeyHash: normalizedGroupHash,
            marketGroupPda: marketGroupPda.toBase58(),
            parentGroupPda: parentGroupPda?.toBase58(),
            instructionLabels: [
              '0: setComputeUnitLimit',
              '1: setComputeUnitPrice',
              '2: createMarketGroup',
            ],
          },
        })
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }
      toast.success('Market group created', { txSig: sig })
      setLinkGroupKeyHash(normalizedGroupHash)
      setRecoveryGroupKeyHash(normalizedGroupHash)
    } catch (err) {
      toast.error('Failed to create market group', { message: (err as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleLinkMarket() {
    if (!program || !publicKey || !canLinkMarket) return
    setPendingAction('link')
    try {
      const marketId = Number(linkMarketId)
      const normalizedGroupHash = normalizeBytes32Hex(linkGroupKeyHash)
      const [protocolPda] = deriveProtocolPda()
      const [marketPda] = deriveMarketPda(marketId)
      const [marketGroupPda] = deriveMarketGroupPda(normalizedGroupHash)
      const [marketGroupLinkPda] = deriveMarketGroupLinkPda(marketId)
      const ix = await program.methods
        .linkExistingMarketToGroup()
        .accountsPartial({
          protocolState: protocolPda,
          marketGroup: marketGroupPda,
          market: marketPda,
          marketGroupLink: marketGroupLinkPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .instruction()
      const provider = program.provider as AnchorProvider
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const tx = new Transaction().add(
        ...(await buildTransaction({
          instructions: [ix],
          computeUnitLimit: 100_000,
          priorityFeeMicroLamports,
        })),
      )
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx)
      } catch (sendErr) {
        await logTransactionError(
          'admin.linkExistingMarketToGroup sendAndConfirm failed',
          sendErr,
          {
            connection: provider.connection,
            details: {
              adminWallet: publicKey.toBase58(),
              marketId,
              groupKeyHash: normalizedGroupHash,
              marketPda: marketPda.toBase58(),
              marketGroupPda: marketGroupPda.toBase58(),
              marketGroupLinkPda: marketGroupLinkPda.toBase58(),
              instructionLabels: [
                '0: setComputeUnitLimit',
                '1: setComputeUnitPrice',
                '2: linkExistingMarketToGroup',
              ],
            },
          },
        )
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }
      await queryClient.invalidateQueries({ queryKey: ['markets'] })
      await queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      toast.success('Market linked to group', { txSig: sig })
    } catch (err) {
      toast.error('Failed to link market', { message: (err as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleUnlinkMarket() {
    if (!program || !publicKey || !canUnlinkMarket) return
    const marketId = Number(recoveryMarketId)
    const normalizedGroupHash = normalizeBytes32Hex(recoveryGroupKeyHash)
    if (
      !window.confirm(`Unlink market ${marketId} from group ${normalizedGroupHash.slice(0, 8)}…?`)
    ) {
      return
    }
    setPendingAction('unlink')
    try {
      const [protocolPda] = deriveProtocolPda()
      const [marketPda] = deriveMarketPda(marketId)
      const [marketGroupPda] = deriveMarketGroupPda(normalizedGroupHash)
      const [marketGroupLinkPda] = deriveMarketGroupLinkPda(marketId)
      const ix = await program.methods
        .unlinkMarketFromGroup()
        .accountsPartial({
          protocolState: protocolPda,
          marketGroup: marketGroupPda,
          market: marketPda,
          marketGroupLink: marketGroupLinkPda,
          authority: publicKey,
        })
        .instruction()
      const provider = program.provider as AnchorProvider
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const tx = new Transaction().add(
        ...(await buildTransaction({
          instructions: [ix],
          computeUnitLimit: 100_000,
          priorityFeeMicroLamports,
        })),
      )
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx)
      } catch (sendErr) {
        await logTransactionError('admin.unlinkMarketFromGroup sendAndConfirm failed', sendErr, {
          connection: provider.connection,
          details: {
            adminWallet: publicKey.toBase58(),
            marketId,
            groupKeyHash: normalizedGroupHash,
            marketPda: marketPda.toBase58(),
            marketGroupPda: marketGroupPda.toBase58(),
            marketGroupLinkPda: marketGroupLinkPda.toBase58(),
            instructionLabels: [
              '0: setComputeUnitLimit',
              '1: setComputeUnitPrice',
              '2: unlinkMarketFromGroup',
            ],
          },
        })
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }
      await queryClient.invalidateQueries({ queryKey: ['markets'] })
      await queryClient.invalidateQueries({ queryKey: ['market', String(marketId)] })
      toast.success('Market unlinked from group', { txSig: sig })
    } catch (err) {
      toast.error('Failed to unlink market', { message: (err as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleCloseGroup() {
    if (!program || !publicKey || !canCloseGroup) return
    const normalizedGroupHash = normalizeBytes32Hex(recoveryGroupKeyHash)
    if (!window.confirm(`Close empty group ${normalizedGroupHash.slice(0, 8)}…?`)) return
    setPendingAction('close-group')
    try {
      const [protocolPda] = deriveProtocolPda()
      const [marketGroupPda] = deriveMarketGroupPda(normalizedGroupHash)
      const ix = await program.methods
        .closeMarketGroup()
        .accountsPartial({
          protocolState: protocolPda,
          marketGroup: marketGroupPda,
          authority: publicKey,
        })
        .instruction()
      const provider = program.provider as AnchorProvider
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const tx = new Transaction().add(
        ...(await buildTransaction({
          instructions: [ix],
          computeUnitLimit: 80_000,
          priorityFeeMicroLamports,
        })),
      )
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx)
      } catch (sendErr) {
        await logTransactionError('admin.closeMarketGroup sendAndConfirm failed', sendErr, {
          connection: provider.connection,
          details: {
            adminWallet: publicKey.toBase58(),
            groupKeyHash: normalizedGroupHash,
            marketGroupPda: marketGroupPda.toBase58(),
            instructionLabels: [
              '0: setComputeUnitLimit',
              '1: setComputeUnitPrice',
              '2: closeMarketGroup',
            ],
          },
        })
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }
      await queryClient.invalidateQueries({ queryKey: ['markets'] })
      toast.success('Market group closed', { txSig: sig })
    } catch (err) {
      toast.error('Failed to close market group', { message: (err as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  function toggleConstraintTimeframe(timeframeSeconds: number) {
    setConstraintTimeframes((current) =>
      current.includes(timeframeSeconds)
        ? current.filter((value) => value !== timeframeSeconds)
        : [...current, timeframeSeconds],
    )
  }

  return (
    <section className="border-line mb-10 border-b pb-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-ink-strong text-caption font-mono font-bold tracking-wide uppercase">
            Market groups
          </h2>
          <p className="text-ink-dim text-caption mt-1 font-mono">
            Metadata sidecars only · child markets settle independently
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={!isBytes32Hex(linkGroupKeyHash || groupKeyHash)}
          onClick={() =>
            void navigate({
              to: '/admin/create',
              search: { group: normalizeBytes32Hex(linkGroupKeyHash || groupKeyHash) },
            })
          }
        >
          <Plus size={14} strokeWidth={2} className="mr-2" />
          Market under group
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 [@media(min-width:1100px)]:grid-cols-3">
        <div className="border-line rounded-lg border p-5">
          <div className="mb-4 flex items-center gap-2">
            <FolderPlus size={15} strokeWidth={1.75} className="text-ink-muted" />
            <span className="text-ink-strong text-label font-mono uppercase">Create group</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Group key hash"
              value={groupKeyHash}
              onChange={(e) => setGroupKeyHash(e.target.value)}
              placeholder="32-byte hex"
            />
            <Input
              label="Parent group hash"
              value={parentGroupKeyHash}
              onChange={(e) => setParentGroupKeyHash(e.target.value)}
              placeholder="Optional 32-byte hex"
            />
            <Input
              label="Metadata hash"
              value={metadataHash}
              onChange={(e) => setMetadataHash(e.target.value)}
              placeholder="Optional 32-byte hex"
            />
            <div className="grid grid-cols-2 gap-4">
              <select
                value={groupKind}
                onChange={(e) => setGroupKind(e.target.value as MarketGroupKind)}
                className={cn(
                  'border-line-strong bg-surface text-ink-strong',
                  'rounded-lg border px-3 py-3 font-mono text-sm',
                )}
              >
                {MARKET_GROUP_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={groupStatus}
                onChange={(e) => setGroupStatus(e.target.value as MarketGroupStatus)}
                className={cn(
                  'border-line-strong bg-surface text-ink-strong',
                  'rounded-lg border px-3 py-3 font-mono text-sm',
                )}
              >
                {MARKET_GROUP_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="border-line rounded-lg border p-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-ink-muted flex items-center gap-2 font-mono text-xs uppercase">
                  <input
                    type="checkbox"
                    checked={pairConstraintEnabled}
                    onChange={(e) => setPairConstraintEnabled(e.target.checked)}
                  />
                  Pair
                </label>
                <label className="text-ink-muted flex items-center gap-2 font-mono text-xs uppercase">
                  <input
                    type="checkbox"
                    checked={feedConstraintEnabled}
                    onChange={(e) => setFeedConstraintEnabled(e.target.checked)}
                  />
                  Feed
                </label>
                <label className="text-ink-muted flex items-center gap-2 font-mono text-xs uppercase">
                  <input
                    type="checkbox"
                    checked={timeWindowConstraintEnabled}
                    onChange={(e) => setTimeWindowConstraintEnabled(e.target.checked)}
                  />
                  Time window
                </label>
                <label className="text-ink-muted flex items-center gap-2 font-mono text-xs uppercase">
                  <input
                    type="checkbox"
                    checked={timeframeConstraintEnabled}
                    onChange={(e) => setTimeframeConstraintEnabled(e.target.checked)}
                  />
                  Timeframes
                </label>
              </div>

              {pairConstraintEnabled && (
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <Input
                    label="Base mint"
                    value={constraintBaseMint}
                    onChange={(e) => setConstraintBaseMint(e.target.value)}
                    placeholder="Base mint pubkey"
                  />
                  <Input
                    label="Quote mint"
                    value={constraintQuoteMint}
                    onChange={(e) => setConstraintQuoteMint(e.target.value)}
                    placeholder="Quote mint pubkey"
                  />
                </div>
              )}

              {feedConstraintEnabled && (
                <Input
                  label="Pyth feed id"
                  value={constraintPythFeedId}
                  onChange={(e) => setConstraintPythFeedId(e.target.value)}
                  placeholder="32-byte hex"
                  className="mt-4"
                />
              )}

              {timeWindowConstraintEnabled && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Input
                    label="Start"
                    type="datetime-local"
                    value={constraintStartTime}
                    onChange={(e) => setConstraintStartTime(e.target.value)}
                  />
                  <Input
                    label="End"
                    type="datetime-local"
                    value={constraintEndTime}
                    onChange={(e) => setConstraintEndTime(e.target.value)}
                  />
                </div>
              )}

              {timeframeConstraintEnabled && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {MARKET_GROUP_TIMEFRAME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        'border-line rounded px-3 py-2 font-mono text-xs uppercase',
                        constraintTimeframes.includes(option.value)
                          ? 'bg-ink-strong text-surface'
                          : 'text-ink-muted',
                      )}
                      onClick={() => toggleConstraintTimeframe(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {constraintError && (
                <p className="text-bear mt-4 font-mono text-xs uppercase">{constraintError}</p>
              )}
            </div>
            <Button
              variant="secondary"
              disabled={!canCreateGroup || pendingAction === 'create'}
              onClick={handleCreateGroup}
            >
              {pendingAction === 'create' ? 'Creating' : 'Create group'}
            </Button>
          </div>
        </div>

        <div className="border-line rounded-lg border p-5">
          <div className="mb-4 flex items-center gap-2">
            <Link2 size={15} strokeWidth={1.75} className="text-ink-muted" />
            <span className="text-ink-strong text-label font-mono uppercase">Link market</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Market id"
              type="number"
              min={0}
              value={linkMarketId}
              onChange={(e) => setLinkMarketId(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Group key hash"
              value={linkGroupKeyHash}
              onChange={(e) => setLinkGroupKeyHash(e.target.value)}
              placeholder="32-byte hex"
            />
            <Button
              variant="secondary"
              disabled={!canLinkMarket || pendingAction === 'link'}
              onClick={handleLinkMarket}
            >
              {pendingAction === 'link' ? 'Linking' : 'Link market'}
            </Button>
          </div>
        </div>

        <div className="border-line rounded-lg border p-5">
          <div className="mb-4 flex items-center gap-2">
            <Unlink2 size={15} strokeWidth={1.75} className="text-ink-muted" />
            <span className="text-ink-strong text-label font-mono uppercase">Recovery</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Market id"
              type="number"
              min={0}
              value={recoveryMarketId}
              onChange={(e) => setRecoveryMarketId(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Group key hash"
              value={recoveryGroupKeyHash}
              onChange={(e) => setRecoveryGroupKeyHash(e.target.value)}
              placeholder="32-byte hex"
            />
            <div className="grid grid-cols-1 gap-3 [@media(min-width:1181px)]:grid-cols-2">
              <Button
                variant="secondary"
                disabled={!canUnlinkMarket || pendingAction === 'unlink'}
                onClick={handleUnlinkMarket}
              >
                {pendingAction === 'unlink' ? 'Unlinking' : 'Unlink'}
              </Button>
              <Button
                variant="destructive"
                disabled={!canCloseGroup || pendingAction === 'close-group'}
                onClick={handleCloseGroup}
              >
                {pendingAction === 'close-group' ? 'Closing' : 'Close group'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const PAIR_RISK_STATUS_OPTIONS: { value: PairRiskStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'drainOnly', label: 'Drain only' },
  { value: 'resetPending', label: 'Reset pending' },
  { value: 'paused', label: 'Paused' },
]
const MIN_LEVERAGE_CONFIG_DELAY_SECONDS = 86_400

function Mode2AdminPanel() {
  const queryClient = useQueryClient()
  const program = useProgram()
  const publicKey = useWalletStore((s) => s.publicKey)
  const { data: readiness } = useMode2Readiness()
  const [simulatorOutputHash, setSimulatorOutputHash] = useState('')
  const [activationDelaySeconds, setActivationDelaySeconds] = useState('86400')
  const [maxLeverage, setMaxLeverage] = useState('5')
  const [maxPairOi, setMaxPairOi] = useState('100000')
  const [maxMarketOi, setMaxMarketOi] = useState('40000')
  const [maxPathOi, setMaxPathOi] = useState('10000')
  const [maxClusterOi, setMaxClusterOi] = useState('25000')
  const [vaultUtilizationCeilingBps, setVaultUtilizationCeilingBps] = useState('7500')
  const [minPairBufferBps, setMinPairBufferBps] = useState('2500')
  const [pairBaseMint, setPairBaseMint] = useState('')
  const [pairQuoteMint, setPairQuoteMint] = useState('')
  const [pairStatus, setPairStatus] = useState<PairRiskStatus>('active')
  const [pairMaxOi, setPairMaxOi] = useState('100000')
  const [pairMaxLeverage, setPairMaxLeverage] = useState('5')
  const [bufferTargetBps, setBufferTargetBps] = useState('2500')
  const [bufferDrainThresholdBps, setBufferDrainThresholdBps] = useState('1500')
  const [bufferReopenThresholdBps, setBufferReopenThresholdBps] = useState('2000')
  const [pendingAction, setPendingAction] = useState<
    'init-config' | 'stage-config' | 'accept-config' | 'init-pair' | 'update-pair' | null
  >(null)

  function buildRiskParams() {
    return {
      maxLeverage: parseBoundedInt('Max leverage', maxLeverage, 1, 50),
      maxMarketLeveragedOi: parseUsdcBn('Max market OI', maxMarketOi),
      maxPairLeveragedOi: parseUsdcBn('Max pair OI', maxPairOi),
      maxPathLeveragedOi: parseUsdcBn('Max path OI', maxPathOi),
      maxPathClusterLeveragedOi: parseUsdcBn('Max cluster OI', maxClusterOi),
      vaultUtilizationCeilingBps: parseBoundedInt(
        'Vault utilization ceiling',
        vaultUtilizationCeilingBps,
        1,
        10_000,
      ),
      borrowBaseRateBps: 100,
      borrowKinkUtilizationBps: 6_000,
      borrowKinkRateBps: 800,
      borrowMaxRateBps: 2_000,
      liquidationThreshold: new BN(Math.round(1.15 * SCALE)),
      keeperRewardBps: 50,
      profitWarmupCheckpoints: 4,
      minPairBufferBps: parseBoundedInt('Min pair buffer', minPairBufferBps, 0, 10_000),
    }
  }

  function buildPairRiskParams(baseMint: PublicKey, quoteMint: PublicKey) {
    const bufferTarget = parseBoundedInt('Buffer target', bufferTargetBps, 0, 10_000)
    const bufferDrain = parseBoundedInt('Buffer drain', bufferDrainThresholdBps, 0, 10_000)
    const bufferReopen = parseBoundedInt('Buffer reopen', bufferReopenThresholdBps, 0, 10_000)
    if (bufferDrain > bufferTarget) {
      throw new Error('Buffer drain must be less than or equal to target')
    }
    if (bufferTarget > bufferReopen) {
      throw new Error('Buffer reopen must be greater than or equal to target')
    }
    const minBuffer = readiness?.leverageConfig?.currentParams.minPairBufferBps
    if (typeof minBuffer === 'number' && bufferTarget < minBuffer) {
      throw new Error(`Buffer target must be at least current config min (${minBuffer})`)
    }

    return {
      baseMint,
      quoteMint,
      status: anchorEnum(pairStatus),
      maxPairLeveragedOi: parseUsdcBn('Pair max OI', pairMaxOi),
      maxLeverage: parseBoundedInt('Pair max leverage', pairMaxLeverage, 1, 50),
      bufferTargetBps: bufferTarget,
      bufferDrainThresholdBps: bufferDrain,
      bufferReopenThresholdBps: bufferReopen,
    }
  }

  const riskParamsError = useMemo(() => {
    try {
      buildRiskParams()
      parseBoundedInt(
        'Activation delay',
        activationDelaySeconds,
        MIN_LEVERAGE_CONFIG_DELAY_SECONDS,
        2_592_000,
      )
      return ''
    } catch (err) {
      return (err as Error).message
    }
  }, [
    activationDelaySeconds,
    maxClusterOi,
    maxLeverage,
    maxMarketOi,
    maxPairOi,
    maxPathOi,
    minPairBufferBps,
    vaultUtilizationCeilingBps,
  ])
  const pairParamsError = useMemo(() => {
    try {
      if (pairBaseMint.trim() && !isPubkey(pairBaseMint)) {
        throw new Error('Base mint must be a valid public key')
      }
      if (pairQuoteMint.trim() && !isPubkey(pairQuoteMint)) {
        throw new Error('Quote mint must be a valid public key')
      }
      if (isPubkey(pairBaseMint) && isPubkey(pairQuoteMint)) {
        buildPairRiskParams(new PublicKey(pairBaseMint), new PublicKey(pairQuoteMint))
      } else {
        parseUsdcBn('Pair max OI', pairMaxOi)
        parseBoundedInt('Pair max leverage', pairMaxLeverage, 1, 50)
        const bufferTarget = parseBoundedInt('Buffer target', bufferTargetBps, 0, 10_000)
        const bufferDrain = parseBoundedInt(
          'Buffer drain',
          bufferDrainThresholdBps,
          0,
          10_000,
        )
        const bufferReopen = parseBoundedInt(
          'Buffer reopen',
          bufferReopenThresholdBps,
          0,
          10_000,
        )
        if (bufferDrain > bufferTarget) {
          throw new Error('Buffer drain must be less than or equal to target')
        }
        if (bufferTarget > bufferReopen) {
          throw new Error('Buffer reopen must be greater than or equal to target')
        }
      }
      return ''
    } catch (err) {
      return (err as Error).message
    }
  }, [
    bufferDrainThresholdBps,
    bufferReopenThresholdBps,
    bufferTargetBps,
    pairBaseMint,
    pairMaxLeverage,
    pairMaxOi,
    pairQuoteMint,
    pairStatus,
    readiness?.leverageConfig?.currentParams.minPairBufferBps,
  ])
  const normalizedSimulatorHash = isBytes32Hex(simulatorOutputHash)
    ? normalizeBytes32Hex(simulatorOutputHash)
    : ''
  const canSubmitConfig =
    !!program && !!publicKey && !!normalizedSimulatorHash && !riskParamsError
  const canSubmitPair =
    !!program &&
    !!publicKey &&
    isPubkey(pairBaseMint) &&
    isPubkey(pairQuoteMint) &&
    !pairParamsError

  async function sendMode2Instruction(
    action: NonNullable<typeof pendingAction>,
    label: string,
    ix: TransactionInstruction,
    computeUnitLimit: number,
    details: Record<string, unknown>,
    successMessage: string,
  ) {
    if (!program || !publicKey) return
    const provider = program.provider as AnchorProvider
    setPendingAction(action)
    try {
      const priorityFeeMicroLamports = await getPriorityFee(provider.connection)
      const tx = new Transaction().add(
        ...(await buildTransaction({
          instructions: [ix],
          computeUnitLimit,
          priorityFeeMicroLamports,
        })),
      )
      let sig: string
      try {
        sig = await provider.sendAndConfirm(tx)
      } catch (sendErr) {
        await logTransactionError(`${label} sendAndConfirm failed`, sendErr, {
          connection: provider.connection,
          details: {
            adminWallet: publicKey.toBase58(),
            ...details,
          },
        })
        throw translateError(sendErr, parseIdlErrors(program.idl))
      }
      await queryClient.invalidateQueries({ queryKey: ['mode2Readiness'] })
      toast.success(successMessage, { txSig: sig })
    } catch (err) {
      toast.error('Mode 2 admin transaction failed', { message: (err as Error).message })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleInitializeConfig() {
    if (!program || !publicKey || !canSubmitConfig) return
    const [protocolPda] = deriveProtocolPda()
    const [leverageConfigPda] = deriveLeverageConfigPda()
    const params = {
      currentParams: buildRiskParams(),
      simulatorOutputHash: bytes32HexToArray(normalizedSimulatorHash),
      activationDelaySeconds: new BN(
        parseBoundedInt(
          'Activation delay',
          activationDelaySeconds,
          MIN_LEVERAGE_CONFIG_DELAY_SECONDS,
          2_592_000,
        ),
      ),
    }
    const ix = await program.methods
      .initializeLeverageConfig(params)
      .accountsPartial({
        protocolState: protocolPda,
        leverageConfig: leverageConfigPda,
        authority: publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction()
    await sendMode2Instruction(
      'init-config',
      'admin.initializeLeverageConfig',
      ix,
      100_000,
      {
        leverageConfigPda: leverageConfigPda.toBase58(),
        simulatorOutputHash: normalizedSimulatorHash,
      },
      'Leverage config initialized',
    )
  }

  async function handleStageConfig() {
    if (!program || !publicKey || !canSubmitConfig) return
    const [protocolPda] = deriveProtocolPda()
    const [leverageConfigPda] = deriveLeverageConfigPda()
    const params = {
      pendingParams: buildRiskParams(),
      simulatorOutputHash: bytes32HexToArray(normalizedSimulatorHash),
    }
    const ix = await program.methods
      .stageLeverageConfig(params)
      .accountsPartial({
        protocolState: protocolPda,
        leverageConfig: leverageConfigPda,
        authority: publicKey,
      })
      .instruction()
    await sendMode2Instruction(
      'stage-config',
      'admin.stageLeverageConfig',
      ix,
      80_000,
      {
        leverageConfigPda: leverageConfigPda.toBase58(),
        simulatorOutputHash: normalizedSimulatorHash,
      },
      'Leverage config staged',
    )
  }

  async function handleAcceptConfig() {
    if (!program || !publicKey) return
    const [protocolPda] = deriveProtocolPda()
    const [leverageConfigPda] = deriveLeverageConfigPda()
    const ix = await program.methods
      .acceptLeverageConfigAfterDelay()
      .accountsPartial({
        protocolState: protocolPda,
        leverageConfig: leverageConfigPda,
        authority: publicKey,
      })
      .instruction()
    await sendMode2Instruction(
      'accept-config',
      'admin.acceptLeverageConfigAfterDelay',
      ix,
      80_000,
      { leverageConfigPda: leverageConfigPda.toBase58() },
      'Leverage config accepted',
    )
  }

  async function handleInitializePairRisk() {
    if (!program || !publicKey || !canSubmitPair) return
    let baseMint: PublicKey
    let quoteMint: PublicKey
    let params: ReturnType<typeof buildPairRiskParams>
    try {
      baseMint = new PublicKey(pairBaseMint)
      quoteMint = new PublicKey(pairQuoteMint)
      params = buildPairRiskParams(baseMint, quoteMint)
    } catch (err) {
      toast.error('Mode 2 pair risk input invalid', { message: (err as Error).message })
      return
    }
    const [protocolPda] = deriveProtocolPda()
    const [leverageConfigPda] = deriveLeverageConfigPda()
    const [pairRiskStatePda] = derivePairRiskStatePda(baseMint, quoteMint)
    const ix = await program.methods
      .initializePairRiskState(params)
      .accountsPartial({
        protocolState: protocolPda,
        leverageConfig: leverageConfigPda,
        pairRiskState: pairRiskStatePda,
        authority: publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction()
    await sendMode2Instruction(
      'init-pair',
      'admin.initializePairRiskState',
      ix,
      100_000,
      {
        pairRiskStatePda: pairRiskStatePda.toBase58(),
        baseMint: baseMint.toBase58(),
        quoteMint: quoteMint.toBase58(),
      },
      'Pair risk state initialized',
    )
  }

  async function handleUpdatePairRiskStatus() {
    if (!program || !publicKey || !isPubkey(pairBaseMint) || !isPubkey(pairQuoteMint)) return
    const baseMint = new PublicKey(pairBaseMint)
    const quoteMint = new PublicKey(pairQuoteMint)
    const [protocolPda] = deriveProtocolPda()
    const [pairRiskStatePda] = derivePairRiskStatePda(baseMint, quoteMint)
    const ix = await program.methods
      .updatePairRiskStatus(anchorEnum(pairStatus))
      .accountsPartial({
        protocolState: protocolPda,
        pairRiskState: pairRiskStatePda,
        authority: publicKey,
      })
      .instruction()
    await sendMode2Instruction(
      'update-pair',
      'admin.updatePairRiskStatus',
      ix,
      80_000,
      {
        pairRiskStatePda: pairRiskStatePda.toBase58(),
        status: pairStatus,
      },
      'Pair risk status updated',
    )
  }

  return (
    <section className="border-line mb-10 border-b pb-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-ink-strong text-caption font-mono font-bold tracking-wide uppercase">
            Mode 2 gate
          </h2>
          <p className="text-ink-dim mt-1 font-mono text-caption">
            Dormant sidecars only · leverage remains unavailable
          </p>
        </div>
        <div className="text-ink-muted font-mono text-xs uppercase">
          {readiness?.leverageConfig
            ? `${readiness.leverageConfig.status} · ${readiness.pairRiskStates.length} pairs`
            : 'No config'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 [@media(min-width:1100px)]:grid-cols-2">
        <div className="border-line rounded-lg border p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={15} strokeWidth={1.75} className="text-ink-muted" />
            <span className="text-ink-strong text-label font-mono uppercase">Config</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Simulator hash"
              value={simulatorOutputHash}
              onChange={(e) => setSimulatorOutputHash(e.target.value)}
              placeholder="32-byte hex"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Delay seconds"
                type="number"
                min={MIN_LEVERAGE_CONFIG_DELAY_SECONDS}
                value={activationDelaySeconds}
                onChange={(e) => setActivationDelaySeconds(e.target.value)}
              />
              <Input
                label="Max leverage"
                type="number"
                min={1}
                max={50}
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Max pair OI" value={maxPairOi} onChange={(e) => setMaxPairOi(e.target.value)} />
              <Input
                label="Max market OI"
                value={maxMarketOi}
                onChange={(e) => setMaxMarketOi(e.target.value)}
              />
              <Input label="Max path OI" value={maxPathOi} onChange={(e) => setMaxPathOi(e.target.value)} />
              <Input
                label="Max cluster OI"
                value={maxClusterOi}
                onChange={(e) => setMaxClusterOi(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Vault ceiling bps"
                type="number"
                min={1}
                max={10000}
                value={vaultUtilizationCeilingBps}
                onChange={(e) => setVaultUtilizationCeilingBps(e.target.value)}
              />
              <Input
                label="Min buffer bps"
                type="number"
                min={0}
                max={10000}
                value={minPairBufferBps}
                onChange={(e) => setMinPairBufferBps(e.target.value)}
              />
            </div>
            {riskParamsError && (
              <p className="text-bear font-mono text-xs uppercase">{riskParamsError}</p>
            )}
            <div className="grid grid-cols-1 gap-3 [@media(min-width:1181px)]:grid-cols-3">
              <Button
                variant="secondary"
                disabled={!canSubmitConfig || pendingAction === 'init-config'}
                onClick={handleInitializeConfig}
              >
                {pendingAction === 'init-config' ? 'Initializing' : 'Initialize'}
              </Button>
              <Button
                variant="secondary"
                disabled={!canSubmitConfig || pendingAction === 'stage-config'}
                onClick={handleStageConfig}
              >
                {pendingAction === 'stage-config' ? 'Staging' : 'Stage'}
              </Button>
              <Button
                variant="secondary"
                disabled={!program || !publicKey || pendingAction === 'accept-config'}
                onClick={handleAcceptConfig}
              >
                {pendingAction === 'accept-config' ? 'Accepting' : 'Accept'}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-line rounded-lg border p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={15} strokeWidth={1.75} className="text-ink-muted" />
            <span className="text-ink-strong text-label font-mono uppercase">Pair risk</span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Base mint"
              value={pairBaseMint}
              onChange={(e) => setPairBaseMint(e.target.value)}
              placeholder="Base mint pubkey"
            />
            <Input
              label="Quote mint"
              value={pairQuoteMint}
              onChange={(e) => setPairQuoteMint(e.target.value)}
              placeholder="Quote mint pubkey"
            />
            <select
              value={pairStatus}
              onChange={(e) => setPairStatus(e.target.value as PairRiskStatus)}
              className={cn(
                'border-line-strong bg-surface text-ink-strong',
                'rounded-lg border px-3 py-3 font-mono text-sm',
              )}
            >
              {PAIR_RISK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pair max OI" value={pairMaxOi} onChange={(e) => setPairMaxOi(e.target.value)} />
              <Input
                label="Pair max leverage"
                type="number"
                min={1}
                max={50}
                value={pairMaxLeverage}
                onChange={(e) => setPairMaxLeverage(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Target bps"
                type="number"
                value={bufferTargetBps}
                onChange={(e) => setBufferTargetBps(e.target.value)}
              />
              <Input
                label="Drain bps"
                type="number"
                value={bufferDrainThresholdBps}
                onChange={(e) => setBufferDrainThresholdBps(e.target.value)}
              />
              <Input
                label="Reopen bps"
                type="number"
                value={bufferReopenThresholdBps}
                onChange={(e) => setBufferReopenThresholdBps(e.target.value)}
              />
            </div>
            {pairParamsError && (
              <p className="text-bear font-mono text-xs uppercase">{pairParamsError}</p>
            )}
            <div className="grid grid-cols-1 gap-3 [@media(min-width:1181px)]:grid-cols-2">
              <Button
                variant="secondary"
                disabled={!canSubmitPair || pendingAction === 'init-pair'}
                onClick={handleInitializePairRisk}
              >
                {pendingAction === 'init-pair' ? 'Initializing' : 'Initialize pair'}
              </Button>
              <Button
                variant="secondary"
                disabled={
                  !program ||
                  !publicKey ||
                  !isPubkey(pairBaseMint) ||
                  !isPubkey(pairQuoteMint) ||
                  pendingAction === 'update-pair'
                }
                onClick={handleUpdatePairRiskStatus}
              >
                {pendingAction === 'update-pair' ? 'Updating' : 'Update status'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function AdminMarketsPage() {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const { data: markets, isLoading } = useMarkets()
  const closeMarket = useCloseMarket()

  const handleCloseMarket = (market: Market) => {
    const label = market.pair || `Market ${market.marketId}`
    if (!window.confirm(`Close ${label}?`)) return
    closeMarket.mutate({ marketId: market.marketId, vault: market.vault })
  }

  if (!isAdmin) {
    return (
      <main className="px-10 pt-6 pb-12">
        <h1 className="font-display text-ink-strong mb-4 text-[56px] leading-none font-medium tracking-[-0.01em] [font-variation-settings:'ROND'_100]">
          Admin
        </h1>
        <p className="text-ink-muted font-mono text-xs tracking-normal uppercase">
          Connect an admin wallet to access this page.
        </p>
      </main>
    )
  }

  return (
    <main className="px-10 pt-6 pb-12">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-ink-strong mb-4 text-[56px] leading-none font-medium tracking-[-0.01em] [font-variation-settings:'ROND'_100]">
            Admin
          </h1>
          <p className="text-ink-muted font-mono text-xs tracking-normal uppercase">
            Manage markets
          </p>
        </div>
        {markets && markets.length > 0 && (
          <Button variant="primary" onClick={() => void navigate({ to: '/admin/create' })}>
            <Plus size={14} strokeWidth={2} className="mr-2" />
            New market
          </Button>
        )}
      </header>

      <MarketGroupAdminPanel />
      <Mode2AdminPanel />

      {/* ── Existing markets ───────────────────────────────── */}
      {isLoading && (
        <p className="text-ink-dim text-label animate-pulse font-mono uppercase">
          Loading markets…
        </p>
      )}

      {!isLoading && (!markets || markets.length === 0) && (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-4 py-24',
            'border-line-strong rounded-2xl border border-dashed',
          )}
        >
          <p className="text-ink-muted text-label font-mono uppercase">No markets yet</p>
          <Button variant="secondary" onClick={() => void navigate({ to: '/admin/create' })}>
            <Plus size={14} strokeWidth={2} className="mr-2" />
            Create your first market
          </Button>
        </div>
      )}

      {markets && markets.length > 0 && (
        <div className="flex flex-col gap-3">
          {markets.map((m) => {
            const closeable = canCloseMarket(m)
            const closing = closeMarket.isPending && closeMarket.variables?.marketId === m.marketId
            return (
              <div
                key={m.id}
                className={cn(
                  'border-line flex items-center gap-6 rounded-xl border px-6 py-4 text-left',
                  'duration-short ease-levx transition-[border-color,background-color]',
                  'hover:border-line-strong hover:bg-surface-1',
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-6 text-left focus-visible:outline-none"
                  onClick={() => void navigate({ to: '/market/$id', params: { id: m.id } })}
                >
                  <span className="text-ink-strong font-mono text-sm font-bold tracking-wide uppercase">
                    {m.pair || `Market ${m.marketId}`}
                  </span>
                  <span
                    className={cn(
                      'text-label rounded-full border px-2 py-0.5 font-mono tracking-wider uppercase',
                      m.state === 'active'
                        ? 'border-success/30 text-success'
                        : m.state === 'pending'
                          ? 'border-warning/30 text-warning'
                          : m.state === 'settled'
                            ? 'border-ink-dim/30 text-ink-dim'
                            : 'border-line-strong text-ink-muted',
                    )}
                  >
                    {m.state}
                  </span>
                  <span className="text-ink-muted text-value ml-auto font-mono">
                    {formatUSD(m.pool)} USDC
                  </span>
                  <span className="text-ink-dim text-caption font-mono">{m.traders} traders</span>
                </button>
                {(m.state === 'settled' || m.state === 'void') && (
                  <Button
                    variant="destructive"
                    className="min-h-9 px-4 py-2"
                    disabled={!closeable || closing}
                    title={closeable ? 'Close market' : closeMarketDisabledReason(m)}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCloseMarket(m)
                    }}
                  >
                    <Trash2 size={14} strokeWidth={2} className="mr-2" />
                    {closing ? 'Closing' : 'Close'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
