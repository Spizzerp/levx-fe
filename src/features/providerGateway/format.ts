import type { ProviderRecord, ReputationSnapshot } from './types'

export function providerLabel(
  providerId: string,
  providerById: Map<string, ProviderRecord>,
): string {
  return providerById.get(providerId)?.display_name || shortId(providerId)
}

export function shortId(value: string, prefix = 10, suffix = 6): string {
  if (value.length <= prefix + suffix + 1) return value
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return value.toFixed(3)
}

export function formatDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function latestSnapshot(
  snapshots: ReputationSnapshot[] | undefined,
): ReputationSnapshot | null {
  if (!snapshots || snapshots.length === 0) return null
  return (
    snapshots
      .toSorted((a, b) => {
        if (a.window_days !== b.window_days) return a.window_days - b.window_days
        return a.updated_at.localeCompare(b.updated_at)
      })
      .at(-1) ?? null
  )
}
