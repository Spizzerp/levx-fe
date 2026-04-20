import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Camera, Check, Copy, Lock, Shuffle, Trash2 } from 'lucide-react'

import { Button } from '@/components/Button'
import { ChartFrame } from '@/components/ChartFrame'
import { ImageCropModal } from '@/components/ImageCropModal'
import { SIGILS } from '@/components/Sigils'
import { cn } from '@/lib/cn'
import { readFileAsDataUrl } from '@/lib/cropImage'
import { formatAddress } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'
import { useWalletStore } from '@/stores/walletStore'

interface ProfileData {
  username: string
  displayName: string
  bio: string
  handle: string
  avatarIdx: number
  /** Cropped 1:1 image as a data URL; when set, overrides `avatarIdx`. */
  customImage: string | null
}

const DEFAULT_DATA: ProfileData = {
  username: 'zero.cooler',
  displayName: 'Zero Cooler',
  bio: 'Gradient-curve believer. Long vol, short patience.',
  handle: 'zerocooler',
  avatarIdx: 4,
  customImage: null,
}

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/
const RESERVED = new Set(['admin', 'root', 'levx', 'null', 'void'])

// Season stats — placeholder until wired to Supabase/on-chain.
const SEASON_STATS = {
  rank: 142,
  accuracy: 72.8,
  markets: 12,
}

type Availability = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'

