import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper, { type Area } from 'react-easy-crop'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

import { Button } from '@/ui/Button'
import { cn } from '@/lib/cn'
import { getCroppedImage } from '@/lib/cropImage'

interface ImageCropModalProps {
  open: boolean
  imageSrc: string | null
  onClose: () => void
  onApply: (croppedDataUrl: string) => void
}

export function ImageCropModal({ open, imageSrc, onClose, onApply }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  // Reset state every time a fresh image opens
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setPixelCrop(null)
    }
  }, [open, imageSrc])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setPixelCrop(areaPixels)
  }, [])

  const handleApply = async () => {
    if (!imageSrc || !pixelCrop) return
    setBusy(true)
    try {
      const dataUrl = await getCroppedImage(imageSrc, pixelCrop)
      onApply(dataUrl)
    } finally {
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && imageSrc && (
        <motion.div
          key="crop-backdrop"
          className="z-modal fixed inset-0 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <button
            aria-label="Close"
            onClick={onClose}
            className="bg-surface/80 absolute inset-0 cursor-default backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: 8 }}
            transition={{ duration: 0.26, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-full max-w-[560px]"
          >
            <div className="border-line-strong bg-surface relative overflow-hidden rounded-2xl border">
              {/* Corner crosshairs */}
              <CornerTick pos="tl" />
              <CornerTick pos="tr" />
              <CornerTick pos="bl" />
              <CornerTick pos="br" />

              {/* Header */}
              <header className="border-line flex items-center justify-between gap-4 border-b px-6 py-4">
                <h2 className="font-display text-ink-strong text-[18px] leading-none font-medium tracking-tight">
                  CROP IMAGE
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className={cn(
                    'group flex items-center gap-2',
                    'border-line-strong rounded-md border px-2.5 py-1.5',
                    'text-ink-muted text-micro font-mono tracking-wider uppercase',
                    'hover:border-ink hover:text-ink-strong transition-colors',
                  )}
                >
                  <span>ESC</span>
                  <X
                    size={12}
                    strokeWidth={1.75}
                    className="text-ink-muted group-hover:text-ink-strong"
                  />
                </button>
              </header>

              {/* Cropper surface */}
              <div className="bg-surface-1 relative h-[400px]">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={handleCropComplete}
                  style={{
                    containerStyle: {
                      background: 'var(--color-surface-1)',
                    },
                    cropAreaStyle: {
                      border: '1px solid var(--color-brand-to)',
                      boxShadow:
                        '0 0 0 9999px color-mix(in srgb, var(--color-surface) 72%, transparent)',
                    },
                  }}
                />
              </div>

              {/* Zoom control */}
              <div className="border-line border-t px-6 py-4">
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label="Zoom"
                  className={cn(
                    'h-1 w-full cursor-ew-resize appearance-none rounded-full',
                    'bg-line-strong accent-brand-to',
                    '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5',
                    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
                    '[&::-webkit-slider-thumb]:bg-brand-to [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--color-brand-to)]',
                  )}
                />
              </div>

              {/* Footer */}
              <footer className="border-line bg-surface-1/40 flex items-center justify-between gap-4 border-t px-6 py-4">
                <span className="text-ink-dim text-micro font-mono tracking-wider uppercase">
                  Drag to reposition · <br /> Scroll or slide to zoom
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={onClose} className="px-4" disabled={busy}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleApply}
                    disabled={!pixelCrop || busy}
                    className="min-w-[108px] px-4"
                  >
                    {busy ? 'Cropping…' : 'Apply'}
                  </Button>
                </div>
              </footer>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function CornerTick({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'z-above pointer-events-none absolute h-3 w-3'
  const byPos: Record<typeof pos, string> = {
    tl: 'top-2 left-2 border-t border-l',
    tr: 'top-2 right-2 border-t border-r',
    bl: 'bottom-2 left-2 border-b border-l',
    br: 'bottom-2 right-2 border-b border-r',
  }
  return <span aria-hidden className={cn(base, byPos[pos], 'border-ink-strong')} />
}
