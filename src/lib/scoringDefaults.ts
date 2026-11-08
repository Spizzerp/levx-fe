/**
 * Scoring parameters for new markets, in human units (the program takes
 * them scaled by `SCALE`).
 *
 * The pipeline's values live in the `SCORING_PARAMS` block of levx-infra
 * `pipeline/src/levx_pipeline/integrations/market_create.py`. LevXv2's
 * `scripts/scoring-defaults.ts` exists on main, with a copy in LevXv2
 * `keeper/src/`, kept equal by `scripts/__tests__/scoring-defaults.test.ts`.
 * The study fills three fields: `referenceAction`, `decoherenceRate`,
 * `minimumProbability`; these are its "medium" preset (LevXv2
 * `research/scoring-params-2026-11/results/study.md`).
 *
 * `lambda`: the admin form's default is 0 and stays editable; the pipeline
 * creates markets with 0.5 (500_000) — a known divergence, not aligned here.
 */
export const SCORING_DEFAULTS = {
  actionAlpha: 0.7,
  actionBeta: 0.3,
  decoherenceRate: 20,
  minimumProbability: 0.1,
  nudgeRate: 0.05,
  lambda: 0,
  referenceAction: 0.0003,
  weightQv: 0.375,
  weightDd: 0.375,
  weightEndpoint: 0.125,
  weightDisplacement: 0.125,
} as const

/**
 * Market parameters for new markets, matching the pipeline and the devnet
 * scripts. `lmsrAlpha` is 5.0 because 1.0 saturates `exp_fp` once a path
 * accumulates ~145+ shares (the pipeline's note, LevXv2 PR #7 phase 7).
 * `pathMaxAge` (seconds) and `targetNumPaths` are the admin form's defaults.
 */
export const MARKET_DEFAULTS = {
  lmsrAlpha: 5.0,
  pathMaxAge: 1800,
  targetNumPaths: 5,
} as const
