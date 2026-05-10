import { useCallback, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { cn } from '@/lib/cn'

interface SegmentedSliderProps {
  value: number
  max: number
  min?: number
  values?: readonly number[]
  onChange?: (next: number) => void
  formatAriaValue?: (value: number) => string
}

// Brand-gradient endpoints — mirrors --color-brand-from / --color-brand-to
// in tokens.css. Hardcoded here so we can interpolate per-tick without
// round-tripping through getComputedStyle on every render.
const BRAND_FROM = [0xf4, 0xfa, 0x4d] as const // yellow-lime
const BRAND_TO = [0x5c, 0xf7, 0x8b] as const // brand-green

function lerpBrand(t: number): string {
  const [fr, fg, fb] = BRAND_FROM
  const [tr, tg, tb] = BRAND_TO
  const clamped = Math.max(0, Math.min(1, t))
  const r = Math.round(fr + (tr - fr) * clamped)
  const g = Math.round(fg + (tg - fg) * clamped)
  const b = Math.round(fb + (tb - fb) * clamped)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * A segmented slider rendered as N discrete ticks — instrument-panel style.
 * Click any tick to set the value. The selected tick also acts as a drag
 * handle, snapping to the nearest available tick as the pointer moves.
 *
 * Filled ticks + the thumb are colored from the brand gradient (yellow-lime
 * → brand-green), interpolated by each tick's position along the full
 * min..max scale. Higher leverage → further along the gradient, so the
 * slider reads as a climbing "intensity" bar rather than a flat fill.
 */
export function SegmentedSlider({
  value,
  max,
  min = 1,
  values,
  onChange,
  formatAriaValue = (next) => `${next}x`,
}: SegmentedSliderProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lastDragValueRef = useRef(value)
  const suppressClickRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const tickValues = useMemo(
    () =>
      values && values.length > 0
        ? [...new Set(values)].filter((next) => next >= min && next <= max).sort((a, b) => a - b)
        : Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [max, min, values],
  )

  const valueFromPointer = useCallback(
    (clientX: number): number => {
      const root = rootRef.current
      if (!root || tickValues.length === 0) return value

      const rect = root.getBoundingClientRect()
      const progress =
        rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0
      const index = Math.round(progress * (tickValues.length - 1))
      return tickValues[Math.max(0, Math.min(tickValues.length - 1, index))]
    },
    [tickValues, value],
  )

  const handleThumbPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, isThumb: boolean) => {
      if (!isThumb || event.button !== 0) return

      event.preventDefault()
      const nextValue = valueFromPointer(event.clientX)
      lastDragValueRef.current = nextValue
      suppressClickRef.current = false
      rootRef.current?.setPointerCapture(event.pointerId)
      setIsDragging(true)
      onChange?.(nextValue)
    },
    [onChange, valueFromPointer],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return

      event.preventDefault()
      const nextValue = valueFromPointer(event.clientX)
      if (nextValue === lastDragValueRef.current) return

      suppressClickRef.current = true
      lastDragValueRef.current = nextValue
      onChange?.(nextValue)
    },
    [isDragging, onChange, valueFromPointer],
  )

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      setIsDragging(false)
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    },
    [isDragging],
  )

  const ticks = []
  const span = Math.max(1, tickValues.length - 1)
  for (let tickIndex = 0; tickIndex < tickValues.length; tickIndex++) {
    const nextValue = tickValues[tickIndex]
    const isOn = nextValue < value
    const isThumb = nextValue === value
    const fillColor = lerpBrand(tickIndex / span)
    ticks.push(
      <button
        key={nextValue}
        type="button"
        aria-label={`Set to ${formatAriaValue(nextValue)}`}
        aria-pressed={isThumb}
        onPointerDown={(event) => handleThumbPointerDown(event, isThumb)}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          onChange?.(nextValue)
        }}
        className={cn(
          'h-3 flex-1 cursor-pointer border-0 p-0',
          'duration-micro ease-levx transition-[background]',
          isOn || isThumb ? '' : 'bg-line hover:bg-line-strong',
          isThumb && 'h-6 cursor-ew-resize touch-none',
        )}
        style={isOn || isThumb ? { backgroundColor: fillColor } : undefined}
      />,
    )
  }

  return (
    <div
      ref={rootRef}
      className="flex h-6 items-center gap-[2px] select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      {ticks}
    </div>
  )
}
