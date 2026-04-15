/** Fixed-point scale factor used across on-chain arithmetic. All u64 values ÷ SCALE for display. */
export const SCALE = 1_000_000

/** Brand gradient endpoints (yellow → green). */
export const GRADIENT = {
  from: '#F4FA4D',
  to: '#5CF78B',
  /** CSS linear-gradient string */
  css: 'linear-gradient(135deg, #F4FA4D, #5CF78B)',
  /** Tailwind classes for bg gradient */
  tw: 'bg-gradient-to-r from-[#F4FA4D] to-[#5CF78B]',
  /** Hover glow shadow (rgba of midpoint color) */
  glowHover: '0 0 20px rgba(160,248,120,0.35), 0 0 60px rgba(160,248,120,0.15)',
} as const
