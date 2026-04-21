import { useEffect, useMemo, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { motion } from 'motion/react'
import { Camera, Check, Copy, Lock, Shuffle, Trash2 } from 'lucide-react'

import { Button } from '@/ui/Button'
import { ChartFrame } from '@/features/chart/ChartFrame'
import { ProfilePageSkeleton } from '@/features/profile/ProfilePageSkeleton'
import { ImageCropModal } from '@/ui/ImageCropModal'
import { SIGILS } from '@/ui/Sigils'
import { cn } from '@/lib/cn'
import { readFileAsDataUrl } from '@/lib/cropImage'
import { formatAddress } from '@/lib/format'
import { PageLayout } from '@/layouts/PageLayout'
import {
  checkUsernameAvailability,
  getProfileImageUrl,
  useProfile,
  useSaveProfile,
  useSupabaseAuth,
} from '@/lib/supabase/hooks'
import type { Profile } from '@/lib/supabase/types'
import { useWalletStore } from '@/stores/walletStore'
import { toast } from '@/stores/toastStore'

interface ProfileData {
  username: string
  displayName: string
  bio: string
  xId: string
  avatarIdx: number
  customImage: string | null
}

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/
const RESERVED = new Set(['admin', 'root', 'levx', 'null', 'void'])
const CHAR_MAX = 160

const SEASON_STATS = {
  rank: 142,
  accuracy: 72.8,
  markets: 12,
}

type Availability = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'
type UsernameCheckState = {
  name: string
  ok: boolean | null
  error: string | null
}
type DraftState = {
  hydrationKey: string | null
  data: ProfileData
}

export function ProfilePage() {
  const { status, authenticate } = useSupabaseAuth()
  const connected = useWalletStore((s) => s.connected)
  const publicKey = useWalletStore((s) => s.publicKey)
  const cluster = useWalletStore((s) => s.cluster)
  const walletAddress = publicKey?.toBase58() ?? null
  const { wallet: walletAdapter } = useWallet()
  const walletName = walletAdapter?.adapter.name ?? 'Unknown Wallet'

  const profileQuery = useProfile(walletAddress)
  const saveProfile = useSaveProfile()

  const hydrationKey = walletAddress
    ? profileQuery.data
      ? `${walletAddress}:${profileQuery.data.updated_at}`
      : profileQuery.isSuccess
        ? `${walletAddress}:new`
        : null
    : 'disconnected'

  const hydratedData = profileQuery.data
    ? profileToForm(profileQuery.data)
    : buildDefaultData(walletAddress)

  const [draft, setDraft] = useState<DraftState>(() => ({
    hydrationKey,
    data: hydratedData,
  }))
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState | null>(null)
  const [copied, setCopied] = useState(false)
  const [pendingUpload, setPendingUpload] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const data = draft.data

  if (hydrationKey !== null && draft.hydrationKey !== hydrationKey) {
    setDraft({
      hydrationKey,
      data: hydratedData,
    })
  }

  useEffect(() => {
    if (!data.username || !USERNAME_RE.test(data.username) || RESERVED.has(data.username)) return

    let cancelled = false
    const username = data.username

    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(username, walletAddress)
        .then((ok) => {
          if (!cancelled) setUsernameCheck({ name: username, ok, error: null })
        })
        .catch((error) => {
          if (!cancelled) {
            setUsernameCheck({
              name: username,
              ok: null,
              error: (error as Error).message,
            })
          }
        })
    }, 520)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [data.username, walletAddress])

  const availabilityError = usernameCheck?.name === data.username ? usernameCheck.error : null
  const availability: Availability = !data.username
    ? 'idle'
    : !USERNAME_RE.test(data.username)
      ? 'invalid'
      : RESERVED.has(data.username)
        ? 'taken'
        : usernameCheck?.name === data.username && usernameCheck.ok !== null
          ? usernameCheck.ok
            ? 'ok'
            : 'taken'
          : 'checking'

  const charCount = data.bio.length
  const profile = profileQuery.data ?? null
  const authReady = status === 'authenticated'
  const usernameReady =
    availability === 'ok' || (availabilityError !== null && availability !== 'taken')
  const canSave =
    status !== 'pending' &&
    usernameReady &&
    data.displayName.trim().length >= 2 &&
    charCount <= CHAR_MAX &&
    !saveProfile.isPending

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
      toast.error('Failed to read image', { message: (err as Error).message })
    }
  }

  const handleCropApply = (croppedDataUrl: string) => {
    setDraft((current) => ({
      ...current,
      data: { ...current.data, customImage: croppedDataUrl },
    }))
    setPendingUpload(null)
  }

  const clearCustomImage = () => {
    setDraft((current) => ({
      ...current,
      data: { ...current.data, customImage: null },
    }))
  }

  const onCopyAddress = () => {
    if (!walletAddress) return
    void navigator.clipboard?.writeText(walletAddress)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const onSave = async () => {
    if (!walletAddress) return

    try {
      if (!authReady) await authenticate()
      const saved = await saveProfile.mutateAsync({
        walletAddress,
        walletName,
        username: data.username.trim(),
        displayName: data.displayName.trim(),
        bio: data.bio.trim(),
        xId: normalizeXId(data.xId),
        avatarSigilIdx: data.avatarIdx,
        avatarKind: data.customImage ? 'image' : 'sigil',
        avatarPreview: data.customImage,
        existingProfile: profile,
      })
      setDraft({
        hydrationKey: `${walletAddress}:${saved.updated_at}`,
        data: profileToForm(saved),
      })
      toast.success('Profile saved')
    } catch (error) {
      const message = humanizeProfileError(error)
      toast.error('Failed to save profile', { message })
    }
  }

  if (!connected) {
    return (
      <PageLayout title="Profile" subtitle="Your public profile">
        <div className="border-line-strong flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-24">
          <Lock size={32} strokeWidth={1.5} className="text-ink-dim" />
          <p className="text-ink-muted text-label font-mono uppercase">
            [ Connect a wallet to edit your profile ]
          </p>
        </div>
      </PageLayout>
    )
  }

  const Sigil = SIGILS[data.avatarIdx] ?? SIGILS[0]
  const authHint =
    status === 'pending'
      ? 'Wallet signature verification in progress.'
      : status === 'error'
        ? 'Wallet verification failed. Save will retry authentication.'
        : availabilityError
          ? 'Username check degraded. Save still validates server-side.'
          : profileQuery.isLoading
            ? 'Loading your profile.'
            : null

  return (
    <>
      <PageLayout
        title="Profile"
        subtitle="Your public profile"
        summaryBar={
          <div className="flex flex-wrap items-center gap-12 pb-8">
            <div>
              <div className="text-label text-ink-muted mb-2 font-mono uppercase">Season Rank</div>
              <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
                #{SEASON_STATS.rank}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-muted mb-2 font-mono uppercase">Accuracy</div>
              <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
                {SEASON_STATS.accuracy.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-label text-ink-muted mb-2 font-mono uppercase">Markets</div>
              <div className="text-ink-strong font-mono text-3xl font-bold tracking-[0.02em]">
                {SEASON_STATS.markets}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-label text-ink-muted mb-2 font-mono uppercase">Wallet</div>
              <div className="text-ink tracking-snug flex items-center justify-end gap-3 font-mono text-sm">
                <span>{walletAddress ? formatAddress(walletAddress) : '—'}</span>
                {cluster && (
                  <>
                    <span className="text-line-strong">·</span>
                    <span className="text-ink-muted text-caption uppercase">{cluster}</span>
                  </>
                )}
                <span className="text-line-strong">·</span>
                <span className="text-ink-muted text-caption uppercase">{walletName}</span>
                <button
                  type="button"
                  onClick={onCopyAddress}
                  disabled={!walletAddress}
                  aria-label="Copy address"
                  className={cn(
                    'ml-1 flex items-center gap-1.5',
                    'text-ink-muted text-micro font-mono tracking-wider uppercase',
                    'hover:text-ink-strong transition-colors disabled:opacity-40',
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
          <h2 className="text-ink-strong text-caption font-mono font-bold tracking-wide uppercase">
            Public Identity
          </h2>
          <span className="text-ink-dim text-micro font-mono tracking-wider uppercase">
            // Edit
          </span>
        </div>

        {profileQuery.isLoading ? (
          <ProfilePageSkeleton />
        ) : (
          <ChartFrame glow className="isolate overflow-visible!">
            <div className="grid grid-cols-1 [@media(min-width:960px)]:grid-cols-[360px_1fr]">
              <div className="border-line relative px-8 py-8 [@media(min-width:960px)]:border-r">
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
                    <span className="text-ink-strong text-caption tracking-snug font-mono">
                      {data.displayName || '—'}
                    </span>
                    <span className="text-ink-dim text-label font-mono tracking-wider uppercase">
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
                          setDraft((current) => ({
                            ...current,
                            data: { ...current.data, avatarIdx: i, customImage: null },
                          }))
                        }
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        className={cn(
                          'group relative flex aspect-square items-center justify-center',
                          'rounded-md border',
                          'duration-short ease-levx transition-[border-color,background-color]',
                          selected
                            ? 'border-ink-strong bg-surface-1'
                            : 'border-line hover:border-ink-muted bg-transparent',
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

                  <motion.button
                    type="button"
                    whileTap={{ rotate: 180 }}
                    transition={{ duration: 0.3 }}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        data: {
                          ...current.data,
                          avatarIdx:
                            (current.data.avatarIdx + 1 + Math.floor(Math.random() * 7))
                            % SIGILS.length,
                          customImage: null,
                        },
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
                      <span
                        aria-hidden
                        className={cn(
                          'absolute -top-1 -right-1 h-3 w-3',
                          'border-surface bg-brand-to rounded-full border',
                        )}
                      />
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
                      <span className="text-micro font-mono tracking-wider uppercase">Upload</span>
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelected}
                />
              </div>

              <div className="px-8 py-8">
                <div className="space-y-7">
                  <FormRow index="02" label="Username" hint="3–20 · lowercase · [a-z 0-9 _ .]">
                    <div className="relative flex items-baseline gap-2">
                      <span className="text-ink-dim font-mono text-2xl">@</span>
                      <input
                        value={data.username}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            data: {
                              ...current.data,
                              username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''),
                            },
                          }))
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
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          data: { ...current.data, displayName: e.target.value },
                        }))
                      }
                      maxLength={32}
                      className="text-ink-strong w-full font-sans text-2xl font-medium tracking-tight"
                    />
                  </FormRow>

                  <FormRow
                    index="04"
                    label="Bio"
                    hint={`${charCount} / ${CHAR_MAX}`}
                    hintTone={charCount > CHAR_MAX ? 'accent' : 'muted'}
                  >
                    <textarea
                      value={data.bio}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          data: { ...current.data, bio: e.target.value },
                        }))
                      }
                      rows={2}
                      className="text-ink text-body-sm w-full resize-none font-sans leading-snug"
                    />
                  </FormRow>

                  <FormRow index="05" label="X / Twitter" hint="Optional">
                    <div className="flex items-baseline gap-2">
                      <span className="text-ink-dim text-body font-mono">@</span>
                      <input
                        value={data.xId}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            data: { ...current.data, xId: normalizeXId(e.target.value) },
                          }))
                        }
                        maxLength={32}
                        className="text-ink-strong text-body w-0 min-w-0 flex-1 font-mono"
                      />
                    </div>
                  </FormRow>
                </div>
              </div>
            </div>

            <footer className="border-line flex items-center justify-between gap-6 border-t px-8 py-5">
              <div className="text-ink-dim text-micro max-w-[420px] font-mono tracking-wider uppercase">
                {authHint ??
                  'Profile writes are bound to the connected wallet and enforced by RLS.'}
              </div>
              <Button
                variant="primary"
                disabled={!canSave}
                onClick={onSave}
                className="min-w-[200px]"
              >
                {saveProfile.isPending
                  ? 'Saving…'
                  : status === 'pending'
                    ? 'Verifying…'
                    : 'Save Profile'}
              </Button>
            </footer>
          </ChartFrame>
        )}
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

