import { useEffect, useMemo, useRef, useState } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type HTMLMotionProps,
} from 'motion/react'

import { cn } from '@/lib/cn'

const DEFAULT_COLORS = [
  'var(--color-brand-from)',
  'var(--color-brand-to)',
  'var(--color-ink-strong)',
]
const BAND_HALF = 17
const SWEEP_START = -BAND_HALF
const SWEEP_END = 100 + BAND_HALF

const sweepEase = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

function buildGradient(pos: number, colors: string[], textColor: string) {
  const bandStart = pos - BAND_HALF
  const bandEnd = pos + BAND_HALF

  if (bandEnd <= 0) {
    return 'linear-gradient(90deg, transparent, transparent)'
  }

  if (bandStart >= 100) {
    return `linear-gradient(90deg, ${textColor}, ${textColor})`
  }

  const parts: string[] = []

  if (bandStart > 0) {
    parts.push(`${textColor} 0%`, `${textColor} ${bandStart.toFixed(2)}%`)
  }

  colors.forEach((color, index) => {
    const pct =
      colors.length === 1 ? pos : bandStart + (index / (colors.length - 1)) * BAND_HALF * 2
    parts.push(`${color} ${pct.toFixed(2)}%`)
  })

  if (bandEnd < 100) {
    parts.push(`transparent ${bandEnd.toFixed(2)}%`, 'transparent 100%')
  }

  return `linear-gradient(90deg, ${parts.join(', ')})`
}

function measureWidths(el: HTMLElement, texts: string[]) {
  if (!el.parentElement) return []

  const ghost = el.cloneNode() as HTMLElement
  Object.assign(ghost.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: 'auto',
    whiteSpace: 'nowrap',
  })

  el.parentElement.appendChild(ghost)
  const widths = texts.map((text) => {
    ghost.textContent = text
    return ghost.getBoundingClientRect().width
  })
  ghost.remove()

  return widths
}

export interface DiaTextRevealProps
  extends Omit<
    HTMLMotionProps<'span'>,
    'ref' | 'children' | 'style' | 'animate' | 'transition' | 'color'
  > {
  text: string | string[]
  colors?: string[]
  textColor?: string
  duration?: number
  delay?: number
  repeat?: boolean
  repeatDelay?: number
  startOnView?: boolean
  once?: boolean
  className?: string
  fixedWidth?: boolean
  direction?: 'forward' | 'reverse'
  onSweepComplete?: () => void
}

export function DiaTextReveal({
  text,
  colors = DEFAULT_COLORS,
  textColor = 'var(--color-ink-strong)',
  duration = 1.5,
  delay = 0,
  repeat = false,
  repeatDelay = 0.5,
  startOnView = true,
  once = true,
  className,
  fixedWidth = false,
  direction = 'forward',
  onSweepComplete,
  ...props
}: DiaTextRevealProps) {
  const textKey = Array.isArray(text) ? text.join('\0') : text
  const texts = useMemo(() => textKey.split('\0'), [textKey])
  const isMulti = texts.length > 1
  const prefersReducedMotion = useReducedMotion()

  const spanRef = useRef<HTMLSpanElement>(null)
  const hasPlayedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const [activeIndex, setActiveIndex] = useState(0)
  const [measuredWidths, setMeasuredWidths] = useState<number[]>([])
  const activeTextIndex = texts.length > 0 ? activeIndex % texts.length : 0

  const sweepPos = useMotionValue(SWEEP_START)
  const backgroundImage = useTransform(sweepPos, (pos) =>
    buildGradient(pos, colors, textColor),
  )

  const [isInView, setIsInView] = useState(
    () => !startOnView || typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    const el = spanRef.current
    if (!el || !isMulti) return
    setMeasuredWidths(measureWidths(el, texts))
  }, [isMulti, texts])

  useEffect(() => {
    hasPlayedRef.current = false
  }, [textKey])

  useEffect(() => {
    if (!startOnView || typeof IntersectionObserver === 'undefined') return

    const el = spanRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { threshold: 0.1 },
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [once, startOnView])

  useEffect(() => {
    if (prefersReducedMotion) {
      sweepPos.set(direction === 'reverse' ? SWEEP_START : SWEEP_END)
      onSweepComplete?.()
      return
    }

    if (startOnView && !isInView) return
    if (once && hasPlayedRef.current) return

    hasPlayedRef.current = true
    let active = true

    const play = () => {
      const sweepFrom = direction === 'reverse' ? SWEEP_END : SWEEP_START
      const sweepTo = direction === 'reverse' ? SWEEP_START : SWEEP_END

      sweepPos.set(sweepFrom)

      const controls = animate(sweepPos, sweepTo, {
        duration,
        delay,
        ease: sweepEase,
        onComplete() {
          onSweepComplete?.()
          if (direction === 'reverse' || !repeat || !active) return
          timerRef.current = setTimeout(() => {
            setActiveIndex((currentIndex) => (currentIndex + 1) % texts.length)
            play()
          }, repeatDelay * 1000)
        },
      })

      stopRef.current = () => controls.stop()
    }

    play()

    return () => {
      active = false
      stopRef.current?.()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [
    delay,
    direction,
    duration,
    isInView,
    onSweepComplete,
    once,
    prefersReducedMotion,
    repeat,
    repeatDelay,
    startOnView,
    sweepPos,
    texts,
  ])

  const fixedW =
    isMulti && fixedWidth && measuredWidths.length > 0 ? Math.max(...measuredWidths) : undefined

  const animatedW =
    isMulti && !fixedWidth && measuredWidths[activeTextIndex] != null
      ? measuredWidths[activeTextIndex]
      : undefined

  return (
    <motion.span
      ref={spanRef}
      className={cn('align-bottom leading-[100%] text-inherit', className)}
      style={{
        transform: 'translateY(-2px)',
        color: 'transparent',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        backgroundSize: '100% 100%',
        backgroundImage,
        ...(isMulti && {
          display: 'inline-block',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          verticalAlign: 'middle',
          ...(fixedW != null && { width: fixedW }),
        }),
      }}
      animate={animatedW != null ? { width: animatedW } : undefined}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      {...props}
    >
      {texts[activeTextIndex]}
    </motion.span>
  )
}
