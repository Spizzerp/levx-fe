import { useEffect, useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { PublicKey } from '@solana/web3.js'

import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { cn } from '@/lib/cn'
import { useWalletStore } from '@/stores/walletStore'
import { formatAddress } from '@/lib/format'

function isValidSolanaAddress(addr: string): boolean {
  try {
    const key = new PublicKey(addr)
    // PublicKey constructor is lenient — require canonical base58 round-trip.
    return key.toBase58() === addr
  } catch {
    return false
  }
}

interface WaitlistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (payload: WaitlistPayload) => Promise<void> | void
}

export interface WaitlistPayload {
  email: string
  xUsername: string
  walletAddress: string
}

type Status = 'idle' | 'submitting' | 'success'

export function WaitlistModal({ open, onOpenChange, onSubmit }: WaitlistModalProps) {
  const publicKey = useWalletStore((s) => s.publicKey)
  const connected = useWalletStore((s) => s.connected)
  const connectedAddress = publicKey ? publicKey.toBase58() : ''

  const [email, setEmail] = useState('')
  const [xUsername, setXUsername] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const effectiveAddress = connected ? connectedAddress : manualAddress.trim()

  useEffect(() => {
    if (open) return
    // Reset after exit animation
    const t = window.setTimeout(() => {
      setEmail('')
      setXUsername('')
      setManualAddress('')
      setStatus('idle')
      setError(null)
    }, 250)
    return () => window.clearTimeout(t)
  }, [open])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (!xUsername.trim()) {
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

    setStatus('submitting')
    try {
      const cleanedX = xUsername.trim().replace(/^@/, '')
      await onSubmit?.({
        email: email.trim(),
        xUsername: cleanedX,
        walletAddress: effectiveAddress,
      })
      setStatus('success')
    } catch (err) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} label="[ EARLY ACCESS ]" size="md">
      {status === 'success' ? (
        <SuccessPanel onClose={() => onOpenChange(false)} />
      ) : (
        <>
          <div className="px-6 pt-6 pb-2">
            <Modal.Title className="font-display text-ink-strong text-[28px] leading-none font-medium tracking-tighter [font-variation-settings:'ROND'_100]">
              Join the Waitlist
            </Modal.Title>
            <p className="text-ink-muted text-micro mt-3 font-mono tracking-wider uppercase">
              Predict the path · get early access
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 pt-4 pb-6">
            <div className="flex flex-col gap-5">
              <Field
                id="waitlist-email"
                label="User Email"
                type="email"
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={setEmail}
                disabled={status === 'submitting'}
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
                disabled={status === 'submitting'}
              />
              <WalletField
                connected={connected}
                connectedAddress={connectedAddress}
                manualAddress={manualAddress}
                onManualChange={setManualAddress}
                disabled={status === 'submitting'}
              />
            </div>

            <div
              className={cn(
                'text-micro mt-5 min-h-[18px] font-mono tracking-wider uppercase',
                error ? 'text-accent' : 'text-ink-dim',
              )}
              role={error ? 'alert' : undefined}
            >
              {error ?? '— All fields required —'}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Modal.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-caption px-4"
                  disabled={status === 'submitting'}
                >
                  Cancel
                </Button>
              </Modal.Close>
              <Button
                type="submit"
                variant="primary"
                className="text-caption min-w-[180px] px-6"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? 'Joining…' : 'Join Waitlist'}
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
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
}: FieldProps) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-ink-muted text-micro font-mono tracking-wider uppercase">
        {label}
      </label>
      <div
        className={cn(
          'border-line-strong mt-2 flex items-center gap-2 border-b py-2',
          'duration-short ease-levx transition-[border-color]',
          'focus-within:border-ink-strong',
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
}

function WalletField({
  connected,
  connectedAddress,
  manualAddress,
  onManualChange,
  disabled,
}: WalletFieldProps) {
  const statusText = connected ? '● Connected' : manualAddress ? '● Manual' : '● Not Connected'
  const statusTone = connected
    ? 'text-success'
    : manualAddress
      ? 'text-ink-muted'
      : 'text-ink-dim'

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <label
          htmlFor="waitlist-wallet"
          className="text-ink-muted text-micro font-mono tracking-wider uppercase"
        >
          Wallet Address
        </label>
        <span className={cn('text-nano font-mono tracking-wider uppercase', statusTone)}>
          {statusText}
        </span>
      </div>

      {connected ? (
        <div className="border-line-strong text-ink-strong mt-2 flex items-center gap-2 border-b py-2">
          <span className="text-ui flex-1 truncate font-mono">{connectedAddress}</span>
          <span className="text-ink-dim text-micro font-mono tracking-wider uppercase">
            {formatAddress(connectedAddress)}
          </span>
        </div>
      ) : (
        <div
          className={cn(
            'border-line-strong mt-2 flex items-center gap-2 border-b py-2',
            'duration-short ease-levx transition-[border-color]',
            'focus-within:border-ink-strong',
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

function SuccessPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="border-line-strong text-success flex h-14 w-14 items-center justify-center rounded-full border">
        <Check size={22} strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-ink-strong text-heading mt-5 leading-none font-medium tracking-tighter">
        You're on the list
      </h3>
      <p className="text-ink-muted text-micro mt-3 max-w-[320px] font-mono tracking-wider uppercase">
        We'll reach out when your spot opens up.
      </p>
      <Button variant="secondary" className="mt-6 px-6" onClick={onClose}>
        Close
      </Button>
    </div>
  )
}
