import { describe, it, expect, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { acquireChannel, releaseChannel, __resetChannelRegistry } from '../channels'

type FakeChannel = { name: string; removed: boolean }
const fakeChannels: Record<string, FakeChannel> = {}

function fakeSupabase(): SupabaseClient {
  return {
    channel(name: string) {
      const ch: FakeChannel = { name, removed: false }
      fakeChannels[name] = ch
      return ch
    },
    removeChannel(ch: FakeChannel) {
      ch.removed = true
    },
  } as unknown as SupabaseClient
}

describe('channels ref-counting', () => {
  beforeEach(() => {
    for (const k of Object.keys(fakeChannels)) delete fakeChannels[k]
    __resetChannelRegistry()
  })

  it('three acquires yield one underlying channel', () => {
    const s = fakeSupabase()
    const a = acquireChannel(s, 'comments:1', { config: {} })
    const b = acquireChannel(s, 'comments:1', { config: {} })
    const c = acquireChannel(s, 'comments:1', { config: {} })
    expect(a.channel).toBe(b.channel)
    expect(b.channel).toBe(c.channel)
    expect(Object.keys(fakeChannels).length).toBe(1)
  })

  it('releases decrement the count; removeChannel only on final release', () => {
    const s = fakeSupabase()
    acquireChannel(s, 'comments:1', { config: {} })
    acquireChannel(s, 'comments:1', { config: {} })
    releaseChannel(s, 'comments:1')
    expect(fakeChannels['comments:1'].removed).toBe(false)
    releaseChannel(s, 'comments:1')
    expect(fakeChannels['comments:1'].removed).toBe(true)
  })

  it('release beyond zero is a noop', () => {
    const s = fakeSupabase()
    acquireChannel(s, 'comments:1', { config: {} })
    releaseChannel(s, 'comments:1')
    releaseChannel(s, 'comments:1')
    expect(fakeChannels['comments:1'].removed).toBe(true)
  })

  it('different names yield different channels', () => {
    const s = fakeSupabase()
    const a = acquireChannel(s, 'comments:1', { config: {} })
    const b = acquireChannel(s, 'comments:2', { config: {} })
    expect(a.channel).not.toBe(b.channel)
  })

  it('exposes isFirstAcquire — true on creation, false on subsequent acquires', () => {
    const s = fakeSupabase()
    const a = acquireChannel(s, 'comments:1', { config: {} })
    const b = acquireChannel(s, 'comments:1', { config: {} })
    const c = acquireChannel(s, 'comments:1', { config: {} })
    expect(a.isFirstAcquire).toBe(true)
    expect(b.isFirstAcquire).toBe(false)
    expect(c.isFirstAcquire).toBe(false)
  })

  it('isFirstAcquire resets to true after final release + re-acquire', () => {
    const s = fakeSupabase()
    const first = acquireChannel(s, 'comments:1', { config: {} })
    expect(first.isFirstAcquire).toBe(true)
    releaseChannel(s, 'comments:1')
    const fresh = acquireChannel(s, 'comments:1', { config: {} })
    expect(fresh.isFirstAcquire).toBe(true)
    expect(fresh.channel).not.toBe(first.channel)
  })
})
