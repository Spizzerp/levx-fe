/** Fixed-point scale factor used across on-chain arithmetic. All u64 values ÷ SCALE for display. */
export const SCALE = 1_000_000

/** Per-instruction compute-unit budgets. Static; could be replaced with simulate-derived values later. */
export const CU_LIMITS = {
  addPath: 100_000,
  createPathUploadIntent: 140_000,
  placeWager: 200_000,
  exitPosition: 120_000,
  claim: 120_000,
  createMarket: 250_000,
  closeMarket: 120_000,
} as const

/** Solana's hard cap on per-transaction compute units. */
export const MAX_CU_PER_TX = 1_400_000

/** Brand gradient endpoints (yellow → green). Matches --color-brand-from/to in tokens.css. */
export const BRAND = {
  from: '#F4FA4D',
  to: '#5CF78B',
} as const

export const GRADIENT = {
  ...BRAND,
  /** CSS linear-gradient string */
  css: `linear-gradient(135deg, ${BRAND.from}, ${BRAND.to})`,
  /** Tailwind classes for bg gradient */
  tw: `bg-gradient-to-r from-brand-from to-brand-to`,
  /** Hover glow shadow */
  glowHover: '0 0 20px rgba(160,248,120,0.35), 0 0 60px rgba(160,248,120,0.15)',
} as const

/** Dot gradients for status indicators. */
export const DOT_GRADIENT = {
  /** Green/positive: brand yellow → green */
  positive: `linear-gradient(135deg, ${BRAND.from}, ${BRAND.to})`,
  /** Red/negative: red → yellow */
  negative: 'linear-gradient(135deg, #FF453A, #F4FA4D)',
} as const
