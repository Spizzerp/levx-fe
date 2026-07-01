import { useNavigate } from '@tanstack/react-router'
import { AnchorProvider, BN, parseIdlErrors, translateError } from '@coral-xyz/anchor'
import { FolderPlus, Info, Link2, Plus, ShieldCheck, Trash2, Unlink2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'

import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { cn } from '@/lib/cn'
import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'
import { parseScaledDecimalBn } from '@/lib/fixedPoint'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { useMarkets, useMode2Readiness } from '@/lib/api/hooks'
import { formatAddress, formatUSD } from '@/lib/format'
import { resolveBaseMintLabel } from '@/lib/api/pairLabels'
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
import type {
  Market,
  MarketGroupKind,
  MarketGroupStatus,
  PairRiskState,
  PairRiskStatus,
} from '@/types/market'

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
  return parseScaledDecimalBn(label, value, 6)
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
const MODE2_SIMULATOR_HASH = '463edae705a65e430031f1ef0d85a3cb2568690206af41d87504c44095bc4d3b'
const MODE2_CONFIG_DEFAULTS = {
  activationDelaySeconds: '86400',
  maxLeverage: '10',
  maxPairOi: '5000',
  maxMarketOi: '1000',
  maxPathOi: '250',
  maxClusterOi: '500',
  vaultUtilizationCeilingBps: '8000',
  minPairBufferBps: '1000',
}
const MODE2_PAIR_DEFAULTS = {
  status: 'drainOnly' as PairRiskStatus,
  maxPairOi: '2000',
  maxLeverage: '5',
  bufferTargetBps: '2500',
  bufferDrainThresholdBps: '2000',
  bufferReopenThresholdBps: '3000',
}
const EMPTY_PAIR_RISK_STATES: PairRiskState[] = []
const MODE2_FIELD_HELP = {
  simulatorHash:
    '32-byte hash of the simulator report backing these parameters. It gives governance a stable risk-review reference.',
  activationDelaySeconds:
    'Minimum delay before a staged config can be accepted. Devnet currently uses 86,400 seconds.',
  maxLeverage:
    'Global leverage ceiling. Pair risk states can choose lower caps, but should not exceed this governance limit.',
  maxPairOi:
    'Maximum leveraged open interest allowed across one base/quote pair, expressed in USDC.',
  maxMarketOi: 'Maximum leveraged open interest allowed on a single market, expressed in USDC.',
  maxPathOi: 'Maximum leveraged exposure allowed on one predicted path.',
  maxClusterOi:
    'Maximum leveraged exposure allowed across correlated paths in the same risk cluster.',
  vaultCeilingBps:
    'Maximum vault utilization in basis points before Mode 2 should stop adding new risk.',
  minBufferBps:
    'Minimum pair buffer target in basis points. Pair targets must stay at or above this floor.',
  baseMint: 'Base asset mint for the pair risk account, such as SOL, BTC, or ETH.',
  quoteMint: 'Quote or collateral mint paired with the base asset.',
  pairStatus:
    'Operational safety state for this pair. Drain only is the conservative dormant setting.',
  pairMaxOi: 'Pair-specific leveraged open-interest cap, expressed in USDC.',
  pairMaxLeverage: 'Pair-specific leverage cap. Keep it at or below the global max leverage.',
  bufferTargetBps: 'Normal buffer target for this pair, in basis points.',
  bufferDrainBps:
    'Buffer threshold where this pair should move toward reducing risk instead of adding it.',
  bufferReopenBps:
    'Buffer threshold required before a drained pair is eligible to reopen in a future activation.',
}

function formatBps(value: number): string {
  return `${(value / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

function formatStatusLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function formatHash(hash: string): string {
  if (!hash) return 'Not set'
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`
}

function inputAmount(value: number): string {
  return Number.isFinite(value) ? String(value) : ''
}

function Mode2Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border-line rounded-md border px-3 py-3">
      <div className="text-ink-muted font-mono text-[10px] tracking-wide uppercase">{label}</div>
      <div className="text-ink-strong mt-1 truncate font-mono text-sm">{value}</div>
      {detail && <div className="text-ink-dim mt-1 truncate font-mono text-[11px]">{detail}</div>}
    </div>
  )
}

