export type ScreenOptions = {
  minWidth?: string
  maxWidth?: string
}

/* --------------------------------------------------
 *   Breakpoints
 * ----------------------------------------------- */

export const screens = {
  /** 1367 ~ infinity (1920+) */
  xl: { minWidth: '1367px' },
  /** 0 (1024) ~ 1366 */
  lg: { maxWidth: '1366px' },
  /** 0 (768) ~ 1024 */
  md: { maxWidth: '1024px' },
  /** 0 ~ 768 */
  sm: { maxWidth: '768px' },
} as const satisfies Record<string, ScreenOptions>

export const colors = {} as const

/* --------------------------------------------------
 *   Gradients
 * ----------------------------------------------- */

export const gradients = {} as const

/* --------------------------------------------------
 *   Shadows
 * ----------------------------------------------- */

type ShadowTuple = [number, number, number] | [number, number, number, number]
type ShadowPalette = [string, string][]

function toDropShadowObject(shadowTuples: ShadowTuple[], palette: ShadowPalette) {
  return Object.fromEntries(
    shadowTuples.flatMap(([x, y, blur, spread = 0]) => {
      const keyBase = `${x}-${y}-${blur}${spread ? `-${spread}` : ''}`

      return palette.map(([name, color]) => [
        `${keyBase}-${name}`,
        `${x}px ${y}px ${blur}px ${spread}px ${color}`,
      ])
    }),
  ) as Record<string, string>
}

/**
 * Drop Shadow Object
 *
 * Example
 * - `shadow-0-4-4-black/8` => `box-shadow: 0 4px 4px 0 rgba(0 0 0 / 0.08)`
 * - `drop-shadow-0-4-8-2-black/12` => `filter: drop-shadow(0 4px 8px 2px rgba(0 0 0 / 0.12))`
 */
export const shadows = toDropShadowObject(
  [
    [0, 0, 0, 1],
    [0, 0, 8],
    [0, 0, 12],
    [0, 0, 20],
    [0, 1, 8, 2],
    [0, 2, 2],
    [0, 2, 4],
    [0, 2, 8],
    [0, 2, 12],
    [0, 2, 16],
    [0, 2, 20],
    [0, 4, 4],
    [0, 4, 8],
    [0, 4, 8, 2],
    [0, 4, 10],
    [0, 4, 12],
    [0, 4, 16],
    [0, 4, 24],
    [1, 1, 8],
    [2, 2, 8],
  ],
  [
    ...([4, 6, 8, 10, 12, 16, 20, 24, 60].map((opacity) => [
      `black/${opacity}`,
      `rgba(0 0 0 / ${opacity / 100})`,
    ]) as [string, string][]),
    ...([4, 6, 8, 12, 16, 20].map((opacity) => [
      `white/${opacity}`,
      `rgba(255 255 255 / ${opacity / 100})`,
    ]) as [string, string][]),
  ],
)