export function ProfilePage() {
  const connected = useWalletStore((s) => s.connected)
  const publicKey = useWalletStore((s) => s.publicKey)
  const cluster = useWalletStore((s) => s.cluster)
  const walletAddress = publicKey?.toBase58()

  const [data, setData] = useState<ProfileData>(DEFAULT_DATA)
  const [checkResult, setCheckResult] = useState<{ name: string; ok: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pendingUpload, setPendingUpload] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPendingUpload(dataUrl)
    } catch (err) {
      console.error('Failed to read image', err)
    }
  }

  const handleCropApply = (croppedDataUrl: string) => {
    setData((d) => ({ ...d, customImage: croppedDataUrl }))
    setPendingUpload(null)
  }

  const clearCustomImage = () => {
    setData((d) => ({ ...d, customImage: null }))
  }

  // Only the async debounce lives in an effect; idle/invalid/checking are
  // derived synchronously below.
  useEffect(() => {
    if (!data.username || !USERNAME_RE.test(data.username)) return
    const t = window.setTimeout(() => {
      setCheckResult({
        name: data.username,
        ok: !RESERVED.has(data.username),
      })
    }, 520)
    return () => window.clearTimeout(t)
  }, [data.username])

  const availability: Availability = !data.username
    ? 'idle'
    : !USERNAME_RE.test(data.username)
      ? 'invalid'
      : checkResult?.name === data.username
        ? checkResult.ok
          ? 'ok'
          : 'taken'
        : 'checking'

  const charCount = data.bio.length
  const charMax = 160

  const canSave =
    availability === 'ok' &&
    data.displayName.trim().length >= 2 &&
    charCount <= charMax

  const onCopyAddress = () => {
    if (!walletAddress) return
    void navigator.clipboard?.writeText(walletAddress)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const onSave = () => {
    // TODO: wire to Supabase profile table
    console.log('save profile', data)
  }

  if (!connected) {
    return (
      <PageLayout title="Profile" subtitle="Your public profile">
        <div className="border-line-strong flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-24">
          <Lock size={32} strokeWidth={1.5} className="text-ink-dim" />
          <p className="text-ink-muted font-mono text-label uppercase">
            [ Connect a wallet to edit your profile ]
          </p>
        </div>
      </PageLayout>
    )
  }

  const Sigil = SIGILS[data.avatarIdx] ?? SIGILS[0]

  return (
    <>
    <PageLayout
      title="Profile"
      subtitle="Your public profile"
      summaryBar={
        <div className="flex flex-wrap items-center gap-12 pb-8">
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Season Rank
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              #{SEASON_STATS.rank}
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Accuracy
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {SEASON_STATS.accuracy.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Markets
            </div>
            <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
              {SEASON_STATS.markets}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-label text-ink-muted mb-2 font-mono uppercase">
              Wallet
            </div>
            <div className="text-ink font-mono text-sm tracking-snug flex items-center justify-end gap-3">
              <span>{walletAddress ? formatAddress(walletAddress) : '—'}</span>
              {cluster && (
                <>
                  <span className="text-line-strong">·</span>
                  <span className="text-ink-muted text-caption uppercase">
                    {cluster}
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={onCopyAddress}
                disabled={!walletAddress}
                aria-label="Copy address"
                className={cn(
                  'ml-1 flex items-center gap-1.5',
                  'text-ink-muted font-mono text-micro tracking-wider uppercase',
                  'transition-colors hover:text-ink-strong disabled:opacity-40',
                )}
              >
                {copied ? (
                  <>
                    <Check size={12} strokeWidth={2} className="text-brand-to" />
                    <span className="text-brand-to">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} strokeWidth={1.5} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-8 flex items-baseline justify-between pb-4">
        <h2 className="text-ink-strong font-mono text-caption font-bold tracking-wide uppercase">
          Public Identity
        </h2>
        <span className="text-ink-dim font-mono text-micro tracking-wider uppercase">
          // Edit
        </span>
      </div>

      <ChartFrame glow>
        <div className="grid grid-cols-1 [@media(min-width:960px)]:grid-cols-[360px_1fr]">
          {/* ═══ LEFT: IDENTITY ═══ */}
          <div className="relative border-line px-8 py-8 [@media(min-width:960px)]:border-r">
            {/* Ambient radial wash behind the sigil */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(circle at 50% 28%, color-mix(in srgb, var(--color-brand-to) 10%, transparent), transparent 55%)',
              }}
            />

            <div className="relative mt-2 mb-6 flex flex-col items-center">
              <motion.div
                key={data.customImage ? 'custom' : `sigil-${data.avatarIdx}`}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                className={cn(
                  'relative flex h-[120px] w-[120px] items-center justify-center overflow-hidden',
                  'border-ink-strong rounded-full border',
                  'bg-surface-1',
                )}
                style={{
                  boxShadow:
                    '0 0 0 6px var(--color-surface), 0 0 0 7px color-mix(in srgb, var(--color-brand-to) 60%, transparent)',
                }}
              >
                {data.customImage ? (
                  <img
                    src={data.customImage}
                    alt="Profile"
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <Sigil size={76} tone="strong" />
                )}
              </motion.div>

              <div className="mt-6 flex items-center gap-3">
                <span className="text-ink-strong font-mono text-caption tracking-snug">
                  {data.displayName || '—'}
                </span>
                <span className="text-ink-dim font-mono text-label tracking-wider uppercase">
                  @{data.username || '······'}
                </span>
              </div>
            </div>

            <FieldLabel idx="01" label="Profile Image" />

            <div className="mt-4 grid grid-cols-4 gap-2">
              {SIGILS.map((Glyph, i) => {
                const selected = !data.customImage && data.avatarIdx === i
                return (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() =>
                      setData((d) => ({ ...d, avatarIdx: i, customImage: null }))
                    }
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className={cn(
                      'group relative flex aspect-square items-center justify-center',
                      'rounded-md border',
                      'duration-short ease-levx transition-[border-color,background-color]',
                      selected
                        ? 'border-ink-strong bg-surface-1'
                        : 'border-line bg-transparent hover:border-ink-muted',
                    )}
                  >
                    <Glyph size={36} tone={selected ? 'accent' : 'strong'} />
                    {selected && (
                      <span
                        className={cn(
                          'absolute -top-1 -right-1 h-3 w-3',
                          'border-surface bg-brand-to rounded-full border',
                        )}
                      />
                    )}
                  </motion.button>
                )
              })}

              {/* Shuffle */}
              <motion.button
                type="button"
                whileTap={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    avatarIdx: (d.avatarIdx + 1 + Math.floor(Math.random() * 7)) % SIGILS.length,
                    customImage: null,
                  }))
                }
                className={cn(
                  'flex aspect-square items-center justify-center',
                  'border-line-strong text-ink-muted rounded-md border border-dashed',
                  'hover:border-ink hover:text-ink-strong transition-colors',
                )}
                aria-label="Randomize sigil"
              >
                <Shuffle size={16} strokeWidth={1.5} />
              </motion.button>

              {/* Upload / custom image cell */}
              {data.customImage ? (
                <div
                  className={cn(
                    'group relative flex aspect-square items-center justify-center overflow-hidden',
                    'border-ink-strong bg-surface-1 rounded-md border',
                  )}
                >
                  <img
                    src={data.customImage}
                    alt="Uploaded"
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  {/* Selected pip — matches sigil cell treatment */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -top-1 -right-1 h-3 w-3',
                      'border-surface bg-brand-to rounded-full border',
                    )}
                  />
                  {/* Hover overlay: re-upload + remove */}
                  <div
                    className={cn(
                      'absolute inset-0 flex items-center justify-center gap-1.5',
                      'bg-surface/75 opacity-0 group-hover:opacity-100',
                      'duration-short ease-levx transition-opacity',
                    )}
                  >
                    <button
                      type="button"
                      onClick={openFilePicker}
                      aria-label="Replace image"
                      className={cn(
                        'border-ink-strong text-ink-strong rounded-md border bg-transparent p-1',
                        'hover:bg-surface-1 transition-colors',
                      )}
                    >
                      <Camera size={12} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={clearCustomImage}
                      aria-label="Remove image"
                      className={cn(
                        'border-accent text-accent rounded-md border bg-transparent p-1',
                        'hover:bg-accent-subtle transition-colors',
                      )}
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openFilePicker}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center gap-1',
                    'border-line-strong text-ink-muted rounded-md border border-dashed',
                    'hover:border-ink hover:text-ink-strong transition-colors',
                  )}
                >
                  <Camera size={14} strokeWidth={1.5} />
                  <span className="font-mono text-label tracking-wider uppercase">Upload</span>
                </button>
              )}
            </div>

            {/* Hidden file input — triggered by Upload / replace buttons */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>

          {/* ═══ RIGHT: FORM ═══ */}
          <div className="px-8 py-8">
            <div className="space-y-7">
              <FormRow index="02" label="Username" hint="3–20 · lowercase · [a-z 0-9 _ .]">
                <div className="relative flex items-baseline gap-2">
                  <span className="text-ink-dim font-mono text-2xl">@</span>
                  <input
                    ref={firstInputRef}
                    value={data.username}
                    onChange={(e) =>
                      setData((d) => ({ ...d, username: e.target.value.toLowerCase() }))
                    }
                    maxLength={20}
                    spellCheck={false}
                    className="text-ink-strong w-0 min-w-0 flex-1 font-mono text-2xl"
                  />
                  <AvailabilityBadge state={availability} />
                </div>
              </FormRow>

              <FormRow index="03" label="Display Name" hint="How you appear on leaderboards">
                <input
                  value={data.displayName}
                  onChange={(e) => setData((d) => ({ ...d, displayName: e.target.value }))}
                  maxLength={32}
                  className="text-ink-strong w-full font-sans text-2xl font-medium tracking-tight"
                />
              </FormRow>

              <FormRow
                index="04"
                label="Bio"
                hint={`${charCount} / ${charMax}`}
                hintTone={charCount > charMax ? 'accent' : 'muted'}
              >
                <textarea
                  value={data.bio}
                  onChange={(e) => setData((d) => ({ ...d, bio: e.target.value }))}
                  rows={2}
                  className="text-ink w-full resize-none font-sans text-body-sm leading-snug"
                />
              </FormRow>

              <FormRow index="05" label="X / Twitter" hint="Optional">
                <div className="flex items-baseline gap-2">
                  <span className="text-ink-dim font-mono text-body">@</span>
                  <input
                    value={data.handle}
                    onChange={(e) => setData((d) => ({ ...d, handle: e.target.value }))}
                    className="text-ink-strong w-0 min-w-0 flex-1 font-mono text-body"
                  />
                </div>
              </FormRow>
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <footer
          className={cn(
            'flex items-center justify-end',
            'border-line bg-surface-1/40 border-t px-8 py-5',
          )}
        >
          <Button
            variant="primary"
            disabled={!canSave}
            onClick={onSave}
            className="min-w-[200px]"
          >
            Save Profile
          </Button>
        </footer>
      </ChartFrame>
    </PageLayout>

    <ImageCropModal
      open={pendingUpload !== null}
      imageSrc={pendingUpload}
      onClose={() => setPendingUpload(null)}
      onApply={handleCropApply}
    />
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════

function FieldLabel({ idx, label }: { idx: string; label: string }) {
  return (
    <div className="relative flex items-baseline gap-2">
      <span className="text-ink-dim font-mono text-micro tracking-wider">[{idx}]</span>
      <span className="text-ink-muted font-mono text-label tracking-wider uppercase">
        {label}
      </span>
      <span className="border-line flex-1 translate-y-[-3px] border-b border-dashed" />
    </div>
  )
}

function FormRow({
  index,
  label,
  hint,
  hintTone = 'muted',
  children,
}: {
  index: string
  label: string
  hint?: string
  hintTone?: 'muted' | 'accent'
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-ink-dim font-mono text-micro tracking-wider">[{index}]</span>
          <span className="text-ink-muted font-mono text-label tracking-wider uppercase">
            {label}
          </span>
        </div>
        {hint && (
          <span
            className={cn(
              'font-mono text-label tracking-wider uppercase',
              hintTone === 'accent' ? 'text-accent' : 'text-ink-dim',
            )}
          >
            {hint}
          </span>
        )}
      </div>
      <div
        className={cn(
          'border-line-strong border-b pb-2',
          'duration-short ease-levx transition-[border-color]',
          'focus-within:border-ink-strong',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function AvailabilityBadge({ state }: { state: Availability }) {
  const text = useMemo(() => {
    switch (state) {
      case 'checking':
        return 'CHECKING···'
      case 'ok':
        return '[ AVAILABLE ]'
      case 'taken':
        return '[ TAKEN ]'
      case 'invalid':
        return '[ INVALID ]'
      default:
        return ''
    }
  }, [state])

  const tone =
    state === 'ok'
      ? 'text-brand-to'
      : state === 'taken' || state === 'invalid'
        ? 'text-accent'
        : 'text-ink-muted'

  return (
    <span
      className={cn(
        'font-mono text-label tracking-wider uppercase whitespace-nowrap',
        tone,
      )}
    >
      {text}
    </span>
  )
}
