import type { Renderer, RendererInitOptions } from './types'
import { WebGLRenderer } from './WebGLRenderer'
import { WebGPURenderer } from './WebGPURenderer'

export type RendererKind = 'auto' | 'webgpu' | 'webgl'

export interface CreateRendererResult {
  renderer: Renderer
  /** The kind that actually got instantiated. */
  actualKind: 'webgpu' | 'webgl'
  /** If a preferred backend failed, its error is surfaced here for telemetry. */
  fallbackFrom?: { kind: 'webgpu'; error: Error }
}

/**
 * Initialize a renderer, honoring the user's `kind` preference and falling
 * back to WebGL if WebGPU fails. Throws only if no backend works at all.
 */
export async function createRenderer(
  kind: RendererKind,
  options: RendererInitOptions,
): Promise<CreateRendererResult> {
  if (kind === 'webgl') {
    const r = new WebGLRenderer()
    await r.init(options)
    return { renderer: r, actualKind: 'webgl' }
  }

  if (
    kind === 'webgpu' ||
    (kind === 'auto' && typeof navigator !== 'undefined' && 'gpu' in navigator)
  ) {
    try {
      const r = new WebGPURenderer()
      await r.init(options)
      return { renderer: r, actualKind: 'webgpu' }
    } catch (err) {
      if (kind === 'webgpu') throw err
      const webglRenderer = new WebGLRenderer()
      await webglRenderer.init(options)
      return {
        renderer: webglRenderer,
        actualKind: 'webgl',
        fallbackFrom: {
          kind: 'webgpu',
          error: err instanceof Error ? err : new Error(String(err)),
        },
      }
    }
  }

  const r = new WebGLRenderer()
  await r.init(options)
  return { renderer: r, actualKind: 'webgl' }
}
