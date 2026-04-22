import { cn } from '@/lib/cn'

interface SegmentedSliderProps {
  value: number
  max: number
  min?: number
  onChange?: (next: number) => void
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
 * Click any tick to set the value. No drag handle; each tick is a target.
 *
 * Filled ticks + the thumb are colored from the brand gradient (yellow-lime
 * → brand-green), interpolated by each tick's position along the full
 * min..max scale. Higher leverage → further along the gradient, so the
 * slider reads as a climbing "intensity" bar rather than a flat fill.
 */
export function SegmentedSlider({ value, max, min = 1, onChange }: SegmentedSliderProps) {
  const ticks = []
  const span = max - min
  for (let i = min; i <= max; i++) {
    const isOn = i < value
    const isThumb = i === value
    const fillColor = lerpBrand(span > 0 ? (i - min) / span : 0)
    ticks.push(
      <button
        key={i}
        type="button"
        aria-label={`Set to ${i}x`}
        onClick={() => onChange?.(i)}
        className={cn(
          'h-3 flex-1 cursor-pointer border-0 p-0',
          'duration-micro ease-levx transition-[background]',
          isOn || isThumb ? '' : 'bg-line hover:bg-line-strong',
          isThumb && 'h-6',
        )}
        style={isOn || isThumb ? { backgroundColor: fillColor } : undefined}
      />,
    )
  }

  return <div className="flex h-6 items-center gap-[2px]">{ticks}</div>
}
