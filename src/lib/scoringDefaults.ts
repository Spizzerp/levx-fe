/**
 * Scoring parameters for new markets, in human units (the program takes
 * them scaled by `SCALE`).
 *
 * Mirror of the pipeline's `SCORING_PARAMS` (levx-infra
 * `integrations/market_create.py`) and LevXv2 `scripts/scoring-defaults.ts`;
 * the honest-paths study fills referenceAction, decoherenceRate,
 * minimumProbability.
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
