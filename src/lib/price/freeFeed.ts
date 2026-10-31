/**
 * The free live price: Coinbase's trades, put on Pyth's level by the sponsored account. One runtime
 * per feed, shared by every component that mounts the hook for it.
 */
import { useEffect } from 'react'
import { Connection } from '@solana/web3.js'

import { env } from '@/env/env.config'
import { fetchPipelineMinuteCandle } from '@/lib/price/candlesClient'
import { coinbaseStream } from '@/lib/price/coinbaseStream'
import type { CoinbaseEvent, CoinbaseStream } from '@/lib/price/coinbaseStream'
import { COINBASE_SILENT_MS, TradeBuffer, candlePriceAt, levelFactor } from '@/lib/price/leveling'
import { COINBASE_PRODUCTS, pairForFeedId } from '@/lib/price/pairs'
import { subscribeSponsored } from '@/lib/price/sponsored'
import type { SponsoredUpdate } from '@/lib/price/sponsored'
import type { FeedState } from '@/lib/price/types'
import type { SupportedPair } from '@/lib/pyth/feedIds'
import { usePriceStore } from '@/stores/priceStore'

/** A one-minute candle, for Coinbase's price at a Pyth publish time the trade buffer doesn't reach. */
export interface MinuteCandle {
  /** unix seconds, the minute's start */
  time: number
  open: number
  close: number
}

export type CandleFetcher = (
  pair: SupportedPair,
  minuteStartSec: number,
) => Promise<MinuteCandle | null>

let fetchMinuteCandle: CandleFetcher = fetchPipelineMinuteCandle
let stream: CoinbaseStream = coinbaseStream
let connection: Connection | null = null

/** The minute-candle source for the level fallback; the pipeline's one-minute candles by default. */
export function setCandleFetcher(fetcher: CandleFetcher): void {
  fetchMinuteCandle = fetcher
}

function getConnection(): Connection {
  connection ??= new Connection(env.APP_RPC_URL, 'confirmed')
  return connection
}

const DELAYED: FeedState = { status: 'delayed', leveled: false, levelAgeSec: null }
const LIVE_UNLEVELED: FeedState = { status: 'live', leveled: false, levelAgeSec: null }

/** A feed's level (k and the publish time that set it) and its last Pyth price. */
interface PythMemory {
  level: { k: number; publishTime: number } | null
  lastPythPrice: number | null
}

/**
 * Outlives a feed's stop: navigating between pages unmounts the old page's hook before the new one
 * mounts, so the runtime restarts, and it keeps the level until the next Pyth update re-measures it.
 */
const pythMemory = new Map<string, PythMemory>()

/** Starts the feed's subscriptions and its once-a-second writer; returns the stop. */
function startFeed(feedId: string, pair: SupportedPair): () => void {
  const { setTick, setFeedState, setLevel } = usePriceStore.getState()
  const trades = new TradeBuffer()
  const startedAt = Date.now()
  /** Local time of the last Coinbase event; the stream is silent when it is too old. */
  let heardAt: number | null = null
  const pyth: PythMemory = pythMemory.get(feedId) ?? { level: null, lastPythPrice: null }
  pythMemory.set(feedId, pyth)
  if (pyth.level) setLevel(feedId, pyth.level.k)
  /** Counts Pyth updates, so a slow candle answer can't overwrite a newer level. */
  let updates = 0
  let active = true

  function onEvent(e: CoinbaseEvent) {
    heardAt = Date.now()
    if (e.kind === 'trade') trades.push(e.timeMs, e.price)
  }

  function setK(k: number, publishTime: number) {
    pyth.level = { k, publishTime }
    setLevel(feedId, k)
  }

  // Both prices are taken at Pyth's publish time; with neither Coinbase price, the last k stays.
  function onUpdate(u: SponsoredUpdate) {
    pyth.lastPythPrice = u.price
    const update = ++updates
    const traded = trades.priceAt(u.publishTime * 1000)
    if (traded !== null) {
      setK(levelFactor(u.price, traded), u.publishTime)
      return
    }
    const minuteStart = u.publishTime - (u.publishTime % 60)
    fetchMinuteCandle(pair, minuteStart).then(
      (candle) => {
        if (!candle || !active || update !== updates) return
        setK(levelFactor(u.price, candlePriceAt(candle, u.publishTime)), u.publishTime)
      },
      () => {},
    )
  }

  function writeSecond() {
    const now = Date.now()
    const s = Math.floor(now / 1000)
    // Before the first event the stream gets the same grace as after one.
    if (now - (heardAt ?? startedAt) >= COINBASE_SILENT_MS) {
      if (pyth.lastPythPrice !== null) {
        setTick(feedId, { time: s * 1000, value: pyth.lastPythPrice, publishTime: s })
      }
      setFeedState(feedId, DELAYED)
      return
    }
    const trade = trades.latest()
    if (!trade) return
    const { level } = pyth
    if (!level) {
      setTick(feedId, { time: s * 1000, value: trade.price, publishTime: s })
      setFeedState(feedId, LIVE_UNLEVELED)
      return
    }
    setTick(feedId, { time: s * 1000, value: trade.price * level.k, publishTime: s })
    setFeedState(feedId, {
      status: 'live',
      leveled: true,
      levelAgeSec: Math.max(0, s - level.publishTime),
    })
  }

  const stopTrades = stream.subscribe(COINBASE_PRODUCTS[pair], onEvent)
  // An absent account never sets k, so the feed stays unleveled; nothing waits on missing().
  const stopSponsored = subscribeSponsored(getConnection(), feedId, {
    update: onUpdate,
    missing: () => {},
  })
  const timer = setInterval(writeSecond, 1000)

  return () => {
    active = false
    clearInterval(timer)
    stopTrades()
    stopSponsored()
  }
}

const feeds = new Map<string, { refs: number; stop: () => void }>()

/**
 * Keeps the feed's leveled live price in the price store while mounted. A feed id with no Coinbase
 * product subscribes to nothing.
 */
export function useLeveledFeed(feedId: string | null): void {
  useEffect(() => {
    if (!feedId) return
    const pair = pairForFeedId(feedId)
    if (!pair) return

    let feed = feeds.get(feedId)
    if (!feed) {
      feed = { refs: 0, stop: startFeed(feedId, pair) }
      feeds.set(feedId, feed)
    }
    feed.refs++
    const own = feed

    return () => {
      own.refs--
      if (own.refs > 0) return
      own.stop()
      feeds.delete(feedId)
    }
  }, [feedId])
}

/** Test-only: replace the Coinbase stream. */
export function __setCoinbaseStreamForTests(s: CoinbaseStream): void {
  stream = s
}

/** Test-only: replace the Solana connection. */
export function __setConnectionForTests(c: Connection): void {
  connection = c
}

/**
 * Test-only: stop every feed, forget what the feeds learned from Pyth, and restore the stream, the
 * connection and the candle source.
 */
export function __resetFreeFeedForTests(): void {
  for (const feed of feeds.values()) feed.stop()
  feeds.clear()
  pythMemory.clear()
  stream = coinbaseStream
  connection = null
  fetchMinuteCandle = fetchPipelineMinuteCandle
}
