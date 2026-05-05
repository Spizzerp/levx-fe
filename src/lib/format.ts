/**
 * Shared formatters. Kept here so there's one canonical way to render
 * prices, deltas, durations, etc. across the app.
 */

export function formatUSD(n: number, opts: Intl.NumberFormatOptions = {}): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0, ...opts })
}

/** On-chain composite score (0..1_000_000) -> user-facing Path Accuracy Score (0..100). */
export function pathAccuracyScoreFromComposite(compositeScore: number): number {
  const boundedScore = Math.max(0, Math.min(1_000_000, compositeScore))
  return boundedScore / 10_000
}

/** Format a Path Accuracy Score for UI labels. */
export function formatPathAccuracyScore(compositeScore: number): string {
  return pathAccuracyScoreFromComposite(compositeScore).toFixed(1)
}

/** Basis points → "+3.52%" or "-1.18%" */
export function formatDeltaBps(bps: number): string {
  const pct = bps / 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(3)}%`
}

/** Duration in ms → "14D · 06:42:18" */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0D · 00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${days}D · ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** e.g. 7 days -> "7 Day Market", 12 hours -> "12 Hour Market" */
export function formatMarketDurationLabel(startMs: number, endMs: number): string {
  const durationMs = Math.max(0, endMs - startMs)
  const hourMs = 60 * 60 * 1000
  const dayMs = 24 * hourMs

  if (durationMs < dayMs) {
    const hours = Math.max(1, Math.round(durationMs / hourMs))
    return `${hours} Hour Market`
  }

  const days = Math.max(1, Math.round(durationMs / dayMs))
  return `${days} Day Market`
}

/** Max leverage cap by duration (§9.2 of the architecture doc) */
export function maxLeverageByDuration(durationMs: number): number {
  const days = durationMs / (24 * 60 * 60 * 1000)
  if (days <= 1) return 50
  if (days <= 3) return 30
  if (days <= 7) return 20
  if (days <= 30) return 10
  return 5
}

/** Truncate a base58 address for display — "first4···last4". */
export function formatAddress(base58: string): string {
  return `${base58.slice(0, 4)}···${base58.slice(-4)}`
}

/** Build a Solana explorer URL for an address. */
export function explorerAddressUrl(base58: string, cluster: string): string {
  const clusterParam = cluster === 'mainnet' ? 'mainnet-beta' : cluster
  return `https://explorer.solana.com/address/${base58}?cluster=${clusterParam}`
}

/** Build a Solana explorer URL for a transaction. */
export function explorerTxUrl(txSig: string, network?: string): string {
  const cluster = (network ?? 'devnet') === 'mainnet' ? '' : '?cluster=devnet'
  return `https://explorer.solana.com/tx/${txSig}${cluster}`
}