function Mode2StatusPill({
  tone,
  children,
}: {
  tone: 'safe' | 'warning' | 'neutral'
  children: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1',
        'font-mono text-[10px] font-bold tracking-wide uppercase',
        tone === 'safe' && 'border-bull/40 bg-bull/10 text-bull',
        tone === 'warning' && 'border-accent/40 bg-accent-subtle text-accent',
        tone === 'neutral' && 'border-line-strong bg-surface text-ink-muted',
      )}
    >
      {children}
    </span>
  )
}

function Mode2FieldShell({
  label,
  help,
  htmlFor,
  children,
}: {
  label: string
  help: string
  htmlFor: string
  children: (describedBy: string | undefined) => ReactNode
}) {
  const helpId = useId()
  const [expanded, setExpanded] = useState(false)
  const describedBy = expanded ? helpId : undefined

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="text-label text-ink-muted font-mono uppercase">
          {label}
        </label>
        <button
          type="button"
          aria-label={`About ${label}`}
          aria-expanded={expanded}
          aria-controls={helpId}
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            'border-line text-ink-dim inline-flex h-5 w-5 items-center justify-center rounded-full border',
            'duration-short ease-levx transition-[border-color,background-color,color]',
            'hover:border-line-strong hover:text-ink-strong focus-visible:border-ink-strong focus-visible:outline-none',
            expanded && 'border-line-strong bg-surface-1 text-ink-strong',
          )}
        >
          <Info size={11} strokeWidth={1.75} />
        </button>
      </div>
      {expanded && (
        <p
          id={helpId}
          className="border-line bg-surface/50 text-ink-muted mt-2 rounded-md border px-3 py-2 font-mono text-[11px] leading-relaxed"
        >
          {help}
        </p>
      )}
      {children(describedBy)}
    </div>
  )
}

type Mode2InfoInputProps = Omit<ComponentProps<typeof Input>, 'label'> & {
  label: string
  help: string
}

function Mode2InfoInput({ label, help, ...props }: Mode2InfoInputProps) {
  const inputId = useId()
  return (
    <Mode2FieldShell label={label} help={help} htmlFor={inputId}>
      {(describedBy) => <Input id={inputId} aria-describedby={describedBy} {...props} />}
    </Mode2FieldShell>
  )
}

function Mode2InfoSelect({
  label,
  help,
  value,
  onChange,
  children,
}: {
  label: string
  help: string
  value: PairRiskStatus
  onChange: (value: PairRiskStatus) => void
  children: ReactNode
}) {
  const selectId = useId()
  return (
    <Mode2FieldShell label={label} help={help} htmlFor={selectId}>
      {(describedBy) => (
        <select
          id={selectId}
          value={value}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value as PairRiskStatus)}
          className={cn(
            'border-line-strong bg-surface text-ink-strong',
            'mt-3 rounded-lg border px-3 py-3 font-mono text-sm',
          )}
        >
          {children}
        </select>
      )}
    </Mode2FieldShell>
  )
}

