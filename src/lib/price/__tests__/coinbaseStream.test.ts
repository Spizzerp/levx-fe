import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createCoinbaseStream } from '@/lib/price/coinbaseStream'
import type { CoinbaseEvent } from '@/lib/price/coinbaseStream'

// Measured on 2026-10-31 (other fields abridged).
const MATCH = {
  type: 'match',
  price: '95.7',
  product_id: 'SOL-USD',
  time: '2026-10-31T13:18:18.577625Z',
}
const LAST_MATCH = {
  type: 'last_match',
  price: '95.69',
  product_id: 'SOL-USD',
  time: '2026-10-31T13:18:12.104883Z',
}
const HEARTBEAT = { type: 'heartbeat', product_id: 'SOL-USD', time: '2026-10-31T13:18:14.000000Z' }

const CHANNELS = ['matches', 'heartbeat']
const subscribeMsg = (...productIds: string[]) => ({
  type: 'subscribe',
  product_ids: productIds,
  channels: CHANNELS,
})
const unsubscribeMsg = (...productIds: string[]) => ({
  type: 'unsubscribe',
  product_ids: productIds,
  channels: CHANNELS,
})

/** A WebSocket stand-in: records sends; the test drives open, messages and closes. */
class FakeSocket {
  static instances: FakeSocket[] = []
  sent: unknown[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null

  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.closed = true
  }

  open() {
    this.onopen?.()
  }

  receive(msg: unknown) {
    this.onmessage?.({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) })
  }

  /** The connection drops (or the browser reports a close). */
  drop() {
    this.onclose?.()
  }
}

const newStream = () => createCoinbaseStream(FakeSocket as unknown as typeof WebSocket)

describe('coinbaseStream', () => {
  beforeEach(() => {
    FakeSocket.instances = []
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('parses match and last_match as trades and heartbeat as liveness', () => {
    const events: CoinbaseEvent[] = []
    const off = newStream().subscribe('SOL-USD', (e) => events.push(e))
    expect(FakeSocket.instances).toHaveLength(1)
    const ws = FakeSocket.instances[0]
    expect(ws.url).toBe('wss://ws-feed.exchange.coinbase.com')
    ws.open()

    ws.receive({ type: 'subscriptions', channels: [] })
    ws.receive(LAST_MATCH)
    ws.receive(MATCH)
    ws.receive(HEARTBEAT)
    // Another product's trade, junk and a malformed price reach no SOL listener.
    ws.receive({ ...MATCH, product_id: 'BTC-USD', price: '70000' })
    ws.receive('not json')
    ws.receive({ ...MATCH, price: 'n/a' })

    expect(events).toEqual([
      { kind: 'trade', price: 95.69, timeMs: Date.parse(LAST_MATCH.time) },
      { kind: 'trade', price: 95.7, timeMs: Date.parse(MATCH.time) },
      { kind: 'heartbeat', timeMs: Date.parse(HEARTBEAT.time) },
    ])
    expect(events[1].timeMs).toBe(Date.UTC(2026, 9, 31, 13, 18, 18, 577))
    off()
  })

  it('refcounts subscriptions per product', () => {
    vi.useFakeTimers()
    const stream = newStream()
    const a = vi.fn()
    const b = vi.fn()
    const c = vi.fn()

    const offA = stream.subscribe('SOL-USD', a)
    const ws = FakeSocket.instances[0]
    expect(ws.sent).toEqual([])
    ws.open()
    // Two subscribers to one product: one subscribe message, before or after the open.
    const offB = stream.subscribe('SOL-USD', b)
    expect(ws.sent).toEqual([subscribeMsg('SOL-USD')])
    // A new product's first listener subscribes at once on the open socket.
    const offC = stream.subscribe('BTC-USD', c)
    expect(ws.sent).toEqual([subscribeMsg('SOL-USD'), subscribeMsg('BTC-USD')])
    expect(FakeSocket.instances).toHaveLength(1)

    ws.receive(MATCH)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(c).not.toHaveBeenCalled()

    // The first unsubscribe sends nothing; the last sends unsubscribe.
    offA()
    expect(ws.sent).toHaveLength(2)
    ws.receive(MATCH)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
    offB()
    expect(ws.sent[2]).toEqual(unsubscribeMsg('SOL-USD'))
    offA()
    expect(ws.sent).toHaveLength(3)
    expect(ws.closed).toBe(false)

    // The last product's last listener closes the socket, and its close event reconnects nothing.
    offC()
    expect(ws.sent[3]).toEqual(unsubscribeMsg('BTC-USD'))
    expect(ws.closed).toBe(true)
    ws.drop()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)

    // A later subscriber opens a fresh socket.
    stream.subscribe('SOL-USD', a)
    expect(FakeSocket.instances).toHaveLength(2)
  })

  it('reconnect resubscribes every product with listeners', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // no jitter
    const stream = newStream()
    const sol = vi.fn()
    stream.subscribe('SOL-USD', sol)
    stream.subscribe('BTC-USD', vi.fn())
    const offEth = stream.subscribe('ETH-USD', vi.fn())
    const first = FakeSocket.instances[0]
    first.open()
    expect(first.sent).toEqual([subscribeMsg('SOL-USD', 'BTC-USD', 'ETH-USD')])

    first.drop()
    // ETH leaves during the outage; a new product waits for the reconnect, opening no socket of its own.
    offEth()
    stream.subscribe('DOGE-USD', vi.fn())
    expect(first.sent).toHaveLength(1)
    expect(FakeSocket.instances).toHaveLength(1)

    // 1 s, then doubling while the reconnects fail.
    vi.advanceTimersByTime(999)
    expect(FakeSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.instances).toHaveLength(2)
    FakeSocket.instances[1].drop()
    vi.advanceTimersByTime(1999)
    expect(FakeSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.instances).toHaveLength(3)

    const third = FakeSocket.instances[2]
    third.open()
    expect(third.sent).toEqual([subscribeMsg('SOL-USD', 'BTC-USD', 'DOGE-USD')])
    third.receive(MATCH)
    expect(sol).toHaveBeenCalledTimes(1)

    // A successful open resets the wait to 1 s.
    third.drop()
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.instances).toHaveLength(4)
  })

  it('caps the reconnect wait at 30 s and stops reconnecting once nobody listens', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.999) // +20% jitter
    const stream = newStream()
    const off = stream.subscribe('SOL-USD', vi.fn())
    for (let i = 0; i < 8; i++) {
      FakeSocket.instances[i].drop()
      vi.advanceTimersByTime(30_000)
      expect(FakeSocket.instances).toHaveLength(i + 2)
    }

    // Unsubscribing during an outage cancels the pending reconnect.
    FakeSocket.instances[8].drop()
    off()
    vi.advanceTimersByTime(120_000)
    expect(FakeSocket.instances).toHaveLength(9)
  })
})
