import { useState } from 'react'

import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { WaitlistForm, type WaitlistPayload } from '@/ui/WaitlistForm'

export type { WaitlistPayload }

interface WaitlistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (payload: WaitlistPayload) => Promise<void> | void
}

export function WaitlistModal({ open, onOpenChange, onSubmit }: WaitlistModalProps) {
  // Remount the form each time the modal opens so internal state resets
  // cleanly after close. Simpler than plumbing an external reset handle
  // through WaitlistForm.
  const [mountKey, setMountKey] = useState(0)

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setMountKey((k) => k + 1)
        onOpenChange(next)
      }}
      label="[ EARLY ACCESS ]"
      size="md"
    >
      <div className="px-6 pt-6 pb-2">
        <Modal.Title className="font-display text-ink-strong text-[28px] leading-none font-medium tracking-tighter [font-variation-settings:'ROND'_100]">
          Join the Waitlist
        </Modal.Title>
        <p className="text-ink-muted text-micro mt-3 font-mono tracking-wider uppercase">
          Predict the path · get early access
        </p>
      </div>

      <div className="px-6 pt-4 pb-6">
        <WaitlistForm
          key={mountKey}
          onSubmit={onSubmit}
          onSuccessClose={() => onOpenChange(false)}
          renderSecondary={({ disabled }) => (
            <Modal.Close asChild>
              <Button
                type="button"
                variant="ghost"
                className="text-caption px-4"
                disabled={disabled}
              >
                Cancel
              </Button>
            </Modal.Close>
          )}
        />
      </div>
    </Modal>
  )
}
