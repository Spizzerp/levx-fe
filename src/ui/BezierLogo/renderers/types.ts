import type { CubicSegment } from '../geometry'

/**
 * Uniform values passed to a renderer each frame. The shape itself is baked
 * once at init; per-frame we only push the intro-animation offsets.
 *
 *   bracketOffset / xOffset — translations applied to each sub-shape's
 *       UV before SDF lookup. Starts merged (large bracket offset) and
 *       eases to (0, 0) over the reveal.
 *   sminK — rounding radius (UV units) for the polynomial smooth-min
 *       union between the two sub-shape SDFs. Gives the "fluid metal"
 *       bridge as the shapes pull apart.
 */
export interface Uniforms {
  width: number
  height: number
  zoom: number
  sminK: number
  offsetX: number
  offsetY: number
  bracketOffsetX: number
  bracketOffsetY: number
  xOffsetX: number
  xOffsetY: number
  color: [number, number, number]
  opacity: number
}

export interface RendererInitOptions {
  canvas: HTMLCanvasElement
  bracketSegments: readonly CubicSegment[]
  xSegments: readonly CubicSegment[]
}

export interface Renderer {
  readonly kind: 'webgpu' | 'webgl'
  /** Resolve once the renderer is ready to draw. Rejects on unrecoverable init failure. */
  init(options: RendererInitOptions): Promise<void>
  /** Draw one frame with the given uniforms. Safe to call repeatedly. */
  render(uniforms: Uniforms): void
  /** Release GPU resources. Idempotent. */
  dispose(): void
}
