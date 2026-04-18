import type { RealtimeChannel, RealtimeChannelOptions, SupabaseClient } from '@supabase/supabase-js'

type Entry = { channel: RealtimeChannel; count: number }
const registry = new Map<string, Entry>()

export function __resetChannelRegistry(): void {
  registry.clear()
}

export function acquireChannel(
  supabase: SupabaseClient,
  name: string,
  opts: RealtimeChannelOptions,
): RealtimeChannel {
  const existing = registry.get(name)
  if (existing) {
    existing.count += 1
    return existing.channel
  }
  const channel = supabase.channel(name, opts)
  registry.set(name, { channel, count: 1 })
  return channel
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
