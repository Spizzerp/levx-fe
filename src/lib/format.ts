/**
 * Shared formatters. Kept here so there's one canonical way to render
 * prices, deltas, durations, etc. across the app.
 */

export function formatUSD(n: number, opts: Intl.NumberFormatOptions = {}): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0, ...opts })
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

/** e.g. 7 days → "7D MARKET" */
export function formatMarketDurationLabel(startMs: number, endMs: number): string {
  const days = Math.round((endMs - startMs) / (24 * 60 * 60 * 1000))
  return `${days}D MARKET`
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
