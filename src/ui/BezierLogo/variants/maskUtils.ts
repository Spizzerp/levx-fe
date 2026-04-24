/**
 * Shared helpers for Canvas 2D logo variants.
 *
 * Bezier geometry lives in a symmetric UV space (roughly [-1, 1] in x and
 * [-0.6, 0.6] in y, +y up). Canvas pixel space has +y down. The transform
 * matches the SDF renderer's convention at zoom=1: uv spans [-1, 1] over
 * the shortest dimension.
 */

import { BRACKET_CUBICS, X_CUBICS, type CubicSegment } from '../geometry'

export type ToCanvas = (x: number, y: number) => [number, number]

export function makeTransform(width: number, height: number, zoom = 1.0): ToCanvas {
  const scale = (Math.min(width, height) / 2) * zoom
  return (x, y) => [width / 2 + x * scale, height / 2 - y * scale]
}

export function buildPath(segments: readonly CubicSegment[], toCanvas: ToCanvas): Path2D {
  const p = new Path2D()
  const first = segments[0]
  if (!first) return p
  const [sx, sy] = toCanvas(first[0], first[1])
  p.moveTo(sx, sy)
  for (const seg of segments) {
    const [c1x, c1y] = toCanvas(seg[2], seg[3])
    const [c2x, c2y] = toCanvas(seg[4], seg[5])
    const [ex, ey] = toCanvas(seg[6], seg[7])
    p.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey)
  }
  p.closePath()
  return p
}

export interface LogoPaths {
  bracket: Path2D
  x: Path2D
  combined: Path2D
  toCanvas: ToCanvas
}

export function buildLogoPaths(width: number, height: number, zoom = 1.0): LogoPaths {
  const toCanvas = makeTransform(width, height, zoom)
  const bracket = buildPath(BRACKET_CUBICS, toCanvas)
  const x = buildPath(X_CUBICS, toCanvas)
  const combined = new Path2D()
  combined.addPath(bracket)
  combined.addPath(x)
  return { bracket, x, combined, toCanvas }
}

/** Returns a raw RGBA pixel buffer where the silhouette is filled white. */
export function buildMaskPixels(width: number, height: number, zoom = 1.0): Uint8ClampedArray {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  if (!ctx) return new Uint8ClampedArray(width * height * 4)
  const { bracket, x } = buildLogoPaths(width, height, zoom)
  ctx.fillStyle = '#fff'
  ctx.fill(bracket)
  ctx.fill(x)
  return ctx.getImageData(0, 0, width, height).data
}
