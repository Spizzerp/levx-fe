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
