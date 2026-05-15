export function marketTimeProgressPercent({
  startTime,
  endTime,
  now,
}: {
  startTime: number
  endTime: number
  now: number
}): number {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || !Number.isFinite(now)) {
    return 0
  }

  if (endTime <= startTime) return now >= endTime ? 100 : 0

  const elapsed = now - startTime
  const duration = endTime - startTime
  return Math.min(100, Math.max(0, (elapsed / duration) * 100))
}
