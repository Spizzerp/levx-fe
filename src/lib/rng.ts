/**
 * Seeded pseudo-random number generator (mulberry32). Deterministic per seed —
 * used by test fixtures and the landing-page mock chart so their output is
 * stable across re-renders and test runs.
 */
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller transform: uniform [0,1) → standard normal. */
export function normalRandom(rng: () => number): number {
  const u1 = rng() || 1e-10
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
