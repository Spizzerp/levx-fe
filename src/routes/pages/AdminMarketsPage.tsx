import { useNavigate } from '@tanstack/react-router'
import { AnchorProvider, BN, parseIdlErrors, translateError } from '@coral-xyz/anchor'
import { FolderPlus, Link2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SystemProgram, Transaction } from '@solana/web3.js'

import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { cn } from '@/lib/cn'
import { buildTransaction } from '@/lib/chain/buildTransaction'
import { getPriorityFee } from '@/lib/chain/priorityFee'
import { useIsAdmin } from '@/lib/hooks/useIsAdmin'
import { useMarkets } from '@/lib/api/hooks'
import { formatUSD } from '@/lib/format'
import { useCloseMarket, useProgram } from '@/lib/solana'
import {
  deriveMarketGroupLinkPda,
  deriveMarketGroupPda,
  deriveMarketPda,
  deriveProtocolPda,
} from '@/lib/solana/pda'
import { logTransactionError } from '@/lib/solana/logTransactionError'
import {
  DEFAULT_PUBKEY,
  MARKET_GROUP_KIND_OPTIONS,
  MARKET_GROUP_STATUS_OPTIONS,
  anchorEnum,
  bytes32HexToArray,
  isBytes32Hex,
  normalizeBytes32Hex,
} from '@/lib/marketGroups'
import { toast } from '@/stores/toastStore'
import { useWalletStore } from '@/stores/walletStore'
import type { Market, MarketGroupKind, MarketGroupStatus } from '@/types/market'

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
  const [linkMarketId, setLinkMarketId] = useState('')
  const [linkGroupKeyHash, setLinkGroupKeyHash] = useState('')
  const [pendingAction, setPendingAction] = useState<'create' | 'link' | null>(null)

  const canCreateGroup =
    !!program &&
    !!publicKey &&
    isBytes32Hex(groupKeyHash) &&
    (!parentGroupKeyHash || isBytes32Hex(parentGroupKeyHash)) &&
    (!metadataHash || isBytes32Hex(metadataHash))
  const canLinkMarket =
    !!program &&
    !!publicKey &&
    isBytes32Hex(linkGroupKeyHash) &&
    Number.isInteger(Number(linkMarketId)) &&
    Number(linkMarketId) >= 0

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
        baseMint: DEFAULT_PUBKEY,
        quoteMint: DEFAULT_PUBKEY,
        pythFeedId: Array(32).fill(0),
        constraintFlags: 0,
        startTime: new BN(0),
        endTime: new BN(0),
        allowedTimeframesMask: 0,
        metadataHash: bytes32HexToArray(metadataHash || '00'.repeat(32)),
      }
      const ix = await (program.methods as any)
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
      const ix = await (program.methods as any)
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

      <div className="grid grid-cols-1 gap-8 [@media(min-width:1100px)]:grid-cols-2">
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
                className="border-line-strong bg-surface text-ink-strong rounded-lg border px-3 py-3 font-mono text-sm"
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
                className="border-line-strong bg-surface text-ink-strong rounded-lg border px-3 py-3 font-mono text-sm"
              >
                {MARKET_GROUP_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