function buildDefaultData(walletAddress: string | null): ProfileData {
  const suffix = walletAddress ? walletAddress.slice(0, 8).toLowerCase() : 'cooler'
  return {
    username: `user_${suffix}`.slice(0, 20),
    displayName: walletAddress ? `Trader ${formatAddress(walletAddress)}` : 'Zero Cooler',
    bio: 'Calibrating curves. Profiling markets. Hunting clean entries.',
    xId: '',
    avatarIdx: 4,
    customImage: null,
  }
}

function profileToForm(profile: Profile): ProfileData {
  return {
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    xId: profile.x_id,
    avatarIdx: profile.avatar_sigil_idx,
    customImage: getProfileImageUrl(profile.avatar_image_path),
  }
}

function normalizeXId(input: string): string {
  return input.replace(/^@+/, '').trim()
}

function humanizeProfileError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('EDGE_JWT_SECRET') || message.includes('Wallet verify is misconfigured')) {
    return 'Server is missing the JWT signing secret for wallet verify. Ask the team to set Edge secret EDGE_JWT_SECRET (Dashboard → API).'
  }
  if (message.includes('duplicate key') && message.includes('users_username_key')) {
    return 'Username is already taken.'
  }
  if (message.includes('duplicate key') && message.includes('username'))
    return 'Username is already taken.'
  if (message.includes('users_username_format')) return 'Username format is invalid.'
  if (message.includes('users_avatar_shape')) return 'Profile image state is inconsistent.'
  if (message.includes('User rejected')) return 'Wallet signature was rejected.'
  return message
}

function FieldLabel({ idx, label }: { idx: string; label: string }) {
  return (
    <div className="relative flex items-baseline gap-2">
      <span className="text-ink-dim text-micro font-mono tracking-wider">[{idx}]</span>
      <span className="text-ink-muted text-label font-mono tracking-wider uppercase">{label}</span>
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
          <span className="text-ink-dim text-micro font-mono tracking-wider">[{index}]</span>
          <span className="text-ink-muted text-label font-mono tracking-wider uppercase">
            {label}
          </span>
        </div>
        {hint && (
          <span
            className={cn(
              'text-label font-mono tracking-wider uppercase',
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
    <span className={cn('text-label font-mono tracking-wider whitespace-nowrap uppercase', tone)}>
      {text}
    </span>
  )
}
