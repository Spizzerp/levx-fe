/**
 * Parse a color string into a normalized [r, g, b] tuple in 0..1.
 * Accepts:
 *   - "#rgb", "#rrggbb", "#rrggbbaa" (alpha ignored)
 *   - "rgb(r, g, b)" / "rgba(r, g, b, a)"
 *   - an already-parsed [r, g, b] tuple (returned as-is, clamped)
 */
export function parseColor(input: string | [number, number, number]): [number, number, number] {
  if (Array.isArray(input)) {
    return [clamp01(input[0]), clamp01(input[1]), clamp01(input[2])]
  }
  const s = input.trim()

  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16) / 255,
        parseInt(hex[1] + hex[1], 16) / 255,
        parseInt(hex[2] + hex[2], 16) / 255,
      ]
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ]
    }
  }

  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (m) {
    return [
      clamp01(parseFloat(m[1]) / 255),
      clamp01(parseFloat(m[2]) / 255),
      clamp01(parseFloat(m[3]) / 255),
    ]
  }

  if (typeof document !== 'undefined') {
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#000'
      ctx.fillStyle = s
      const parsed = ctx.fillStyle
      if (typeof parsed === 'string' && parsed.startsWith('#')) return parseColor(parsed)
    }
  }
  return [1, 1, 1]
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
