import type { CubicSegment } from '../geometry'
import { WEBGPU_BAKE_SHADER, WEBGPU_BAKE_SIZE, WEBGPU_SAMPLE_SHADER } from '../shaders/webgpu'
import type { Renderer, RendererInitOptions, Uniforms } from './types'

/**
 * WebGPU renderer for the split-morph logo.
 *
 *   - BAKE pipeline runs twice at init, once per sub-shape (bracket, X),
 *     writing each SDF to its own r16float texture.
 *   - SAMPLE pipeline runs each frame of the intro animation: samples
 *     both textures at their animated offsets, smooth-unions, rasterizes.
 *
 * Uniform buffer layout (64 bytes, 16-byte aligned):
 *   resolution    : vec2<f32>  // 0   (8)
 *   zoom          : f32        // 8   (4)
 *   sminK         : f32        // 12  (4)
 *   offset        : vec2<f32>  // 16  (8)
 *   bracketOffset : vec2<f32>  // 24  (8)
 *   xOffset       : vec2<f32>  // 32  (8)
 *   _pad          : vec2<f32>  // 40  (8)   → align color to 48 (16-aligned)
 *   color         : vec3<f32>  // 48  (12)
 *   opacity       : f32        // 60  (4)
 */
const UNIFORM_BUFFER_SIZE = 64

export class WebGPURenderer implements Renderer {
  readonly kind = 'webgpu' as const

  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private format: GPUTextureFormat = 'bgra8unorm'
  private samplePipeline: GPURenderPipeline | null = null
  private uniformBuffer: GPUBuffer | null = null
  private bracketTexture: GPUTexture | null = null
  private xTexture: GPUTexture | null = null
  private sampleBindGroup: GPUBindGroup | null = null
  private uniformData = new ArrayBuffer(UNIFORM_BUFFER_SIZE)
  private disposed = false

  async init({ canvas, bracketSegments, xSegments }: RendererInitOptions): Promise<void> {
    if (!('gpu' in navigator) || !navigator.gpu) {
      throw new Error('WebGPU not available')
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
    if (!adapter) throw new Error('no WebGPU adapter')
    const device = await adapter.requestDevice()
    this.device = device

    device.lost.then((info) => {
      if (this.disposed) return
      console.warn('[BezierLogo] GPU device lost:', info.message)
    })

    const context = canvas.getContext('webgpu')
    if (!context) throw new Error('could not acquire webgpu context')
    this.context = context
    this.format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format: this.format, alphaMode: 'premultiplied' })

    // --- Bake pipeline (shared across the two bake passes) ---
    const bakeShader = device.createShaderModule({ code: WEBGPU_BAKE_SHADER })
    const bakeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      ],
    })
    const bakePipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bakeBindGroupLayout] }),
      vertex: { module: bakeShader, entryPoint: 'vs_main' },
      fragment: {
        module: bakeShader,
        entryPoint: 'fs_main',
        targets: [{ format: 'r16float' }],
      },
      primitive: { topology: 'triangle-list' },
    })

    this.bracketTexture = this.bakeShape(device, bakePipeline, bakeBindGroupLayout, bracketSegments)
    this.xTexture = this.bakeShape(device, bakePipeline, bakeBindGroupLayout, xSegments)

    // --- Sample pipeline ---
    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    })

    const sampleShader = device.createShaderModule({ code: WEBGPU_SAMPLE_SHADER })
    const sampleBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: '2d' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: '2d' },
        },
      ],
    })
    this.samplePipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [sampleBindGroupLayout] }),
      vertex: { module: sampleShader, entryPoint: 'vs_main' },
      fragment: {
        module: sampleShader,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    })

    this.sampleBindGroup = device.createBindGroup({
      layout: sampleBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: this.bracketTexture.createView() },
        { binding: 3, resource: this.xTexture.createView() },
      ],
    })
  }

  private bakeShape(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    bindGroupLayout: GPUBindGroupLayout,
    segments: readonly CubicSegment[],
  ): GPUTexture {
    // Upload this shape's segments as a storage buffer. Discarded at end
    // of this call — the baked texture is the only thing kept around.
    const segFloats = new Float32Array(segments.length * 8)
    for (let i = 0; i < segments.length; i++) {
      segFloats.set(segments[i] as unknown as ArrayLike<number>, i * 8)
    }
    const segmentBuffer = device.createBuffer({
      size: segFloats.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })
    new Float32Array(segmentBuffer.getMappedRange()).set(segFloats)
    segmentBuffer.unmap()

    const texture = device.createTexture({
      size: [WEBGPU_BAKE_SIZE, WEBGPU_BAKE_SIZE],
      format: 'r16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    })

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: segmentBuffer } }],
    })

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)
    pass.end()
    device.queue.submit([encoder.finish()])

    segmentBuffer.destroy()
    return texture
  }

  render(u: Uniforms): void {
    const { device, context, samplePipeline, uniformBuffer, sampleBindGroup } = this
    if (
      !device ||
      !context ||
      !samplePipeline ||
      !uniformBuffer ||
      !sampleBindGroup ||
      this.disposed
    )
      return

    const view = new DataView(this.uniformData)
    view.setFloat32(0, u.width, true)
    view.setFloat32(4, u.height, true)
    view.setFloat32(8, u.zoom, true)
    view.setFloat32(12, u.sminK, true)
    view.setFloat32(16, u.offsetX, true)
    view.setFloat32(20, u.offsetY, true)
    view.setFloat32(24, u.bracketOffsetX, true)
    view.setFloat32(28, u.bracketOffsetY, true)
    view.setFloat32(32, u.xOffsetX, true)
    view.setFloat32(36, u.xOffsetY, true)
    // 40-47: _pad
    view.setFloat32(48, u.color[0], true)
    view.setFloat32(52, u.color[1], true)
    view.setFloat32(56, u.color[2], true)
    view.setFloat32(60, u.opacity, true)
    device.queue.writeBuffer(uniformBuffer, 0, this.uniformData)

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })
    pass.setPipeline(samplePipeline)
    pass.setBindGroup(0, sampleBindGroup)
    pass.draw(3)
    pass.end()
    device.queue.submit([encoder.finish()])
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.uniformBuffer?.destroy()
    this.bracketTexture?.destroy()
    this.xTexture?.destroy()
    this.context?.unconfigure()
    this.device?.destroy()
    this.uniformBuffer = null
    this.bracketTexture = null
    this.xTexture = null
    this.context = null
    this.device = null
    this.samplePipeline = null
    this.sampleBindGroup = null
  }
}
