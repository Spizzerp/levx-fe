import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { PublicKey } from '@solana/web3.js'

import { Button } from '@/ui/Button'
import { cn } from '@/lib/cn'
import { useWalletStore } from '@/stores/walletStore'
import { formatAddress } from '@/lib/format'

export interface WaitlistPayload {
  email: string
  xUsername: string
  walletAddress: string
}

type Status = 'idle' | 'submitting' | 'success'

function isValidSolanaAddress(addr: string): boolean {
  try {
    const key = new PublicKey(addr)
    // PublicKey constructor is lenient — require canonical base58 round-trip.
    return key.toBase58() === addr
  } catch {
    return false
  }
}

interface WaitlistFormProps {
  onSubmit?: (payload: WaitlistPayload) => Promise<void> | void
  /** Render an optional secondary action (e.g. Cancel) to the left of Submit. */
  renderSecondary?: (args: { disabled: boolean }) => ReactNode
  /** If provided, the success panel renders a Close button with this handler. */
  onSuccessClose?: () => void
  /** Extra classes merged onto the form root (idle state) or success panel. */
  className?: string
  /** Palette preset. `dark` is used on the inline landing section; `card` matches the modal surface. */
  tone?: 'card' | 'dark'
}

export function WaitlistForm({
  onSubmit,
  renderSecondary,
  onSuccessClose,
  className,
  tone = 'card',
}: WaitlistFormProps) {
  const publicKey = useWalletStore((s) => s.publicKey)
  const connected = useWalletStore((s) => s.connected)
  const connectedAddress = publicKey ? publicKey.toBase58() : ''

  const [email, setEmail] = useState('')
  const [xUsername, setXUsername] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  // `status` is React state — setting it is async. Between
  // `setStatus('submitting')` and the re-render that disables the
  // submit button, a fast double-click (or Enter keypress twice) can
  // re-enter `handleSubmit` and fire `onSubmit` twice. A synchronous
  // ref gives us a same-tick guard that the state check can't provide.
  const submittingRef = useRef(false)

  const effectiveAddress = connected ? connectedAddress : manualAddress.trim()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submittingRef.current) return
    setError(null)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    const cleanedX = xUsername.trim().replace(/^@/, '')
    if (!cleanedX) {
      setError('X (Twitter) username is required.')
      return
    }
    if (!effectiveAddress) {
      setError('Enter a wallet address.')
      return
    }
    if (!isValidSolanaAddress(effectiveAddress)) {
      setError('Invalid Solana wallet address.')
      return
    }

    submittingRef.current = true
    setStatus('submitting')
    try {
      await onSubmit?.({
        email: email.trim(),
        xUsername: cleanedX,
        walletAddress: effectiveAddress,
      })
      setStatus('success')
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      submittingRef.current = false
    }
  }

  if (status === 'success') {
    return <SuccessPanel onClose={onSuccessClose} tone={tone} className={className} />
  }

  const submitting = status === 'submitting'

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col', className)}>
      <div className="flex flex-col gap-5">
        <Field
          id="waitlist-email"
          label="User Email"
          type="email"
          autoComplete="email"
          placeholder="you@domain.com"
          value={email}
          onChange={setEmail}
          disabled={submitting}
          tone={tone}
        />
        <Field
          id="waitlist-x"
          label="X Username"
          type="text"
          autoComplete="off"
          placeholder="handle"
          prefix="@"
          value={xUsername}
          onChange={setXUsername}
          disabled={submitting}
          tone={tone}
        />
        <WalletField
          connected={connected}
          connectedAddress={connectedAddress}
          manualAddress={manualAddress}
          onManualChange={setManualAddress}
          disabled={submitting}
          tone={tone}
        />
      </div>

      <div
        className={cn(
          'text-micro mt-5 min-h-[18px] font-mono tracking-wider uppercase',
          error ? 'text-accent' : tone === 'dark' ? 'text-white' : 'text-ink-dim',
        )}
        role={error ? 'alert' : undefined}
      >
        {error ?? '— All fields required —'}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        {renderSecondary?.({ disabled: submitting })}
        <Button
          type="submit"
          variant="primary"
          className="text-caption min-w-[180px] px-6"
          disabled={submitting}
        >
          {submitting ? 'Joining…' : 'Join Waitlist'}
        </Button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────
