import { useEffect } from 'react'
import type { HermesClient } from '@pythnetwork/hermes-client'

import { COINBASE_SILENT_MS } from '@/lib/price/leveling'
import type { FeedState, PriceTick } from '@/lib/price/types'
import { getPythClient } from '@/lib/pyth/client'
import { usePriceStore } from '@/stores/priceStore'

/** Awaited EventSource type returned by HermesClient.getPriceUpdatesStream. */
type HermesStream = Awaited<ReturnType<HermesClient['getPriceUpdatesStream']>>

/** Pyth's stream is Pyth's own price, so it is always on Pyth's level. */
const LIVE: FeedState = { status: 'live', leveled: true, levelAgeSec: 0 }
const DELAYED: FeedState = { status: 'delayed', leveled: true, levelAgeSec: 0 }

/** Convert Pyth fixed-point price object to a plain number. */
function pythPriceToNumber(priceObj: { price: string; expo: number }): number {
  return Number(priceObj.price) * Math.pow(10, priceObj.expo)
}

/**
 * Opens a Pyth Hermes SSE stream for the given feedId on mount.
 * Pushes deduplicated ticks into the price store, and once a second the feed state: live while a
 * tick arrived within COINBASE_SILENT_MS, else delayed.
 * Reconnects with exponential backoff (1s → 2s → 4s... cap 30s, ±20% jitter) on error.
 * Closes the EventSource and cancels any pending reconnect on unmount.
 */
export function usePythHermesFeed(feedId: string | null): void {
  useEffect(() => {
    if (!feedId) return

    // Capture feedId as a non-null local for use inside closures
    const activeFeedId: string = feedId

    let source: HermesStream | null = null
    let cancelled = false
    let backoffMs = 1000
    const startedAt = Date.now()
    /** Local time of the last tick; before the first, the stream gets the same grace. */
    let tickAt: number | null = null

    async function connect() {
      try {
        const client = getPythClient()
        // HermesClient.getPriceUpdatesStream returns a Promise<EventSource> wrapper
        // from the `eventsource` package. We must pass { parsed: true } — the
        // default is `false`, which omits the `parsed` array we consume below.
        const stream = await client.getPriceUpdatesStream([activeFeedId], { parsed: true })

        // Pitfall 4 race guard: if cleanup fired while awaiting, close and bail
        if (cancelled) {
          stream.close()
          return
        }

        source = stream
        backoffMs = 1000 // reset backoff on successful connect

        const src = source // local non-null ref for the closure

        src.onmessage = (e: MessageEvent) => {
          try {
            const update = JSON.parse(e.data as string) as {
              parsed?: Array<{
                id: string
                price: { price: string; expo: number; publish_time: number }
              }>
            }
            // Hermes SSE emits parsed price updates array
            const priceFeeds = update?.parsed ?? []

            for (const feed of priceFeeds) {
              if (!feed.price) continue
              const publishTime = feed.price.publish_time
              const value = pythPriceToNumber({
                price: feed.price.price,
                expo: feed.price.expo,
              })
              const tick: PriceTick = {
                publishTime,
                time: publishTime * 1000,
                value,
              }
              usePriceStore.getState().setTick(activeFeedId, tick)
              tickAt = Date.now()
            }
          } catch {
            // Ignore malformed SSE messages
          }
        }

        src.onerror = () => {
          src.close()
          source = null
          if (!cancelled) scheduleReconnect()
        }
      } catch {
        if (!cancelled) scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      const jitter = 1 + (Math.random() * 0.4 - 0.2) // ±20%
      const delay = Math.min(backoffMs * jitter, 30_000)
      backoffMs = Math.min(backoffMs * 2, 30_000)
      setTimeout(() => {
        if (!cancelled) connect()
      }, delay)
    }

    function writeState() {
      const now = Date.now()
      if (now - (tickAt ?? startedAt) >= COINBASE_SILENT_MS) {
        usePriceStore.getState().setFeedState(activeFeedId, DELAYED)
      } else if (tickAt !== null) {
        usePriceStore.getState().setFeedState(activeFeedId, LIVE)
      }
    }

    connect()
    const stateTimer = setInterval(writeState, 1000)

    return () => {
      cancelled = true
      clearInterval(stateTimer)
      source?.close()
      source = null
    }
  }, [feedId])
}