function Mode2AdminPanel() {
  const queryClient = useQueryClient()
  const program = useProgram()
  const publicKey = useWalletStore((s) => s.publicKey)
  const { data: readiness } = useMode2Readiness()
  const [simulatorOutputHash, setSimulatorOutputHash] = useState(MODE2_SIMULATOR_HASH)
  const [activationDelaySeconds, setActivationDelaySeconds] = useState(
    MODE2_CONFIG_DEFAULTS.activationDelaySeconds,
  )
  const [maxLeverage, setMaxLeverage] = useState(MODE2_CONFIG_DEFAULTS.maxLeverage)
  const [maxPairOi, setMaxPairOi] = useState(MODE2_CONFIG_DEFAULTS.maxPairOi)
  const [maxMarketOi, setMaxMarketOi] = useState(MODE2_CONFIG_DEFAULTS.maxMarketOi)
  const [maxPathOi, setMaxPathOi] = useState(MODE2_CONFIG_DEFAULTS.maxPathOi)
  const [maxClusterOi, setMaxClusterOi] = useState(MODE2_CONFIG_DEFAULTS.maxClusterOi)
  const [vaultUtilizationCeilingBps, setVaultUtilizationCeilingBps] = useState(
    MODE2_CONFIG_DEFAULTS.vaultUtilizationCeilingBps,
  )
  const [minPairBufferBps, setMinPairBufferBps] = useState(MODE2_CONFIG_DEFAULTS.minPairBufferBps)
  const [pairBaseMint, setPairBaseMint] = useState('')
  const [pairQuoteMint, setPairQuoteMint] = useState('')
  const [pairStatus, setPairStatus] = useState<PairRiskStatus>(MODE2_PAIR_DEFAULTS.status)
  const [pairMaxOi, setPairMaxOi] = useState(MODE2_PAIR_DEFAULTS.maxPairOi)
  const [pairMaxLeverage, setPairMaxLeverage] = useState(MODE2_PAIR_DEFAULTS.maxLeverage)
  const [bufferTargetBps, setBufferTargetBps] = useState(MODE2_PAIR_DEFAULTS.bufferTargetBps)
  const [bufferDrainThresholdBps, setBufferDrainThresholdBps] = useState(
    MODE2_PAIR_DEFAULTS.bufferDrainThresholdBps,
  )
  const [bufferReopenThresholdBps, setBufferReopenThresholdBps] = useState(
    MODE2_PAIR_DEFAULTS.bufferReopenThresholdBps,
  )
  const [pendingAction, setPendingAction] = useState<
    'init-config' | 'stage-config' | 'accept-config' | 'init-pair' | 'update-pair' | null
  >(null)
  const [hasSyncedMode2Inputs, setHasSyncedMode2Inputs] = useState(false)

  const leverageConfig = readiness?.leverageConfig ?? null
  const pairRiskStates = readiness?.pairRiskStates ?? EMPTY_PAIR_RISK_STATES
  const minPairBufferBpsForPair = leverageConfig?.currentParams.minPairBufferBps
  const selectedPairRiskState = useMemo(
    () =>
      pairRiskStates.find(
        (state) => state.baseMint === pairBaseMint && state.quoteMint === pairQuoteMint,
      ) ?? null,
    [pairBaseMint, pairQuoteMint, pairRiskStates],
  )

  const loadPairRiskState = useCallback((state: PairRiskState) => {
    setPairBaseMint(state.baseMint)
    setPairQuoteMint(state.quoteMint)
    setPairStatus(state.status)
    setPairMaxOi(inputAmount(state.maxPairLeveragedOi))
    setPairMaxLeverage(String(state.maxLeverage))
    setBufferTargetBps(String(state.bufferTargetBps))
    setBufferDrainThresholdBps(String(state.bufferDrainThresholdBps))
    setBufferReopenThresholdBps(String(state.bufferReopenThresholdBps))
  }, [])

  useEffect(() => {
    if (!leverageConfig || hasSyncedMode2Inputs) return
    setSimulatorOutputHash(leverageConfig.simulatorOutputHash)
    setActivationDelaySeconds(String(leverageConfig.activationDelaySeconds))
    setMaxLeverage(String(leverageConfig.currentParams.maxLeverage))
    setMaxPairOi(inputAmount(leverageConfig.currentParams.maxPairLeveragedOi))
    setMaxMarketOi(inputAmount(leverageConfig.currentParams.maxMarketLeveragedOi))
    setMaxPathOi(inputAmount(leverageConfig.currentParams.maxPathLeveragedOi))
    setMaxClusterOi(inputAmount(leverageConfig.currentParams.maxPathClusterLeveragedOi))
    setVaultUtilizationCeilingBps(String(leverageConfig.currentParams.vaultUtilizationCeilingBps))
    setMinPairBufferBps(String(leverageConfig.currentParams.minPairBufferBps))
    setHasSyncedMode2Inputs(true)
  }, [hasSyncedMode2Inputs, leverageConfig])

  useEffect(() => {
    if (pairBaseMint || pairQuoteMint || pairRiskStates.length === 0) return
    loadPairRiskState(pairRiskStates[0])
  }, [loadPairRiskState, pairBaseMint, pairQuoteMint, pairRiskStates])

  const buildRiskParams = useCallback(() => {
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
      borrowBaseRateBps: 200,
      borrowKinkUtilizationBps: 6_000,
      borrowKinkRateBps: 1_500,
      borrowMaxRateBps: 10_000,
      liquidationThreshold: new BN(Math.round(1.1 * SCALE)),
      keeperRewardBps: 50,
      profitWarmupCheckpoints: 3,
      minPairBufferBps: parseBoundedInt('Min pair buffer', minPairBufferBps, 0, 10_000),
    }
  }, [
    maxClusterOi,
    maxLeverage,
    maxMarketOi,
    maxPairOi,
    maxPathOi,
    minPairBufferBps,
    vaultUtilizationCeilingBps,
  ])

  const parsePairRiskInputs = useCallback(() => {
    const bufferTarget = parseBoundedInt('Buffer target', bufferTargetBps, 0, 10_000)
    const bufferDrain = parseBoundedInt('Buffer drain', bufferDrainThresholdBps, 0, 10_000)
    const bufferReopen = parseBoundedInt('Buffer reopen', bufferReopenThresholdBps, 0, 10_000)
    if (bufferDrain > bufferTarget) {
      throw new Error('Buffer drain must be less than or equal to target')
    }
    if (bufferTarget > bufferReopen) {
      throw new Error('Buffer reopen must be greater than or equal to target')
    }
    if (typeof minPairBufferBpsForPair === 'number' && bufferTarget < minPairBufferBpsForPair) {
      throw new Error(
        `Buffer target must be at least current config min (${minPairBufferBpsForPair})`,
      )
    }

    return {
      maxPairLeveragedOi: parseUsdcBn('Pair max OI', pairMaxOi),
      maxLeverage: parseBoundedInt('Pair max leverage', pairMaxLeverage, 1, 50),
      bufferTargetBps: bufferTarget,
      bufferDrainThresholdBps: bufferDrain,
      bufferReopenThresholdBps: bufferReopen,
    }
  }, [
    bufferDrainThresholdBps,
    bufferReopenThresholdBps,
    bufferTargetBps,
    minPairBufferBpsForPair,
    pairMaxLeverage,
    pairMaxOi,
  ])

  function buildPairRiskParams(baseMint: PublicKey, quoteMint: PublicKey) {
    return {
      baseMint,
      quoteMint,
      status: anchorEnum(pairStatus),
      ...parsePairRiskInputs(),
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
  }, [activationDelaySeconds, buildRiskParams])
  const pairParamsError = useMemo(() => {
    try {
      if (pairBaseMint.trim() && !isPubkey(pairBaseMint)) {
        throw new Error('Base mint must be a valid public key')
      }
      if (pairQuoteMint.trim() && !isPubkey(pairQuoteMint)) {
        throw new Error('Quote mint must be a valid public key')
      }
      parsePairRiskInputs()
      return ''
    } catch (err) {
      return (err as Error).message
    }
  }, [pairBaseMint, pairQuoteMint, parsePairRiskInputs])
  const normalizedSimulatorHash = isBytes32Hex(simulatorOutputHash)
    ? normalizeBytes32Hex(simulatorOutputHash)
    : ''
  const canSubmitConfig = !!program && !!publicKey && !!normalizedSimulatorHash && !riskParamsError
  const canSubmitPair =
    !!program &&
    !!publicKey &&
    isPubkey(pairBaseMint) &&
    isPubkey(pairQuoteMint) &&
    !pairParamsError
  const canInitializeConfig = canSubmitConfig && !leverageConfig
  const canStageConfig = canSubmitConfig && !!leverageConfig
  const canAcceptConfig = !!program && !!publicKey && leverageConfig?.status === 'staged'
  const canInitializePair = canSubmitPair && !!leverageConfig && !selectedPairRiskState
  const canUpdatePair = canSubmitPair && !!selectedPairRiskState

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
    if (!program || !publicKey || !canInitializeConfig) return
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
    if (!program || !publicKey || !canStageConfig) return
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
    if (!program || !publicKey || !canAcceptConfig) return
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
    if (!program || !publicKey || !canInitializePair) return
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
    if (!program || !publicKey || !canUpdatePair) return
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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-ink-strong text-caption font-mono font-bold tracking-wide uppercase">
            Mode 2 gate
          </h2>
          <p className="text-ink-dim text-caption mt-1 font-mono">
            Dormant leverage setup. Admin actions here configure sidecars only.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Mode2StatusPill tone={readiness?.leverageEnabled ? 'warning' : 'safe'}>
            {readiness?.leverageEnabled ? 'Leverage on' : 'Leverage off'}
          </Mode2StatusPill>
          <Mode2StatusPill tone={leverageConfig?.status === 'accepted' ? 'safe' : 'neutral'}>
            {leverageConfig ? formatStatusLabel(leverageConfig.status) : 'No config'}
          </Mode2StatusPill>
          <Mode2StatusPill tone="neutral">
            {`${pairRiskStates.length} pair${pairRiskStates.length === 1 ? '' : 's'}`}
          </Mode2StatusPill>
        </div>
      </div>

      <div className="border-line bg-surface/50 mb-6 rounded-lg border px-4 py-3">
        <p className="text-ink-muted font-mono text-xs leading-relaxed">
          Current devnet state: Mode 2 sidecars can be read by the app, but leveraged positions, LP
          deposits, liquidations, and Mode 2 claims remain disabled until a later activation
          sequence flips protocol leverage on.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 [@media(min-width:1100px)]:grid-cols-2">
        <div className="border-line rounded-lg border p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} strokeWidth={1.75} className="text-ink-muted" />
              <span className="text-ink-strong text-label font-mono uppercase">Global config</span>
            </div>
            {leverageConfig && (
              <span className="text-ink-muted font-mono text-[10px] uppercase">
                {formatAddress(leverageConfig.address)}
              </span>
            )}
          </div>

          {leverageConfig ? (
            <div className="mb-6 grid grid-cols-2 gap-3">
              <Mode2Metric
                label="Config hash"
                value={formatHash(leverageConfig.simulatorOutputHash)}
                detail="Simulator report"
              />
              <Mode2Metric
                label="Delay"
                value={`${leverageConfig.activationDelaySeconds.toLocaleString()}s`}
                detail="Config acceptance guard"
              />
              <Mode2Metric
                label="Protocol max"
                value={`${leverageConfig.currentParams.maxLeverage}x`}
                detail="Global ceiling"
              />
              <Mode2Metric
                label="Pair OI cap"
                value={`$${formatUSD(leverageConfig.currentParams.maxPairLeveragedOi)}`}
                detail="Global pair cap"
              />
              <Mode2Metric
                label="Market OI cap"
                value={`$${formatUSD(leverageConfig.currentParams.maxMarketLeveragedOi)}`}
                detail="Per market"
              />
              <Mode2Metric
                label="Min buffer"
                value={formatBps(leverageConfig.currentParams.minPairBufferBps)}
                detail="Pair risk floor"
              />
            </div>
          ) : (
            <div className="border-line bg-surface/40 mb-6 rounded-md border px-4 py-4">
              <p className="text-ink-muted font-mono text-sm">No leverage config exists yet.</p>
              <p className="text-ink-dim mt-1 font-mono text-xs">
                Initialize once with a simulator hash, then stage future parameter changes.
              </p>
            </div>
          )}

          <div className="border-line border-t pt-5">
            <div className="mb-4">
              <h3 className="text-ink-strong font-mono text-xs font-bold tracking-wide uppercase">
                Config action
              </h3>
              <p className="text-ink-dim mt-1 font-mono text-xs">
                Initialize is one-time. Use Stage and Accept for future parameter updates.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Mode2InfoInput
                label="Simulator hash"
                help={MODE2_FIELD_HELP.simulatorHash}
                value={simulatorOutputHash}
                onChange={(e) => setSimulatorOutputHash(e.target.value)}
                placeholder="32-byte hex"
              />
              <div className="grid grid-cols-2 gap-4">
                <Mode2InfoInput
                  label="Delay seconds"
                  help={MODE2_FIELD_HELP.activationDelaySeconds}
                  type="number"
                  min={MIN_LEVERAGE_CONFIG_DELAY_SECONDS}
                  value={activationDelaySeconds}
                  onChange={(e) => setActivationDelaySeconds(e.target.value)}
                />
                <Mode2InfoInput
                  label="Max leverage"
                  help={MODE2_FIELD_HELP.maxLeverage}
                  type="number"
                  min={1}
                  max={50}
                  value={maxLeverage}
                  onChange={(e) => setMaxLeverage(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Mode2InfoInput
                  label="Max pair OI"
                  help={MODE2_FIELD_HELP.maxPairOi}
                  value={maxPairOi}
                  onChange={(e) => setMaxPairOi(e.target.value)}
                />
                <Mode2InfoInput
                  label="Max market OI"
                  help={MODE2_FIELD_HELP.maxMarketOi}
                  value={maxMarketOi}
                  onChange={(e) => setMaxMarketOi(e.target.value)}
                />
                <Mode2InfoInput
                  label="Max path OI"
                  help={MODE2_FIELD_HELP.maxPathOi}
                  value={maxPathOi}
                  onChange={(e) => setMaxPathOi(e.target.value)}
                />
                <Mode2InfoInput
                  label="Max cluster OI"
                  help={MODE2_FIELD_HELP.maxClusterOi}
                  value={maxClusterOi}
                  onChange={(e) => setMaxClusterOi(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Mode2InfoInput
                  label="Vault ceiling bps"
                  help={MODE2_FIELD_HELP.vaultCeilingBps}
                  type="number"
                  min={1}
                  max={10000}
                  value={vaultUtilizationCeilingBps}
                  onChange={(e) => setVaultUtilizationCeilingBps(e.target.value)}
                />
                <Mode2InfoInput
                  label="Min buffer bps"
                  help={MODE2_FIELD_HELP.minBufferBps}
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
                  disabled={!canInitializeConfig || pendingAction === 'init-config'}
                  onClick={handleInitializeConfig}
                >
                  {pendingAction === 'init-config'
                    ? 'Initializing'
                    : leverageConfig
                      ? 'Initialized'
                      : 'Initialize config'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!canStageConfig || pendingAction === 'stage-config'}
                  onClick={handleStageConfig}
                >
                  {pendingAction === 'stage-config' ? 'Staging' : 'Stage update'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!canAcceptConfig || pendingAction === 'accept-config'}
                  onClick={handleAcceptConfig}
                >
                  {pendingAction === 'accept-config' ? 'Accepting' : 'Accept staged'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-line rounded-lg border p-5">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck size={15} strokeWidth={1.75} className="text-ink-muted" />
            <span className="text-ink-strong text-label font-mono uppercase">Pair risk</span>
          </div>

          {pairRiskStates.length > 0 ? (
            <div className="mb-5 grid grid-cols-1 gap-2">
              {pairRiskStates.map((state) => {
                const label = resolveBaseMintLabel(state.baseMint)
                const selected = selectedPairRiskState?.address === state.address
                return (
                  <button
                    key={state.address}
                    type="button"
                    onClick={() => loadPairRiskState(state)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-md border px-3 py-3 text-left',
                      'duration-short ease-levx transition-[border-color,background-color,color]',
                      selected
                        ? 'border-ink-strong bg-ink-strong/5'
                        : 'border-line hover:border-line-strong bg-transparent',
                    )}
                  >
                    <span>
                      <span className="text-ink-strong block font-mono text-sm">{label.pair}</span>
                      <span className="text-ink-dim block font-mono text-[11px]">
                        {formatAddress(state.baseMint)} → {formatAddress(state.quoteMint)}
                      </span>
                    </span>
                    <span className="text-ink-muted font-mono text-[10px] uppercase">
                      {formatStatusLabel(state.status)}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="border-line bg-surface/40 mb-5 rounded-md border px-4 py-4">
              <p className="text-ink-muted font-mono text-sm">No pair risk states yet.</p>
              <p className="text-ink-dim mt-1 font-mono text-xs">
                Initialize a supported pair after the global config exists.
              </p>
            </div>
          )}

          {selectedPairRiskState && (
            <div className="mb-6 grid grid-cols-2 gap-3">
              <Mode2Metric
                label="Selected pair"
                value={resolveBaseMintLabel(selectedPairRiskState.baseMint).pair}
                detail={formatAddress(selectedPairRiskState.address)}
              />
              <Mode2Metric
                label="Safety state"
                value={formatStatusLabel(selectedPairRiskState.status)}
                detail="Current on-chain status"
              />
              <Mode2Metric
                label="Pair OI cap"
                value={`$${formatUSD(selectedPairRiskState.maxPairLeveragedOi)}`}
                detail={`${selectedPairRiskState.maxLeverage}x max`}
              />
              <Mode2Metric
                label="Buffer band"
                value={`${formatBps(selectedPairRiskState.bufferDrainThresholdBps)} / ${formatBps(selectedPairRiskState.bufferTargetBps)} / ${formatBps(selectedPairRiskState.bufferReopenThresholdBps)}`}
                detail="Drain / target / reopen"
              />
            </div>
          )}

          <div className="border-line border-t pt-5">
            <div className="mb-4">
              <h3 className="text-ink-strong font-mono text-xs font-bold tracking-wide uppercase">
                Pair action
              </h3>
              <p className="text-ink-dim mt-1 font-mono text-xs">
                Select an existing pair to update its status, or paste a supported pair to
                initialize a new risk state.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Mode2InfoInput
                label="Base mint"
                help={MODE2_FIELD_HELP.baseMint}
                value={pairBaseMint}
                onChange={(e) => setPairBaseMint(e.target.value)}
                placeholder="Base mint pubkey"
              />
              <Mode2InfoInput
                label="Quote mint"
                help={MODE2_FIELD_HELP.quoteMint}
                value={pairQuoteMint}
                onChange={(e) => setPairQuoteMint(e.target.value)}
                placeholder="Quote mint pubkey"
              />
              <Mode2InfoSelect
                label="Pair status"
                help={MODE2_FIELD_HELP.pairStatus}
                value={pairStatus}
                onChange={setPairStatus}
              >
                {PAIR_RISK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Mode2InfoSelect>
              <div className="grid grid-cols-2 gap-4">
                <Mode2InfoInput
                  label="Pair max OI"
                  help={MODE2_FIELD_HELP.pairMaxOi}
                  value={pairMaxOi}
                  onChange={(e) => setPairMaxOi(e.target.value)}
                />
                <Mode2InfoInput
                  label="Pair max leverage"
                  help={MODE2_FIELD_HELP.pairMaxLeverage}
                  type="number"
                  min={1}
                  max={50}
                  value={pairMaxLeverage}
                  onChange={(e) => setPairMaxLeverage(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Mode2InfoInput
                  label="Target bps"
                  help={MODE2_FIELD_HELP.bufferTargetBps}
                  type="number"
                  value={bufferTargetBps}
                  onChange={(e) => setBufferTargetBps(e.target.value)}
                />
                <Mode2InfoInput
                  label="Drain bps"
                  help={MODE2_FIELD_HELP.bufferDrainBps}
                  type="number"
                  value={bufferDrainThresholdBps}
                  onChange={(e) => setBufferDrainThresholdBps(e.target.value)}
                />
                <Mode2InfoInput
                  label="Reopen bps"
                  help={MODE2_FIELD_HELP.bufferReopenBps}
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
                  disabled={!canInitializePair || pendingAction === 'init-pair'}
                  onClick={handleInitializePairRisk}
                >
                  {pendingAction === 'init-pair'
                    ? 'Initializing'
                    : selectedPairRiskState
                      ? 'Pair initialized'
                      : 'Initialize pair'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!canUpdatePair || pendingAction === 'update-pair'}
                  onClick={handleUpdatePairRiskStatus}
                >
                  {pendingAction === 'update-pair' ? 'Updating' : 'Update status'}
                </Button>
              </div>
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
