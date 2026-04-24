import type { CubicSegment } from '../geometry'
import {
  WEBGL_BAKE_BOUND,
  WEBGL_BAKE_FRAG,
  WEBGL_BAKE_SIZE,
  WEBGL_BAKE_VERT,
  WEBGL_DIRECT_FRAG,
  WEBGL_SAMPLE_FRAG,
  WEBGL_VERT,
} from '../shaders/webgl'
import type { Renderer, RendererInitOptions, Uniforms } from './types'

const MAX_SEGS = 32

/**
 * WebGL 1 renderer for the split-morph logo.
 *
 * Preferred path is baked-SDF sampling: on init, compile a bake program
 * and render each sub-shape's SDF into its own RGBA16F render target.
 * Per frame, the sample program reads both textures at their animated
 * offsets and smooth-unions them.
 *
 * Requires OES_texture_half_float, EXT_color_buffer_half_float, and
 * OES_texture_half_float_linear. If any is missing we fall back to the
 * DIRECT shader, which evaluates one combined SDF per pixel — a static
 * silhouette in the final split state with no intro animation.
 */
export class WebGLRenderer implements Renderer {
  readonly kind = 'webgl' as const

  private gl: WebGLRenderingContext | null = null
  private buffer: WebGLBuffer | null = null

  // Baked-path resources.
  private bakeProgram: WebGLProgram | null = null
  private sampleProgram: WebGLProgram | null = null
  private bracketTexture: WebGLTexture | null = null
  private xTexture: WebGLTexture | null = null
  private sampleUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Direct-path resources (only created when bake fails).
  private directProgram: WebGLProgram | null = null
  private directUniforms: Record<string, WebGLUniformLocation | null> = {}

  private mode: 'baked' | 'direct' = 'baked'
  private disposed = false

  async init({ canvas, bracketSegments, xSegments }: RendererInitOptions): Promise<void> {
    const gl = canvas.getContext('webgl', {
      antialias: true,
      premultipliedAlpha: false,
      alpha: true,
      preserveDrawingBuffer: false,
    })
    if (!gl) throw new Error('WebGL not supported')
    this.gl = gl

    if (!gl.getExtension('OES_standard_derivatives')) {
      throw new Error('OES_standard_derivatives extension not available')
    }
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    // Fullscreen quad shared by every program.
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    this.buffer = buf

    if (bracketSegments.length > MAX_SEGS || xSegments.length > MAX_SEGS) {
      throw new Error(
        `too many segments: bracket=${bracketSegments.length} x=${xSegments.length} > ${MAX_SEGS}`,
      )
    }

    const bakeOk = this.tryInitBaked(gl, bracketSegments, xSegments)
    if (!bakeOk) {
      this.mode = 'direct'
      // Direct path shows the static combined silhouette — no animation.
      const combined = [...bracketSegments, ...xSegments]
      this.initDirect(gl, combined)
      console.info('[BezierLogo] half-float textures unavailable, using per-pixel shader')
    }
  }

