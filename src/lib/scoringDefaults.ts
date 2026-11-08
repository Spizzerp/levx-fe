/**
 * Scoring parameters for new markets, in human units (the program takes
 * them scaled by `SCALE`).
 *
 * The pipeline's values live in levx-infra
 * `pipeline/src/levx_pipeline/integrations/market_create.py` (today as struct
 * literals; a `SCORING_PARAMS` block lands with the honest-paths pipeline
 * branch). LevXv2's `scripts/scoring-defaults.ts` exists on branch
 * `research/scoring-params-study`, with a verbatim copy in `keeper/src/`.
 * The study fills three fields: `referenceAction`, `decoherenceRate`,
 * `minimumProbability`.
 *
 * `lambda`: the admin form's default is 0 and stays editable; the pipeline
 * creates markets with 0.5 (500_000) — a known divergence, not aligned here.
 */
export const SCORING_DEFAULTS = {
  actionAlpha: 0.7,
  actionBeta: 0.3,
  decoherenceRate: 0.5,
  minimumProbability: 0.01,
  nudgeRate: 0.05,
  lambda: 0,
  referenceAction: 1.0,
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
