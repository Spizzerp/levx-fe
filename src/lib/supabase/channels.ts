import type { RealtimeChannel, RealtimeChannelOptions, SupabaseClient } from '@supabase/supabase-js'

type Entry = { channel: RealtimeChannel; count: number }
const registry = new Map<string, Entry>()

export type AcquireResult = {
  /** The shared underlying RealtimeChannel for this name. */
  channel: RealtimeChannel
  /**
   * `true` only on the acquire that created the channel; `false` for every
   * subsequent acquire while the channel is alive. Use this to gate
   * `.on(...).subscribe()` calls so listeners are attached exactly once
   * (subsequent consumers must rely on a shared sink — e.g. a TanStack Query
   * cache singleton — rather than per-instance state).
   */
  isFirstAcquire: boolean
}

export function __resetChannelRegistry(): void {
  registry.clear()
}

export function acquireChannel(
  supabase: SupabaseClient,
  name: string,
  opts: RealtimeChannelOptions,
): AcquireResult {
  const existing = registry.get(name)
  if (existing) {
    existing.count += 1
    return { channel: existing.channel, isFirstAcquire: false }
  }
  const channel = supabase.channel(name, opts)
  registry.set(name, { channel, count: 1 })
  return { channel, isFirstAcquire: true }
}

export function releaseChannel(supabase: SupabaseClient, name: string): void {
  const entry = registry.get(name)
  if (!entry) return
  entry.count -= 1
  if (entry.count <= 0) {
    supabase.removeChannel(entry.channel)
    registry.delete(name)
  }
}