  private tryInitBaked(
    gl: WebGLRenderingContext,
    bracketSegments: readonly CubicSegment[],
    xSegments: readonly CubicSegment[],
  ): boolean {
    const halfFloat = gl.getExtension('OES_texture_half_float')
    const colorBuf = gl.getExtension('EXT_color_buffer_half_float')
    const halfFloatLinear = gl.getExtension('OES_texture_half_float_linear')
    if (!halfFloat || !colorBuf || !halfFloatLinear) return false
    const HALF_FLOAT_OES = halfFloat.HALF_FLOAT_OES

    const bakeProgram = link(gl, WEBGL_BAKE_VERT, WEBGL_BAKE_FRAG)
    if (!bakeProgram) return false
    this.bakeProgram = bakeProgram

    const bracket = this.bakeOne(gl, bakeProgram, bracketSegments, HALF_FLOAT_OES)
    if (!bracket) {
      gl.deleteProgram(bakeProgram)
      this.bakeProgram = null
      return false
    }
    const xTex = this.bakeOne(gl, bakeProgram, xSegments, HALF_FLOAT_OES)
    if (!xTex) {
      gl.deleteTexture(bracket)
      gl.deleteProgram(bakeProgram)
      this.bakeProgram = null
      return false
    }
    this.bracketTexture = bracket
    this.xTexture = xTex

    // Back to the default framebuffer for runtime rendering.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // --- Sample program ---
    const sampleProgram = link(gl, WEBGL_VERT, WEBGL_SAMPLE_FRAG)
    if (!sampleProgram) {
      this.disposeBakedTextures(gl)
      gl.deleteProgram(bakeProgram)
      this.bakeProgram = null
      return false
    }
    this.sampleProgram = sampleProgram
    gl.useProgram(sampleProgram)
    const samplePosLoc = gl.getAttribLocation(sampleProgram, 'a_pos')
    gl.enableVertexAttribArray(samplePosLoc)
    gl.vertexAttribPointer(samplePosLoc, 2, gl.FLOAT, false, 0, 0)
    this.sampleUniforms = {
      res: gl.getUniformLocation(sampleProgram, 'u_res'),
      zoom: gl.getUniformLocation(sampleProgram, 'u_zoom'),
      offset: gl.getUniformLocation(sampleProgram, 'u_offset'),
      color: gl.getUniformLocation(sampleProgram, 'u_color'),
      opacity: gl.getUniformLocation(sampleProgram, 'u_opacity'),
      sdfBracket: gl.getUniformLocation(sampleProgram, 'u_sdfBracket'),
      sdfX: gl.getUniformLocation(sampleProgram, 'u_sdfX'),
      bound: gl.getUniformLocation(sampleProgram, 'u_bound'),
      bracketOffset: gl.getUniformLocation(sampleProgram, 'u_bracketOffset'),
      xOffset: gl.getUniformLocation(sampleProgram, 'u_xOffset'),
      sminK: gl.getUniformLocation(sampleProgram, 'u_sminK'),
    }
    gl.uniform1i(this.sampleUniforms.sdfBracket!, 0) // texture unit 0
    gl.uniform1i(this.sampleUniforms.sdfX!, 1) // texture unit 1
    gl.uniform1f(this.sampleUniforms.bound!, WEBGL_BAKE_BOUND)
    return true
  }

