import { useCallback, useEffect, useRef, useState } from 'react'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
const CYCLES_PER_LETTER = 2
const SHUFFLE_TIME = 40

interface HyperTextProps {
  /** The text to display and animate */
  children: string
  /** Trigger scramble animation on mount */
  animateOnLoad?: boolean
  className?: string
}

/**
 * Text that decodes on mount and re-scrambles on hover.
 * Each character cycles through random symbols before revealing the real letter.
 */
export function HyperText({ children, animateOnLoad = true, className }: HyperTextProps) {
  const [displayText, setDisplayText] = useState(animateOnLoad ? '' : children)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const target = children

  const scramble = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    let pos = 0
    intervalRef.current = setInterval(() => {
      const result = target
        .split('')
        .map((char, i) => {
          if (char === ' ') return ' '
          if (pos / CYCLES_PER_LETTER > i) return char
          return CHARS[Math.floor(Math.random() * CHARS.length)]
        })
        .join('')

      setDisplayText(result)
      pos++

      if (pos >= target.length * CYCLES_PER_LETTER) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setDisplayText(target)
      }
    }, SHUFFLE_TIME)
  }, [target])

  useEffect(() => {
    if (animateOnLoad) scramble()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [animateOnLoad, scramble])

  return (
    <span
      className={className}
      onMouseEnter={scramble}
      style={{ cursor: 'default' }}
    >
      {displayText || target}
    </span>
  )
}
