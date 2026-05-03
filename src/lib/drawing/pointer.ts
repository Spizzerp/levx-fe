import type { MinimalScale } from '@/lib/drawing/types'

/**
 * Convert a pointer event's client coordinates to chart-inner coordinates.
 *
 * Every drawing tool needs the same translation: clientX/Y → owning SVG's
 * bounding rect → minus margin.left/top to land in the chart's inner area.
 * Returns null if the event has no owning SVG (defensive — should never
 * happen for events fired from `<rect>` inside an SVG).
 */
export function clientToChart(
  e: { clientX: number; clientY: number; currentTarget: EventTarget | null },
  margin: { left: number; top: number },
): { chartX: number; chartY: number } | null {
  const target = e.currentTarget as SVGElement | null
  const svg = target?.ownerSVGElement
  if (!svg) return null
  const svgRect = svg.getBoundingClientRect()
  return {
    chartX: e.clientX - svgRect.left - margin.left,
    chartY: e.clientY - svgRect.top - margin.top,
  }
}

/**
 * Compute the chart-inner pixel region that lies after `marketStart`. Three of
 * the drawing tools (freehand / line / bezier) overlay this region only — they
 * all need the same `Math.max(0, …)` clamp against negative widths when the
 * market start has been scrolled past the chart's right edge.
 */
export function getFutureRegion(
  xScale: MinimalScale,
  marketStart: number,
  innerWidth: number,
): { x: number; width: number } {
  const x = Math.max(0, Number(xScale(marketStart)))
  return { x, width: Math.max(0, innerWidth - x) }
}
