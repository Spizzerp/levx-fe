/**
 * GLSL ES 1.00 shaders for the WebGL renderer.
 *
 * Two-pass design:
 *   1. BAKE pass (run twice at init — once per sub-shape) — evaluates the
 *      signed-distance field for a set of cubic Beziers over a square
 *      [-BOUND, BOUND]² region and writes the scalar distance into the R
 *      channel of a half-float FBO.
 *   2. SAMPLE pass (run every frame during the intro animation) — samples
 *      the two baked SDFs at translated UVs, smooth-unions them with a
 *      polynomial smin, and rasterizes the resulting silhouette.
 *
 * If the required float-texture extensions aren't available, the renderer
 * falls back to DIRECT_FRAG which evaluates one combined SDF per pixel —
 * a static silhouette in the final split state, with no intro animation.
 *
 * BOUND = 1.2 covers each sub-shape (inside [-1, 1]²) plus margin for the
 * shapes' animation-time translation at zoom ≈ 1.
 */

// Shared SDF body used by bake + direct fallback shaders. Reads
// u_segA/u_segB from module-scope uniforms.
const SDF_BODY = /* glsl */ `
#define MAX_SEGS 32
uniform int  u_segCount;
uniform vec4 u_segA[MAX_SEGS];
uniform vec4 u_segB[MAX_SEGS];

vec2 bezier(vec2 p0, vec2 p1, vec2 p2, vec2 p3, float t) {
  float u = 1.0 - t;
  return u*u*u * p0 + 3.0*u*u*t * p1 + 3.0*u*t*t * p2 + t*t*t * p3;
}

vec2 bezierDeriv(vec2 p0, vec2 p1, vec2 p2, vec2 p3, float t) {
  float u = 1.0 - t;
  return 3.0*u*u * (p1 - p0) + 6.0*u*t * (p2 - p1) + 3.0*t*t * (p3 - p2);
}

float distToCubic(vec2 p, vec2 p0, vec2 p1, vec2 p2, vec2 p3, inout int crossings) {
  const int NS = 16;
  float prevY = p0.y - p.y;
  float prevX = p0.x;
  for (int i = 1; i <= NS; i++) {
    float t = float(i) / float(NS);
    vec2 b = bezier(p0, p1, p2, p3, t);
    float y = b.y - p.y;
    if ((prevY <= 0.0 && y > 0.0) || (prevY > 0.0 && y <= 0.0)) {
      float s = prevY / (prevY - y);
      float xc = mix(prevX, b.x, s);
      if (xc > p.x) crossings += 1;
    }
    prevY = y;
    prevX = b.x;
  }
  float bestT = 0.0;
  float bestD2 = 1e20;
  const int NC = 12;
  for (int i = 0; i <= NC; i++) {
    float t = float(i) / float(NC);
    vec2 b = bezier(p0, p1, p2, p3, t);
    float d2 = dot(b - p, b - p);
    if (d2 < bestD2) { bestD2 = d2; bestT = t; }
  }
  for (int i = 0; i < 3; i++) {
    vec2 b  = bezier(p0, p1, p2, p3, bestT);
    vec2 db = bezierDeriv(p0, p1, p2, p3, bestT);
    vec2 diff = b - p;
    float u = 1.0 - bestT;
    vec2 ddb = 6.0*u*(p2 - 2.0*p1 + p0) + 6.0*bestT*(p3 - 2.0*p2 + p1);
    float f  = dot(diff, db);
    float fp = dot(db, db) + dot(diff, ddb);
    if (abs(fp) > 1e-8) {
      bestT = clamp(bestT - f / fp, 0.0, 1.0);
    }
  }
  vec2 b = bezier(p0, p1, p2, p3, bestT);
  return length(b - p);
}

float sceneSDF(vec2 p) {
  float minD = 1e20;
  int crossings = 0;
  for (int i = 0; i < MAX_SEGS; i++) {
    if (i >= u_segCount) break;
    vec4 a = u_segA[i];
    vec4 b = u_segB[i];
    float d = distToCubic(p, a.xy, a.zw, b.xy, b.zw, crossings);
    if (d < minD) minD = d;
  }
  bool inside = (crossings - (crossings / 2) * 2) == 1;
  return inside ? -minD : minD;
}
`

/** Shared fullscreen-quad vertex shader (post-bake sampling pass). */
export const WEBGL_VERT = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

/** Vertex shader for the bake pass — passes UV scaled to the bake bound. */
export const WEBGL_BAKE_VERT = /* glsl */ `
attribute vec2 a_pos;
varying vec2 v_uv;
uniform float u_bound;
void main() {
  v_uv = a_pos * u_bound;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

/** Bake fragment — writes raw signed distance to the R channel. */
export const WEBGL_BAKE_FRAG =
  /* glsl */ `
precision highp float;
varying vec2 v_uv;
` +
  SDF_BODY +
  /* glsl */ `
void main() {
  float d = sceneSDF(v_uv);
  gl_FragColor = vec4(d, 0.0, 0.0, 1.0);
}
`

/**
 * Sample fragment — reads two baked SDFs (bracket and X), translates each
 * by its own offset, smooth-unions them, and rasterizes the silhouette.
 *
 *   u_bracketOffset / u_xOffset — UV translations. Starts large (merged),
 *       eases to (0, 0) over the intro animation.
 *   u_sminK — rounding radius for the smooth union in UV units.
 */
export const WEBGL_SAMPLE_FRAG = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  u_res;
uniform float u_zoom;
uniform vec2  u_offset;
uniform vec3  u_color;
uniform float u_opacity;
uniform sampler2D u_sdfBracket;
uniform sampler2D u_sdfX;
uniform float u_bound;
uniform vec2  u_bracketOffset;
uniform vec2  u_xOffset;
uniform float u_sminK;

// Polynomial smooth-min (union). k is rounding radius in UV units; when
// |a - b| >= k the result collapses to plain min(a, b).
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  uv *= 2.0 / u_zoom;
  uv -= u_offset;

  vec2 uvBracket = uv - u_bracketOffset;
  vec2 uvX = uv - u_xOffset;
  vec2 tBracket = clamp((uvBracket / u_bound) * 0.5 + 0.5, 0.0, 1.0);
  vec2 tX = clamp((uvX / u_bound) * 0.5 + 0.5, 0.0, 1.0);

  float dBracket = texture2D(u_sdfBracket, tBracket).r;
  float dX = texture2D(u_sdfX, tX).r;
  float d = smin(dBracket, dX, max(u_sminK, 1e-4));

  float aa = fwidth(d) * 1.2;
  float mask = 1.0 - smoothstep(-aa, aa, d);
  gl_FragColor = vec4(u_color, mask * u_opacity);
}
`

/**
 * Fallback direct fragment — evaluates one combined SDF per pixel (no
 * bake, no animation). Used when half-float color-buffer extensions are
 * unavailable; the logo renders in its final split state with no intro.
 */
export const WEBGL_DIRECT_FRAG =
  /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  u_res;
uniform float u_zoom;
uniform vec2  u_offset;
uniform vec3  u_color;
uniform float u_opacity;
` +
  SDF_BODY +
  /* glsl */ `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  uv *= 2.0 / u_zoom;
  uv -= u_offset;
  float d = sceneSDF(uv);
  float aa = fwidth(d) * 1.2;
  float mask = 1.0 - smoothstep(-aa, aa, d);
  gl_FragColor = vec4(u_color, mask * u_opacity);
}
`

export const WEBGL_BAKE_BOUND = 1.2
export const WEBGL_BAKE_SIZE = 1024
