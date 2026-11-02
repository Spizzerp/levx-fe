/**
 * Display helpers for the Mode 2 trader screen. On-chain amounts stay micro-USDC `bigint` until
 * they reach these functions; nothing here goes through a float except the leverage tenths.
 */
import type { PredictionPath } from '@/types/market'

/** The minus sign, U+2212: it lines up with the plus sign and is not a hyphen. */
const MINUS = '−'

const MICRO_PER_CENT = 10_000n
const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

/** Micro-USDC as `29.70`: two decimals, truncating below the cent; a loss carries the minus sign. */
export function formatUsdc(micro: bigint): string {
  const cents = (micro < 0n ? -micro : micro) / MICRO_PER_CENT
  const text = `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
  return micro < 0n && cents > 0n ? `${MINUS}${text}` : text
}

/** Micro-USDC with an explicit sign: `+29.70`, `−5.90`, and `+0.00` for zero. */
export function formatSignedUsdc(micro: bigint): string {
  const text = formatUsdc(micro)
  return text.startsWith(MINUS) ? text : `+${text}`
}

/** Leverage with one decimal: `2.4×`, `3.0×`. */
export function formatLeverage(leverage: number): string {
  return `${leverage.toFixed(1)}×`
}

function clockTime(ms: number): string {
  const date = new Date(ms)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** The market's span: `1h` for whole hours, else minutes (`50m`). */
export function formatMarketSpan(startMs: number, endMs: number): string {
  const span = endMs - startMs
  return span % MS_PER_HOUR === 0
    ? `${span / MS_PER_HOUR}h`
    : `${Math.round(span / MS_PER_MINUTE)}m`
}

/** `1h · 14:00 → 15:00`: the span, then start and end in 24-hour local time. */
export function formatMarketWindow(startMs: number, endMs: number): string {
  return `${formatMarketSpan(startMs, endMs)} · ${clockTime(startMs)} → ${clockTime(endMs)}`
}

/** Time left as `m:ss`, flooring partial seconds and stopping at `0:00`. */
export function formatCountdownShort(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export type PathDirection = 'LONG' | 'SHORT'

/** LONG when the path ends at or above where it starts; an empty or one-point path is LONG. */
export function pathDirection(path: PredictionPath): PathDirection {
  const first = path.data[0]
  const last = path.data.at(-1)
  return first && last && last.value < first.value ? 'SHORT' : 'LONG'
}

/** Each path's name and direction, keyed by its on-chain `pathIndex`. */
export function pathLabelsOf(
  paths: readonly PredictionPath[],
): Record<number, { name: string; direction: PathDirection }> {
  return Object.fromEntries(
    paths.map((path) => [path.pathIndex, { name: path.label, direction: pathDirection(path) }]),
  )
}
