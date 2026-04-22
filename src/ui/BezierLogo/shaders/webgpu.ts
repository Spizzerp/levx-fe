/**
 * WGSL shaders for the WebGPU renderer.
 *
 *   BAKE pipeline runs twice at init — once per sub-shape — writing each
 *   signed-distance field into its own r16float texture.
 *
 *   SAMPLE pipeline runs each frame of the intro animation. It samples
 *   both SDFs at their translated UVs, smooth-unions them with a
 *   polynomial smin, and shades with fwidth-based AA.
 *
 *   BOUND = 1.2 covers each sub-shape (normalized to [-1, 1]²) plus a
 *   margin for animation-time translation at zoom ≈ 1.
 */

export const WEBGPU_BAKE_SHADER = /* wgsl */ `
const BOUND: f32 = 1.2;

struct Segment {
  a: vec4<f32>,
  b: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> segments: array<Segment>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VsOut {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  var out: VsOut;
  out.pos = vec4<f32>(pos[vi], 0.0, 1.0);
  // Flip y so the baked field is stored with +y up, matching the sample
  // shader's UV space.
  out.uv = vec2<f32>(pos[vi].x * BOUND, -pos[vi].y * BOUND);
  return out;
}

fn bezier(p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>, p3: vec2<f32>, t: f32) -> vec2<f32> {
  let u = 1.0 - t;
  return u*u*u * p0 + 3.0*u*u*t * p1 + 3.0*u*t*t * p2 + t*t*t * p3;
}

fn bezier_deriv(p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>, p3: vec2<f32>, t: f32) -> vec2<f32> {
  let u = 1.0 - t;
  return 3.0*u*u * (p1 - p0) + 6.0*u*t * (p2 - p1) + 3.0*t*t * (p3 - p2);
}

fn dist_to_cubic(p: vec2<f32>, p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>, p3: vec2<f32>) -> vec2<f32> {
  var crossings: f32 = 0.0;
  var prevY = p0.y - p.y;
  var prevX = p0.x;
  for (var i: i32 = 1; i <= 16; i = i + 1) {
    let t = f32(i) / 16.0;
    let b = bezier(p0, p1, p2, p3, t);
    let y = b.y - p.y;
    let crossed = (prevY <= 0.0 && y > 0.0) || (prevY > 0.0 && y <= 0.0);
    if (crossed) {
      let s = prevY / (prevY - y);
      let xc = mix(prevX, b.x, s);
      if (xc > p.x) { crossings = crossings + 1.0; }
    }
    prevY = y;
    prevX = b.x;
  }
  var bestT: f32 = 0.0;
  var bestD2: f32 = 1e20;
  for (var i: i32 = 0; i <= 12; i = i + 1) {
    let t = f32(i) / 12.0;
    let b = bezier(p0, p1, p2, p3, t);
    let d2 = dot(b - p, b - p);
    if (d2 < bestD2) { bestD2 = d2; bestT = t; }
  }
  for (var i: i32 = 0; i < 3; i = i + 1) {
    let b = bezier(p0, p1, p2, p3, bestT);
    let db = bezier_deriv(p0, p1, p2, p3, bestT);
    let diff = b - p;
    let u = 1.0 - bestT;
    let ddb = 6.0 * u * (p2 - 2.0 * p1 + p0) + 6.0 * bestT * (p3 - 2.0 * p2 + p1);
    let f = dot(diff, db);
    let fp = dot(db, db) + dot(diff, ddb);
    if (abs(fp) > 1e-8) {
      bestT = clamp(bestT - f / fp, 0.0, 1.0);
    }
  }
  let bfinal = bezier(p0, p1, p2, p3, bestT);
  return vec2<f32>(length(bfinal - p), crossings);
}

fn scene_sdf(p: vec2<f32>) -> f32 {
  var minD: f32 = 1e20;
  var crossings: f32 = 0.0;
  let count = i32(arrayLength(&segments));
  for (var i: i32 = 0; i < count; i = i + 1) {
    let seg = segments[i];
    let r = dist_to_cubic(p, seg.a.xy, seg.a.zw, seg.b.xy, seg.b.zw);
    if (r.x < minD) { minD = r.x; }
    crossings = crossings + r.y;
  }
  let inside = (i32(crossings) % 2) == 1;
  if (inside) { return -minD; } else { return minD; }
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let d = scene_sdf(in.uv);
  return vec4<f32>(d, 0.0, 0.0, 1.0);
}
`

/**
 * Sample shader: two SDF fetches (bracket + X) at their animated offsets,
 * smooth-unioned via polynomial smin so the shapes appear to split from a
 * single fluid blob into two separate silhouettes.
 */
export const WEBGPU_SAMPLE_SHADER = /* wgsl */ `
const BOUND: f32 = 1.2;

struct Uniforms {
  resolution: vec2<f32>,
  zoom: f32,
  sminK: f32,
  offset: vec2<f32>,
  bracketOffset: vec2<f32>,
  xOffset: vec2<f32>,
  _pad: vec2<f32>,
  color: vec3<f32>,
  opacity: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var sdfSampler: sampler;
@group(0) @binding(2) var sdfBracket: texture_2d<f32>;
@group(0) @binding(3) var sdfX: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VsOut {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0),
  );
  var out: VsOut;
  out.pos = vec4<f32>(pos[vi], 0.0, 1.0);
  out.uv = pos[vi];
  return out;
}

// Polynomial smooth-min (union). k is rounding radius in UV units; when
// |a - b| >= k it collapses to plain min(a, b), so two well-separated
// shapes render as a clean union.
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let res = U.resolution;
  var uv = (fragCoord.xy - 0.5 * res) / min(res.x, res.y);
  // Flip y so +y is up (matches the coord space the SDF was baked in).
  uv.y = -uv.y;
  uv = uv * (2.0 / U.zoom);
  uv = uv - U.offset;

  let uvBracket = uv - U.bracketOffset;
  let uvX = uv - U.xOffset;
  let tBracket = clamp((uvBracket / BOUND) * 0.5 + 0.5, vec2<f32>(0.0), vec2<f32>(1.0));
  let tX = clamp((uvX / BOUND) * 0.5 + 0.5, vec2<f32>(0.0), vec2<f32>(1.0));

  let dBracket = textureSample(sdfBracket, sdfSampler, tBracket).r;
  let dX = textureSample(sdfX, sdfSampler, tX).r;
  let d = smin(dBracket, dX, max(U.sminK, 1e-4));

  let aa = fwidth(d) * 1.2;
  let mask = 1.0 - smoothstep(-aa, aa, d);
  return vec4<f32>(U.color, mask * U.opacity);
}
`

export const WEBGPU_BAKE_SIZE = 1024