// Content-only subcomponents
// ─────────────────────────────────────────────────────────────

interface FieldProps {
  id: string
  label: string
  type: 'text' | 'email'
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  prefix?: string
  tone: 'card' | 'dark'
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  prefix,
  tone,
}: FieldProps) {
  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className={cn(
          'text-micro font-mono tracking-wider uppercase',
          tone === 'dark' ? 'text-white' : 'text-ink-muted',
        )}
      >
        {label}
      </label>
      <div
        className={cn(
          'mt-2 flex items-center gap-2 border-b py-2',
          tone === 'dark' ? 'border-white/25' : 'border-line-strong',
          'duration-short ease-levx transition-[border-color]',
          tone === 'dark' ? 'focus-within:border-white' : 'focus-within:border-ink-strong',
          disabled && 'opacity-60',
        )}
      >
        {prefix && <span className="text-ink-dim text-ui font-mono">{prefix}</span>}
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'text-ink-strong text-ui w-0 min-w-0 flex-1 bg-transparent font-mono',
            'placeholder:text-ink-dim/80 focus:outline-none',
          )}
        />
      </div>
    </div>
  )
}

interface WalletFieldProps {
  connected: boolean
  connectedAddress: string
  manualAddress: string
  onManualChange: (v: string) => void
  disabled?: boolean
  tone: 'card' | 'dark'
}

function WalletField({
  connected,
  connectedAddress,
  manualAddress,
  onManualChange,
  disabled,
  tone,
}: WalletFieldProps) {
  const statusText = connected ? '● Connected' : manualAddress ? '● Manual' : '● Not Connected'
  const statusTone = connected
    ? 'text-success'
    : manualAddress
      ? 'text-ink-muted'
      : 'text-ink-dim'

  const borderBase = tone === 'dark' ? 'border-white/25' : 'border-line-strong'
  const borderFocus = tone === 'dark' ? 'focus-within:border-white' : 'focus-within:border-ink-strong'

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <label
          htmlFor="waitlist-wallet"
          className={cn(
            'text-micro font-mono tracking-wider uppercase',
            tone === 'dark' ? 'text-white' : 'text-ink-muted',
          )}
        >
          Wallet Address
        </label>
        <span className={cn('text-nano font-mono tracking-wider uppercase', statusTone)}>
          {statusText}
        </span>
      </div>

      {connected ? (
        <div
          className={cn(
            'text-ink-strong mt-2 flex items-center gap-2 border-b py-2',
            borderBase,
          )}
        >
          <span className="text-ui flex-1 truncate font-mono">{connectedAddress}</span>
          <span className="text-ink-dim text-micro font-mono tracking-wider uppercase">
            {formatAddress(connectedAddress)}
          </span>
        </div>
      ) : (
        <div
          className={cn(
            'mt-2 flex items-center gap-2 border-b py-2',
            borderBase,
            'duration-short ease-levx transition-[border-color]',
            borderFocus,
            disabled && 'opacity-60',
          )}
        >
          <input
            id="waitlist-wallet"
            type="text"
            value={manualAddress}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste Solana address…"
            disabled={disabled}
            onChange={(e) => onManualChange(e.target.value.trim())}
            className={cn(
              'text-ink-strong text-ui w-0 min-w-0 flex-1 bg-transparent font-mono',
              'placeholder:text-ink-dim/80 focus:outline-none',
            )}
          />
        </div>
      )}
    </div>
  )
}

function SuccessPanel({
  onClose,
  tone,
  className,
}: {
  onClose?: () => void
  tone: 'card' | 'dark'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div
        className={cn(
          'text-success flex h-14 w-14 items-center justify-center rounded-full border',
          tone === 'dark' ? 'border-white/30' : 'border-line-strong',
        )}
      >
        <Check size={22} strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-ink-strong text-heading mt-5 leading-none font-medium tracking-tighter">
        You're on the list
      </h3>
      <p className="text-ink-muted text-micro mt-3 max-w-[320px] font-mono tracking-wider uppercase">
        We'll reach out when your spot opens up.
      </p>
      {onClose && (
        <Button variant="secondary" className="mt-6 px-6" onClick={onClose}>
          Close
        </Button>
      )}
    </div>
  )
}
