import { useEffect, useRef, useState, useCallback, type RefObject } from 'react'

export interface CanvasSize {
  width: number
  height: number
  cssWidth: number
  cssHeight: number
  dpr: number
}

/**
 * Observes an element and reports its size in both CSS pixels and physical
 * (devicePixelRatio-scaled) pixels. DPR is capped to avoid quadrupling
 * fragment cost on 3x displays without a visible quality gain here.
 */
export function useCanvasSize(ref: RefObject<HTMLElement | null>, maxDpr = 2): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({
    width: 0,
    height: 0,
    cssWidth: 0,
    cssHeight: 0,
    dpr: 1,
  })
  const lastRef = useRef<CanvasSize | null>(null)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
    const width = Math.max(1, Math.floor(rect.width * dpr))
    const height = Math.max(1, Math.floor(rect.height * dpr))
    const next: CanvasSize = {
      width,
      height,
      cssWidth: rect.width,
      cssHeight: rect.height,
      dpr,
    }
    const last = lastRef.current
    if (last && last.width === next.width && last.height === next.height && last.dpr === next.dpr)
      return
    lastRef.current = next
    setSize(next)
  }, [ref, maxDpr])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, measure])

  return size
}