  private bakeOne(
    gl: WebGLRenderingContext,
    bakeProgram: WebGLProgram,
    segments: readonly CubicSegment[],
    halfFloatType: number,
  ): WebGLTexture | null {
    const segA = new Float32Array(MAX_SEGS * 4)
    const segB = new Float32Array(MAX_SEGS * 4)
    for (let i = 0; i < segments.length; i++) {
      const c = segments[i]
      segA[i * 4 + 0] = c[0]
      segA[i * 4 + 1] = c[1]
      segA[i * 4 + 2] = c[2]
      segA[i * 4 + 3] = c[3]
      segB[i * 4 + 0] = c[4]
      segB[i * 4 + 1] = c[5]
      segB[i * 4 + 2] = c[6]
      segB[i * 4 + 3] = c[7]
    }

    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      WEBGL_BAKE_SIZE,
      WEBGL_BAKE_SIZE,
      0,
      gl.RGBA,
      halfFloatType,
      null,
    )

    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.deleteFramebuffer(fbo)
      gl.deleteTexture(tex)
      return null
    }

    gl.useProgram(bakeProgram)
    const posLoc = gl.getAttribLocation(bakeProgram, 'a_pos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(gl.getUniformLocation(bakeProgram, 'u_bound'), WEBGL_BAKE_BOUND)
    gl.uniform1i(gl.getUniformLocation(bakeProgram, 'u_segCount'), segments.length)
    gl.uniform4fv(gl.getUniformLocation(bakeProgram, 'u_segA'), segA)
    gl.uniform4fv(gl.getUniformLocation(bakeProgram, 'u_segB'), segB)
    gl.viewport(0, 0, WEBGL_BAKE_SIZE, WEBGL_BAKE_SIZE)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.enable(gl.BLEND)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fbo)
    return tex
  }

  private initDirect(gl: WebGLRenderingContext, combined: readonly CubicSegment[]) {
    const program = link(gl, WEBGL_VERT, WEBGL_DIRECT_FRAG)
    if (!program) throw new Error('direct shader failed to link')
    this.directProgram = program
    gl.useProgram(program)
    const posLoc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    this.directUniforms = {
      res: gl.getUniformLocation(program, 'u_res'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
      offset: gl.getUniformLocation(program, 'u_offset'),
      color: gl.getUniformLocation(program, 'u_color'),
      opacity: gl.getUniformLocation(program, 'u_opacity'),
      segCount: gl.getUniformLocation(program, 'u_segCount'),
      segA: gl.getUniformLocation(program, 'u_segA'),
      segB: gl.getUniformLocation(program, 'u_segB'),
    }

    const segA = new Float32Array(MAX_SEGS * 4)
    const segB = new Float32Array(MAX_SEGS * 4)
    for (let i = 0; i < combined.length; i++) {
      const c = combined[i]
      segA[i * 4 + 0] = c[0]
      segA[i * 4 + 1] = c[1]
      segA[i * 4 + 2] = c[2]
      segA[i * 4 + 3] = c[3]
      segB[i * 4 + 0] = c[4]
      segB[i * 4 + 1] = c[5]
      segB[i * 4 + 2] = c[6]
      segB[i * 4 + 3] = c[7]
    }
    gl.uniform4fv(this.directUniforms.segA!, segA)
    gl.uniform4fv(this.directUniforms.segB!, segB)
    gl.uniform1i(this.directUniforms.segCount!, combined.length)
  }

  render(u: Uniforms): void {
    const gl = this.gl
    if (!gl || this.disposed) return
    gl.viewport(0, 0, u.width, u.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (this.mode === 'baked' && this.sampleProgram) {
      gl.useProgram(this.sampleProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.bracketTexture)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.xTexture)
      const sU = this.sampleUniforms
      gl.uniform2f(sU.res!, u.width, u.height)
      gl.uniform1f(sU.zoom!, u.zoom)
      gl.uniform2f(sU.offset!, u.offsetX, u.offsetY)
      gl.uniform3f(sU.color!, u.color[0], u.color[1], u.color[2])
      gl.uniform1f(sU.opacity!, u.opacity)
      gl.uniform2f(sU.bracketOffset!, u.bracketOffsetX, u.bracketOffsetY)
      gl.uniform2f(sU.xOffset!, u.xOffsetX, u.xOffsetY)
      gl.uniform1f(sU.sminK!, u.sminK)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      return
    }

    if (this.directProgram) {
      gl.useProgram(this.directProgram)
      const dU = this.directUniforms
      gl.uniform2f(dU.res!, u.width, u.height)
      gl.uniform1f(dU.zoom!, u.zoom)
      gl.uniform2f(dU.offset!, u.offsetX, u.offsetY)
      gl.uniform3f(dU.color!, u.color[0], u.color[1], u.color[2])
      gl.uniform1f(dU.opacity!, u.opacity)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
  }

  private disposeBakedTextures(gl: WebGLRenderingContext) {
    if (this.bracketTexture) gl.deleteTexture(this.bracketTexture)
    if (this.xTexture) gl.deleteTexture(this.xTexture)
    this.bracketTexture = null
    this.xTexture = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    if (gl) {
      if (this.bakeProgram) gl.deleteProgram(this.bakeProgram)
      if (this.sampleProgram) gl.deleteProgram(this.sampleProgram)
      if (this.directProgram) gl.deleteProgram(this.directProgram)
      this.disposeBakedTextures(gl)
      if (this.buffer) gl.deleteBuffer(this.buffer)
      const ext = gl.getExtension('WEBGL_lose_context')
      if (ext) ext.loseContext()
    }
    this.gl = null
    this.bakeProgram = null
    this.sampleProgram = null
    this.directProgram = null
    this.buffer = null
  }
}

function link(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const vShader = compile(gl, gl.VERTEX_SHADER, vs)
  const fShader = compile(gl, gl.FRAGMENT_SHADER, fs)
  if (!vShader || !fShader) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vShader)
  gl.attachShader(program, fShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[BezierLogo] program link failed:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[BezierLogo] shader compile failed:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}
