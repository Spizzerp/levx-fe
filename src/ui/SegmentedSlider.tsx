import { cn } from '@/lib/cn'

interface SegmentedSliderProps {
  value: number
  max: number
  min?: number
  onChange?: (next: number) => void
}

/**
 * A segmented slider rendered as N discrete ticks — instrument-panel style.
 * Click any tick to set the value. No drag handle; each tick is a target.
 */
export function SegmentedSlider({ value, max, min = 1, onChange }: SegmentedSliderProps) {
  const ticks = []
  for (let i = min; i <= max; i++) {
    const isOn = i < value
    const isThumb = i === value
    ticks.push(
      <button
        key={i}
        type="button"
        aria-label={`Set to ${i}x`}
        onClick={() => onChange?.(i)}
        className={cn(
          'h-3 flex-1 cursor-pointer border-0 p-0',
          'duration-micro ease-levx transition-[background]',
          isOn || isThumb ? 'bg-ink-strong' : 'bg-line hover:bg-line-strong',
          isThumb && 'h-6',
        )}
      />,
    )
  }

  return <div className="flex h-6 items-center gap-[2px]">{ticks}</div>
}
