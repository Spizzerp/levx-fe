import { useEffect } from 'react'
import { getPythClient } from './client'
import { usePythStore } from '@/stores/pythStore'
import type { PythTick } from './types'

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

    let source: EventSource | null = null
    let cancelled = false
    let backoffMs = 1000

    async function connect() {
      usePythStore.getState().setStatus('connecting')
      try {
        const client = getPythClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream = await (client as any).getStreamingPriceUpdates([feedId])

        // Pitfall 4 race guard: if cleanup fired while awaiting, close and bail
        if (cancelled) {
          stream.close()
          return
        }

        source = stream
        backoffMs = 1000 // reset backoff on successful connect
        usePythStore.getState().setStatus('connected')

        source.onmessage = (e: MessageEvent) => {
          try {
            const update = JSON.parse(e.data)
            // Hermes SSE emits parsed price updates array
            const priceFeeds: Array<{
              id: string
              price: { price: string; expo: number; publish_time: number }
            }> = update?.parsed ?? []

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
              usePythStore.getState().setPythTick(feedId, tick)
            }
          } catch {
            // Ignore malformed SSE messages
          }
        }

        source.onerror = () => {
          source?.close()
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
