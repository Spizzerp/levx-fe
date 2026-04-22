import { vi } from 'vitest'

type Listener = (payload: unknown) => void
const listeners = new Map<string, Listener[]>()

export function __emitRealtime(name: string, event: string, payload: unknown) {
  const key = `${name}::${event}`
  listeners.get(key)?.forEach((l) => l(payload))
}

export function __resetSupabaseMock() {
  listeners.clear()
}

export const mockFrom = vi.fn()
export const mockSend = vi.fn(async () => 'ok')
export const mockRemoveChannel = vi.fn()
export const mockStorageUpload = vi.fn(async () => ({ data: { path: 'mock/path.png' }, error: null }))
export const mockStorageRemove = vi.fn(async () => ({ data: [], error: null }))
export const mockStorageGetPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://example.com/mock/path.png' } }))

export const createClient = vi.fn(() => ({
  from: mockFrom,
  storage: {
    from() {
      return {
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        getPublicUrl: mockStorageGetPublicUrl,
      }
    },
  },
  channel(name: string) {
    return {
      on(_type: string, filter: { event: string } | unknown, cb: Listener) {
        const event = (filter as { event: string }).event ?? 'INSERT'
        const key = `${name}::${event}`
        const list = listeners.get(key) ?? []
        list.push(cb)
        listeners.set(key, list)
        return this
      },
      subscribe(cb?: (s: string) => void) { cb?.('SUBSCRIBED'); return this },
      send: mockSend,
      unsubscribe() { /* noop */ },
    }
  },
  removeChannel: mockRemoveChannel,
}))
