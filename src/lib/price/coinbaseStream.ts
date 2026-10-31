/**
 * Coinbase Exchange's public trade stream: one websocket for every product on screen, subscribed
 * per product while it has listeners, reconnecting with the Hermes hook's backoff.
 */

export type CoinbaseEvent =
  | { kind: 'trade'; price: number; timeMs: number }
  | { kind: 'heartbeat'; timeMs: number }

type Listener = (e: CoinbaseEvent) => void

export interface CoinbaseStream {
  subscribe(product: string, onEvent: Listener): () => void
}

const COINBASE_WS_URL = 'wss://ws-feed.exchange.coinbase.com'
const CHANNELS = ['matches', 'heartbeat']
const BACKOFF_MIN_MS = 1000
const BACKOFF_MAX_MS = 30_000

interface CoinbaseMessage {
  type?: unknown
  product_id?: unknown
  price?: unknown
  time?: unknown
}

/** Coinbase stamps microseconds; trimmed to milliseconds so every engine's Date.parse reads it. */
function parseTimeMs(time: unknown): number {
  return typeof time === 'string' ? Date.parse(time.replace(/(\.\d{3})\d+/, '$1')) : NaN
}

function toEvent(msg: CoinbaseMessage): CoinbaseEvent | null {
  const timeMs = parseTimeMs(msg.time)
  if (!Number.isFinite(timeMs)) return null
  if (msg.type === 'heartbeat') return { kind: 'heartbeat', timeMs }
  if (msg.type !== 'match' && msg.type !== 'last_match') return null
  const price = typeof msg.price === 'string' ? Number(msg.price) : NaN
  return Number.isFinite(price) && price > 0 ? { kind: 'trade', price, timeMs } : null
}

/**
 * The socket opens on the first subscribe and closes when the last listener leaves. `wsCtor` is
 * read when connecting, so creating a stream touches nothing.
 */
export function createCoinbaseStream(wsCtor?: typeof WebSocket): CoinbaseStream {
  const listeners = new Map<string, Set<Listener>>()
  let ws: WebSocket | null = null
  let open = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let backoffMs = BACKOFF_MIN_MS

  function send(type: 'subscribe' | 'unsubscribe', productIds: string[]) {
    ws?.send(JSON.stringify({ type, product_ids: productIds, channels: CHANNELS }))
  }

  function dispatch(data: unknown) {
    let msg: CoinbaseMessage
    try {
      msg = JSON.parse(data as string) as CoinbaseMessage
    } catch {
      return
    }
    const productListeners =
      typeof msg?.product_id === 'string' ? listeners.get(msg.product_id) : undefined
    if (!productListeners) return
    const event = toEvent(msg)
    if (!event) return
    for (const listener of productListeners) listener(event)
  }

  function connect() {
    const Ctor = wsCtor ?? WebSocket
    const socket = new Ctor(COINBASE_WS_URL)
    ws = socket
    socket.onopen = () => {
      open = true
      backoffMs = BACKOFF_MIN_MS
      send('subscribe', [...listeners.keys()])
    }
    socket.onmessage = (e: MessageEvent) => dispatch(e.data)
    socket.onclose = () => {
      ws = null
      open = false
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    const jitter = 1 + (Math.random() * 0.4 - 0.2) // ±20%
    const delay = Math.min(backoffMs * jitter, BACKOFF_MAX_MS)
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  /** Nobody listens: cancel a pending reconnect and close the socket without reconnecting. */
  function shutdown() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.close()
    }
    ws = null
    open = false
  }

  return {
    subscribe(product, onEvent) {
      // A wrapper per call, so the same function subscribed twice counts twice.
      const listener: Listener = (e) => onEvent(e)
      let productListeners = listeners.get(product)
      if (!productListeners) {
        productListeners = new Set()
        listeners.set(product, productListeners)
        // Before the open (or during a reconnect wait) the open itself subscribes every product.
        if (open) send('subscribe', [product])
        else if (!ws && !reconnectTimer) connect()
      }
      productListeners.add(listener)
      const own = productListeners

      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        own.delete(listener)
        if (own.size > 0) return
        listeners.delete(product)
        if (open) send('unsubscribe', [product])
        if (listeners.size === 0) shutdown()
      }
    },
  }
}

/** The app's one Coinbase connection; nothing opens until the first subscribe. */
export const coinbaseStream = createCoinbaseStream()
