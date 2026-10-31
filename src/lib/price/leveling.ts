/** No Coinbase event (trade or heartbeat) for this long: the stream is silent and the price delayed. */
export const COINBASE_SILENT_MS = 5000
/** Pyth's level older than this many seconds is reported with its age. */
export const LEVEL_STALE_SEC = 180
/** How much trade history is kept to measure the level at a Pyth publish time. */
export const TRADE_BUFFER_MS = 300_000

interface Trade {
  timeMs: number
  price: number
}

/** Recent trades in time order, kept for TRADE_BUFFER_MS behind the newest. */
export class TradeBuffer {
  private trades: Trade[] = []

  push(timeMs: number, price: number): void {
    this.trades.push({ timeMs, price })
    const cutoff = timeMs - TRADE_BUFFER_MS
    while (this.trades[0].timeMs < cutoff) this.trades.shift()
  }

  /** The last trade's price at or before timeMs; null when none is buffered. */
  priceAt(timeMs: number): number | null {
    for (let i = this.trades.length - 1; i >= 0; i--) {
      if (this.trades[i].timeMs <= timeMs) return this.trades[i].price
    }
    return null
  }

  latest(): Trade | null {
    return this.trades.at(-1) ?? null
  }
}

/** The factor that puts a Coinbase price on Pyth's level: pythPrice / coinbasePrice. */
export function levelFactor(pythPrice: number, coinbasePrice: number): number {
  return pythPrice / coinbasePrice
}

/** A one-minute candle's price at tSec, interpolated linearly from open to close. */
export function candlePriceAt(
  candle: { time: number /* s */; open: number; close: number },
  tSec: number,
): number {
  return candle.open + ((candle.close - candle.open) * (tSec - candle.time)) / 60
}
