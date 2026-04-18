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
    expect(a).toBe(b)
    expect(b).toBe(c)
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
    expect(a).not.toBe(b)
  })
})
