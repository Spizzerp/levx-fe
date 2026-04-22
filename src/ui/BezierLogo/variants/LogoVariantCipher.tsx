import { useEffect, useRef } from 'react'

import { useCanvasSize } from '../useCanvasSize'
import { buildMaskPixels } from './maskUtils'

export interface LogoVariantCipherProps {
  ariaLabel?: string
}

const GLYPHS = '0123456789ABCDEF'

/**
 * Cipher stream. A grid of monospace hex glyphs falls in vertical
 * columns — each column has its own drift speed and phase, each cell
 * periodically re-randomizes its character. Cells inside the silhouette
 * render in bright ink; outside cells are sparse and dim, enough to
 * suggest background noise without competing with the mark.
 *
 * Directly echoes the hero's typewriter headline + the site's mono
 * typography; reads as a terminal decoding the logo live.
 */
export function LogoVariantCipher({ ariaLabel = 'LevX' }: LogoVariantCipherProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useCanvasSize(containerRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = size.width
    canvas.height = size.height

    const mask = buildMaskPixels(size.width, size.height, 1.0)
    const isInside = (px: number, py: number): boolean => {
      const ix = px | 0
      const iy = py | 0
      if (ix < 0 || iy < 0 || ix >= size.width || iy >= size.height) return false
      return mask[(iy * size.width + ix) * 4 + 3] > 128
    }

    const cellCss = 13 // CSS px per cell — tight enough to feel dense
    const cell = cellCss * size.dpr
    const cols = Math.ceil(size.width / cell)
    const rows = Math.ceil(size.height / cell) + 2

    // Per-column scroll speeds + phase offsets so columns fall independently.
    const colSpeed = new Float32Array(cols)
    const colPhase = new Float32Array(cols)
    for (let c = 0; c < cols; c++) {
      colSpeed[c] = 0.018 + Math.random() * 0.055
      colPhase[c] = Math.random() * rows * cell
    }

    // Per-cell state: which glyph is shown + when to re-randomize.
    const cellChar = new Uint8Array(cols * rows)
    const cellNext = new Float32Array(cols * rows)
    for (let i = 0; i < cols * rows; i++) {
      cellChar[i] = (Math.random() * GLYPHS.length) | 0
      cellNext[i] = Math.random() * 900
    }

    const fontSize = cell * 0.88
    const start = performance.now()
    let last = start
    let rafId = 0

    const tick = (t: number) => {
      const elapsed = t - start
      const dt = t - last
      last = t
      ctx.clearRect(0, 0, size.width, size.height)
      ctx.font = `500 ${fontSize}px "JetBrains Mono", "Space Mono", monospace`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'

      const totalH = rows * cell

      for (let c = 0; c < cols; c++) {
        const xCenter = c * cell + cell * 0.5
        const scroll = (colPhase[c] + elapsed * colSpeed[c]) % totalH
        // Head-of-column brightens slightly — subtle "leading edge" glow.
        const headY = ((elapsed * colSpeed[c] + colPhase[c]) % totalH) | 0

        for (let r = 0; r < rows; r++) {
          const y = (r * cell + scroll) % totalH
          if (y > size.height + cell) continue
          const yCenter = y + cell * 0.5
          const idx = c * rows + r

          cellNext[idx] -= dt
          if (cellNext[idx] <= 0) {
            cellChar[idx] = (Math.random() * GLYPHS.length) | 0
            cellNext[idx] = 180 + Math.random() * 820
          }

          const inside = isInside(xCenter, yCenter)
          // Bright leading edge — cells within ~1 cell of the falling head
          // get a slight boost so columns feel alive.
          const distToHead = Math.abs(yCenter - headY)
          const onHead = distToHead < cell * 1.2

          if (inside) {
            ctx.fillStyle = onHead ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.92)'
          } else {
            // Very sparse outside — just every ~4th cell at low alpha so
            // the background reads as "noise" rather than a solid grid.
            if ((c * 7 + r * 11) % 4 !== 0) continue
            ctx.fillStyle = onHead ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'
          }

          ctx.fillText(GLYPHS[cellChar[idx]], xCenter, yCenter)
        }
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [size.width, size.height, size.dpr])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      role="img"
      aria-label={`${ariaLabel} (cipher stream)`}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
