import { useEffect } from 'react'
import type { HermesClient } from '@pythnetwork/hermes-client'
import { getPythClient } from './client'
import { usePythStore } from '@/stores/pythStore'
import type { PythTick } from './types'

/** Awaited EventSource type returned by HermesClient.getPriceUpdatesStream. */
type HermesStream = Awaited<ReturnType<HermesClient['getPriceUpdatesStream']>>

/** Convert Pyth fixed-point price object to a plain number. */
function pythPriceToNumber(priceObj: { price: string; expo: number }): number {
  return Number(priceObj.price) * Math.pow(10, priceObj.expo)
}

/**
 * Opens a Pyth Hermes SSE stream for the given feedId on mount.
 * Pushes deduplicated ticks into pythStore.
 * Reconnects with exponential backoff (1s → 2s → 4s... cap 30s, ±20% jitter) on error.
 * Closes the EventSource and cancels any pending reconnect on unmount.
 */
export function usePythFeed(feedId: string | null): void {
  useEffect(() => {
    if (!feedId) return

    // Capture feedId as a non-null local for use inside closures
    const activeFeedId: string = feedId

    let source: HermesStream | null = null
    let cancelled = false
    let backoffMs = 1000

    async function connect() {
      usePythStore.getState().setStatus('connecting')
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
        usePythStore.getState().setStatus('connected')

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
              const tick: PythTick = {
                publishTime,
                time: publishTime * 1000,
                value,
              }
              usePythStore.getState().setPythTick(activeFeedId, tick)
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
      usePythStore.getState().setStatus('reconnecting')
      const jitter = 1 + (Math.random() * 0.4 - 0.2) // ±20%
      const delay = Math.min(backoffMs * jitter, 30_000)
      backoffMs = Math.min(backoffMs * 2, 30_000)
      setTimeout(() => {
        if (!cancelled) connect()
      }, delay)
    }

    connect()

    return () => {
      cancelled = true
      source?.close()
      source = null
      usePythStore.getState().setStatus('idle')
    }
  }, [feedId])
}

/**
 * Thin selector hook: returns the latest PythTick for a feedId, or null if none.
 * Re-renders only when the tick for this feedId changes.
 */
export function useLatestPrice(feedId: string | null): PythTick | null {
  return usePythStore((s) => (feedId ? (s.ticks[feedId] ?? null) : null))
}
